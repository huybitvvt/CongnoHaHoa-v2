/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.join(__dirname, '../ups-browser-extension');
const code = '1Z064H260334937790';
function reader() {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'reader.js'), 'utf8'), context);
  return context.readUpsDocument;
}
function doc(text, nodes = {}) {
  return { body: { innerText: text }, querySelectorAll: (selector) => nodes[selector] || [] };
}
function node(text, visible = true) { return { innerText: text, getClientRects: () => visible ? [{}] : [] }; }

test('does not read Delivered from an ordinary milestone timeline', () => {
  assert.equal(reader()(doc(`${code}\nLabel Created\nOn the Way\nOut for Delivery\nDelivered`), code), null);
});
test('reads only explicit current status, preserving original text', () => {
  const result = reader()(doc(`${code}\nOn the Way\nDelivered`, { '#st_App_PkgSts': [node('On the Way')] }), code);
  assert.equal(result.status, 'Đang vận chuyển');
  assert.equal(result.code, code);
  assert.equal(result.rawStatus, 'On the Way');
});
test('does not attribute another package result to requested code', () => {
  assert.equal(reader()(doc('1Z9999999999999999\nDelivered', { '#st_App_PkgSts': [node('Delivered')] }), code), null);
  assert.equal(reader()(doc(`${code}99\nDelivered`, { '#st_App_PkgSts': [node('Delivered')] }), code), null);
});
test('ignores hidden statuses and rejects conflicting visible statuses', () => {
  const read = reader();
  assert.equal(read(doc(code, { '#st_App_PkgSts': [node('Delivered', false)] }), code), null);
  assert.equal(read(doc(code, { '#st_App_PkgSts': [node('Delivered'), node('On the Way')] }), code), null);
});
test('challenge pauses queue, invalid number remains a per-row failure', () => {
  assert.equal(reader()(doc('Access Denied'), code).fatal, true);
  const result = reader()(doc('We could not locate the shipment'), code);
  assert.equal(result.ok, false);
  assert.equal(result.fatal, undefined);
});
test('semantic current step is used and unknown status is not guessed', () => {
  assert.equal(reader()(doc(code, { '[aria-current="step"], [aria-current="true"]': [node('Delivered')] }), code).status, 'Đã giao hàng');
  assert.equal(reader()(doc(code, { '#st_App_PkgSts': [node('Something new')] }), code), null);
});

function background({
  result = { ok: true, code, status: 'Đã giao hàng' },
  redirected = false,
  existing = false,
  failReads = 0,
  tabStatus = 'complete',
  redactUrl = false,
  redactQueryUrl = false,
  permissionDenied = false,
  contentAvailable = false,
  contentResult = result,
  installAvailable = false,
} = {}) {
  let listener;
  let release;
  const removed = [];
  let created = 0;
  let reads = 0;
  let contentReads = 0;
  let installs = 0;
  let hasContent = contentAvailable;
  const chrome = {
    runtime: { onMessage: { addListener: (fn) => { listener = fn; } }, getManifest: () => ({ version: '0.1.0' }) },
    tabs: {
      query: async () => existing ? [{ id: 123, url: redactQueryUrl ? undefined : `https://www.ups.com/track?tracknum=${code}&requester=ST/trackdetails` }] : [],
      create: () => { created++; return new Promise((resolve) => { release = () => resolve({ id: 123 }); }); },
      get: async () => ({ status: tabStatus, url: redactUrl ? undefined : redirected ? 'https://www.ups.com/login' : `https://www.ups.com/track?loc=en_US&tracknum=${code}` }),
      remove: async (id) => removed.push(id),
      sendMessage: (_id, _message, callback) => {
        contentReads++;
        if (hasContent) {
          callback(contentResult);
          return;
        }
        chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
        callback();
        delete chrome.runtime.lastError;
      },
    },
    scripting: { executeScript: async (options) => {
      assert.equal(options.injectImmediately, true);
      if (permissionDenied) throw new Error('Cannot access contents of url. Extension manifest must request permission');
      if (options.files) {
        installs++;
        assert.equal(Array.from(options.files).join(','), 'reader.js,ups-content.js');
        if (!installAvailable) throw new Error('Frame with ID 0 is showing error page');
        hasContent = true;
        return [{ result: undefined }];
      }
      if (reads++ < failReads) throw new Error('Frame with ID 0 is showing error page');
      return [{ result }];
    } },
  };
  const context = {
    chrome,
    URL,
    importScripts() {},
    clearTimeout() {},
    setTimeout: (fn) => {
      if (!String(fn).includes('__timeout')) fn();
      return 1;
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context);
  const sender = { url: 'https://cong-no-ha-hoa-jade.vercel.app/tracking-ups', frameId: 0, tab: { id: 9 } };
  return {
    send: (message, from = sender) => new Promise((resolve) => listener({ type: 'HAHOA_UPS', ...message }, from, resolve)),
    release: async () => { await new Promise(setImmediate); release(); }, removed, count: () => created, reads: () => reads, contentReads: () => contentReads,
    installs: () => installs,
  };
}
test('rejects untrusted origins, iframe messages and invalid codes before opening tabs', async () => {
  const bg = background();
  for (const sender of [
    { url: 'https://evil.vercel.app/', frameId: 0, tab: { id: 1 } },
    { url: 'https://cong-no-ha-hoa-jade.vercel.app/', frameId: 2, tab: { id: 1 } },
  ]) assert.equal((await bg.send({ action: 'track', code }, sender)).ok, false);
  assert.equal((await bg.send({ action: 'track', code: 'bad/?' })).ok, false);
  assert.equal(bg.count(), 0);
});
test('accepts messages from the cloned Vercel deployment', async () => {
  const bg = background();
  const sender = { url: 'https://cong-no-ha-hoa-v2.vercel.app/tracking-ups', frameId: 0, tab: { id: 10 } };
  assert.equal((await bg.send({ action: 'ping' }, sender)).ok, true);
});
test('serializes requests across app tabs and closes only its own successful tab', async () => {
  const bg = background();
  const pending = bg.send({ action: 'track', code });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal((await bg.send({ action: 'track', code })).fatal, true);
  await bg.release();
  assert.equal((await pending).ok, true);
  assert.deepEqual(bg.removed, [123]);
  assert.equal(bg.count(), 1);
});
test('keeps tab and reports a fatal result when UPS asks for verification or redirects', async () => {
  for (const options of [{ result: { ok: false, fatal: true, error: 'Verification' } }, { redirected: true }]) {
    const bg = background(options);
    const pending = bg.send({ action: 'track', code });
    await Promise.resolve(); await Promise.resolve(); await bg.release();
    assert.equal((await pending).fatal, true);
    assert.deepEqual(bg.removed, []);
  }
});

test('reuses matching loaded UPS tab and never closes a user tab', async () => {
  const bg = background({ existing: true });
  assert.equal((await bg.send({ action: 'track', code })).ok, true);
  assert.equal(bg.count(), 0);
  assert.deepEqual(bg.removed, []);
});

test('reads rendered result even when browser tab still reports loading', async () => {
  const bg = background({ existing: true, tabStatus: 'loading' });
  assert.equal((await bg.send({ action: 'track', code })).ok, true);
  assert.equal(bg.reads(), 1);
});

test('redacted Tab.url does not prevent reading a permitted UPS document', async () => {
  const bg = background({ existing: true, redactUrl: true });
  assert.equal((await bg.send({ action: 'track', code })).ok, true);
  assert.equal(bg.reads(), 1);
});

test('reads an already open UPS tab through its content script when tab metadata is redacted', async () => {
  const bg = background({ existing: true, redactQueryUrl: true, contentAvailable: true });
  assert.equal((await bg.send({ action: 'track', code })).ok, true);
  assert.equal(bg.count(), 0);
  assert.equal(bg.contentReads(), 1);
  assert.equal(bg.reads(), 0);
});

test('installs the content reader when an existing UPS tab has no receiving end', async () => {
  const bg = background({ existing: true, installAvailable: true });
  assert.equal((await bg.send({ action: 'track', code })).ok, true);
  assert.equal(bg.installs(), 1);
  assert.equal(bg.contentReads(), 2);
  assert.equal(bg.reads(), 0);
});

test('declares the UPS content reader at document_start', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const upsScript = manifest.content_scripts.find((script) => script.matches.includes('https://www.ups.com/*'));
  assert.equal(upsScript.run_at, 'document_start');
  assert.deepEqual(upsScript.js, ['reader.js', 'ups-content.js']);
});

test('withheld UPS permission reports failure immediately instead of WAIT_URL', async () => {
  const bg = background({ existing: true, redactUrl: true, permissionDenied: true });
  const result = await bg.send({ action: 'track', code });
  assert.equal(result.fatal, true);
  assert.match(result.error, /www.ups.com/);
});

test('injected reader rejects wrong URL even when tab metadata was unavailable', () => {
  const context = { location: { origin: 'https://www.ups.com', href: 'https://www.ups.com/track?tracknum=WRONG123' }, URL };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'reader.js'), 'utf8'), context);
  assert.equal(context.readUpsDocument(null, code, true).fatal, true);
});

test('diagnostics distinguish missing code from missing status', () => {
  assert.equal(reader()(doc('Loading'), code, true).reason, 'CODE_NOT_VISIBLE');
  assert.match(reader()(doc(code), code, true).reason, /STATUS_NOT_RESOLVED/);
});

test('retries transient frame errors while UPS is navigating', async () => {
  const bg = background({ existing: true, failReads: 2 });
  assert.equal((await bg.send({ action: 'track', code })).ok, true);
  assert.equal(bg.reads(), 3);
});

test('reads heading in compact tracking banner, excluding generic page headings', () => {
  const heading = { ...node('Delivered'), parentElement: { innerText: `Delivered ${code}` } };
  assert.equal(reader()(doc(code, { 'h1, h2, h3, [role="heading"]': [heading] }), code).rawStatus, 'Delivered');
  heading.parentElement.innerText = `x`.repeat(300) + code;
  assert.equal(reader()(doc(code, { 'h1, h2, h3, [role="heading"]': [heading] }), code), null);
});

test('reads actual UPS header and strips the Material icon text without changing DOM', () => {
  const header = {
    ...node('Delivered check_circle'),
    cloneNode() {
      const copy = { textContent: 'Delivered check_circle' };
      copy.querySelectorAll = () => [{ remove: () => { copy.textContent = 'Delivered'; } }];
      return copy;
    },
  };
  const result = reader()(doc(`${code} Delivered check_circle`, { 'app-header-tile #stApp_nameKey': [header] }), code);
  assert.equal(result.rawStatus, 'Delivered');
  assert.equal(result.status, 'Đã giao hàng');
  assert.equal(header.innerText, 'Delivered check_circle');
});

