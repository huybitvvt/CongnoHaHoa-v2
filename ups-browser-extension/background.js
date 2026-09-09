importScripts('reader.js');

let busy = false;
let lastStarted = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  try {
    await pause(Math.max(0, 3000 - (Date.now() - lastStarted)));
    lastStarted = Date.now();
    const openTabs = await chrome.tabs.query({ url: 'https://www.ups.com/*' });
    const existing = openTabs.find((item) => {
      try { return new URL(item.url).searchParams.get('tracknum')?.toUpperCase() === code; }
      catch { return false; }
    });
    const tab = existing || await chrome.tabs.create({ url: `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(code)}`, active: false });
    ownsTab = !existing;
    tabId = tab.id;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      await pause(1200);
      // Extension API calls keep this bounded request alive in MV3.
      const current = await chrome.tabs.get(tabId);
      lastStage = `tab=${tabId} browser=${current.status}`;
      // A visible result can be ready while third-party resources keep the tab loading.
      if (!current.url || current.url === 'about:blank') { lastStage += ' WAIT_URL'; continue; }
      const url = new URL(current.url);
      if (url.origin !== 'https://www.ups.com' || url.searchParams.get('tracknum')?.toUpperCase() !== code) {
        keepTab = true;
        return { ok: false, fatal: true, error: 'UPS chuyển sang trang khác. Kiểm tra tab UPS rồi thử lại.' };
      }
      let results;
      try {
        // One injection: navigation between injecting a file and invoking it cannot erase the reader.
        results = await chrome.scripting.executeScript({
          target: { tabId }, injectImmediately: true, func: globalThis.readUpsDocument, args: [null, code, true],
        });
        attempts++;
        lastReadError = '';
      } catch (error) {
        lastReadError = String(error?.message || error).slice(0, 220);
        if (/cannot access contents|missing host permission|extensions gallery cannot be scripted/i.test(lastReadError)) {
          keepTab = true;
          return { ok: false, fatal: true, error: `Chưa được quyền đọc UPS. Trong quản lý tiện ích, cho phép truy cập www.ups.com rồi thử lại. Chi tiết: ${lastReadError}` };
        }
        // UPS can briefly navigate through an error/intermediate document before rendering.
        continue;
      }
      const result = results[0]?.result;
      if (result?.pending) { lastStage += ` reader=${result.readerVersion} ${result.reason}`; continue; }
      if (!result) lastStage += ' READER_EMPTY';
      if (result) {
        keepTab = result.fatal === true;
        return result;
      }
    }
    keepTab = true;
    return { ok: false, fatal: true, error: `Chưa đọc được trạng thái sau 45 giây. Chẩn đoán 0.1.3: ${lastStage}; reads=${attempts}` + (lastReadError ? `; ${lastReadError}` : '') };
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
