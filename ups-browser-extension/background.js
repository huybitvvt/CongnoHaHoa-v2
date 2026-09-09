importScripts('reader.js');

let busy = false;
let lastStarted = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const UPS_ORIGINS = ['https://www.ups.com', 'https://ups.com'];
const UPS_TAB_PATTERNS = ['https://www.ups.com/*', 'https://ups.com/*'];
const VERSION = '0.1.7';

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((resolve) => { timer = setTimeout(() => resolve({ __timeout: label }), ms); }),
  ]);
}

function isPermissionError(message) {
  return /cannot access contents|missing host permission|extensions gallery cannot be scripted/i.test(message);
}

function isUpsTrackingUrl(url, code) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return UPS_ORIGINS.includes(parsed.origin) && parsed.searchParams.get('tracknum')?.toUpperCase() === code;
  } catch { return false; }
}

function hasDifferentTrackingCode(url, code) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const tracknum = parsed.searchParams.get('tracknum')?.toUpperCase();
    return UPS_ORIGINS.includes(parsed.origin) && Boolean(tracknum) && tracknum !== code;
  } catch { return false; }
}

async function queryUpsTabs() {
  const groups = await Promise.all(UPS_TAB_PATTERNS.map((url) => withTimeout(chrome.tabs.query({ url }), 3000, `QUERY_${url}`)
    .then((result) => Array.isArray(result) ? result : [])
    .catch(() => [])));
  const seen = new Set();
  return groups.flat().filter((tab) => {
    if (!Number.isInteger(tab?.id) || seen.has(tab.id)) return false;
    seen.add(tab.id);
    return true;
  });
}

function contentRead(tabId, code) {
  return withTimeout(new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'HAHOA_UPS_CONTENT', action: 'read', code }, (result) => {
      const error = chrome.runtime.lastError;
      resolve(error ? { error: String(error.message || error) } : { result });
    });
  }), 2500, `CONTENT_TIMEOUT tab=${tabId}`);
}

async function injectedRead(tabId, code) {
  const results = await withTimeout(chrome.scripting.executeScript({
    target: { tabId }, injectImmediately: true, func: globalThis.readUpsDocument, args: [null, code, true],
  }), 5000, `INJECT_TIMEOUT tab=${tabId}`);
  if (results?.__timeout) return { pending: true, reason: results.__timeout, readerVersion: VERSION };
  return results[0]?.result;
}

async function readTab(tabId, code) {
  const content = await contentRead(tabId, code);
  if (content?.__timeout) return { error: content.__timeout, method: 'content' };
  if (content.result) return { result: content.result, method: 'content' };
  try {
    return { result: await injectedRead(tabId, code), method: 'inject', bridgeError: content.error };
  } catch (error) {
    return { error: String(error?.message || error).slice(0, 220), method: 'inject', bridgeError: content.error };
  }
}

async function reloadUpsTab(tabId) {
  const result = await withTimeout(chrome.tabs.reload(tabId, { bypassCache: true }), 5000, `RELOAD_TIMEOUT tab=${tabId}`);
  if (result?.__timeout) return result.__timeout;
  await pause(3000);
  return '';
}

function allowedSender(sender) {
  try {
    const url = new URL(sender.url);
    return sender.frameId === 0 && Number.isInteger(sender.tab?.id) && (
      (url.protocol === 'https:' && ['congno-ha-hoa.vercel.app', 'cong-no-ha-hoa-jade.vercel.app'].includes(url.hostname))
      || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    );
  } catch { return false; }
}

async function track(code) {
  let tabId;
  let ownsTab = false;
  let keepTab = false;
  let lastReadError = '';
  let lastStage = 'START';
  let attempts = 0;
  let reloadedTab = false;
  try {
    await pause(Math.max(0, 3000 - (Date.now() - lastStarted)));
    lastStarted = Date.now();
    const openTabs = await withTimeout(queryUpsTabs(), 7000, 'QUERY_TABS_TIMEOUT');
    if (openTabs?.__timeout) return { ok: false, fatal: true, error: `Không lấy được danh sách tab UPS. Chẩn đoán ${VERSION}: ${openTabs.__timeout}` };
    let initialResult;
    let existing = openTabs.find((item) => isUpsTrackingUrl(item.url, code));
    if (!existing) {
      for (const item of openTabs) {
        if (hasDifferentTrackingCode(item.url, code)) continue;
        const read = await readTab(item.id, code);
        attempts++;
        lastReadError = read.error || '';
        if (read.result?.ok) return read.result;
        if (read.result?.fatal && /không khớp mã yêu cầu/i.test(read.result.error || '')) continue;
        if (read.result?.fatal) return read.result;
        if (read.result?.pending && read.result.reason !== 'CODE_NOT_VISIBLE') {
          existing = item;
          initialResult = read.result;
          break;
        }
      }
    }
    const tab = existing || await withTimeout(chrome.tabs.create({ url: `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(code)}`, active: false }), 7000, 'CREATE_TAB_TIMEOUT');
    if (tab?.__timeout) return { ok: false, fatal: true, error: `Không mở được tab UPS. Chẩn đoán ${VERSION}: ${tab.__timeout}` };
    ownsTab = !existing;
    tabId = tab.id;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await pause(1200);
      const current = await withTimeout(chrome.tabs.get(tabId), 3000, `GET_TAB_TIMEOUT tab=${tabId}`);
      if (current?.__timeout) { lastStage = current.__timeout; continue; }
      lastStage = `tab=${tabId} browser=${current.status}`;
      // A visible result can be ready while third-party resources keep the tab loading.
      if (current.url === 'about:blank') { lastStage += ' WAIT_BLANK'; continue; }
      // Chrome may redact Tab.url. Validate location inside the permitted page instead.
      const url = current.url ? new URL(current.url) : null;
      const currentCode = url?.searchParams.get('tracknum')?.toUpperCase();
      if (url && (!UPS_ORIGINS.includes(url.origin) || !url.pathname.startsWith('/track') || (currentCode && currentCode !== code))) {
        keepTab = true;
        return { ok: false, fatal: true, error: 'UPS chuyển sang trang khác. Kiểm tra tab UPS rồi thử lại.' };
      }
      const read = initialResult ? { result: initialResult, method: 'content' } : await readTab(tabId, code);
      initialResult = null;
      attempts++;
      lastReadError = read.error || '';
      if (read.error) {
        if (isPermissionError(read.error)) {
          keepTab = true;
          return { ok: false, fatal: true, error: `Chưa được quyền đọc UPS. Trong quản lý tiện ích, cho phép truy cập www.ups.com rồi thử lại. Chi tiết: ${read.error}` };
        }
        // UPS can briefly navigate through an error/intermediate document before rendering.
        continue;
      }
      const result = read.result;
      if (result?.pending) {
        lastStage += ` method=${read.method} reader=${result.readerVersion} ${result.reason}` + (read.bridgeError ? ` content=${read.bridgeError}` : '');
        if (!reloadedTab && read.method === 'inject' && /INJECT_TIMEOUT|READER_NOT_READY/i.test(result.reason || '')) {
          reloadedTab = true;
          const reloadError = await reloadUpsTab(tabId);
          lastStage += reloadError ? ` reload=${reloadError}` : ' reload=OK';
        }
        continue;
      }
      if (!result) lastStage += ' READER_EMPTY';
      if (result) {
        keepTab = result.fatal === true;
        return result;
      }
    }
    keepTab = true;
    return { ok: false, fatal: true, error: `Chưa đọc được trạng thái sau 45 giây. Chẩn đoán ${VERSION}: ${lastStage}; reads=${attempts}` + (lastReadError ? `; ${lastReadError}` : '') };
  } catch (error) {
    keepTab = true;
    console.warn('UPS tracking failed:', error instanceof Error ? error.message : String(error));
    return { ok: false, fatal: true, error: `Không truy cập được tab UPS. Giữ tab UPS mở rồi thử lại. Chi tiết: ${String(error?.message || error).slice(0, 220)}` };
  } finally {
    if (ownsTab && Number.isInteger(tabId) && !keepTab) await chrome.tabs.remove(tabId).catch(() => {});
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'HAHOA_UPS') return false;
  if (!allowedSender(sender)) { respond({ ok: false, error: 'Website không được phép.' }); return false; }
  if (message.action === 'ping') { respond({ ok: true, version: chrome.runtime.getManifest().version }); return false; }
  if (message.action !== 'track') return false;
  const code = String(message.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{7,34}$/.test(code)) { respond({ ok: false, error: 'Mã UPS phải có 7–34 ký tự chữ hoặc số.' }); return false; }
  if (busy) { respond({ ok: false, fatal: true, error: 'Tiện ích đang tra mã ở một lượt khác. Chờ lượt đó xong rồi thử lại.' }); return false; }
  busy = true;
  void track(code).then(respond);
  return true;
});
