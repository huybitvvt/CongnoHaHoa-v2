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
test('reads every dated UPS journey event without replacing the explicit current status', () => {
  const timeline = node([
    'Wednesday, August 19, 2026', '3:08 P.M.', 'Delivered', 'Left at the Front Door', 'NAVARRE, FL, US',
    'Wednesday, August 19, 2026', '8:24 A.M.', 'Out for Delivery', 'NAVARRE, FL, US',
    'Tuesday, August 18, 2026', '9:41 P.M.', 'Arrived at UPS Facility', 'PENSACOLA, FL, US',
  ].join('\n'));
  const result = reader()(doc(`${code}\nDelivered`, {
    '#st_App_PkgSts': [node('Delivered')],
    'app-shipment-progress-details': [timeline],
  }), code);
  assert.equal(result.status, 'Đã giao hàng');
  assert.equal(result.history.length, 3);
  assert.equal(result.history[0].status, 'Đã giao hàng');
  assert.equal(result.history[0].date, 'Wednesday, August 19, 2026');
  assert.match(result.history[0].time, /3:08 P\.M/i);
  assert.equal(result.history[0].location, 'NAVARRE, FL, US');
  assert.match(result.history[0].details, /Left at the Front Door/);
  assert.equal(result.history[1].status, 'Đang giao hàng');
  assert.equal(result.history[1].location, 'NAVARRE, FL, US');
  assert.equal(result.history[2].status, 'Đã đến cơ sở UPS');
});
test('reads the real UPS Package History shape once and ignores the summary time', () => {
  const current = {
    ...node('Delivered'),
    parentElement: { innerText: 'Wednesday, August 19 Left at the Front Door at 3:08 P.M.', parentElement: null },
  };
  const packageHistory = node([
    'Package History', 'Origin Time',
    '08/19/2026', '1:08 P.M.', 'Delivered', 'DELIVERED', 'NAVARRE, FL, US',
    '08/19/2026', '7:16 A.M.', 'Out for Delivery', 'Out For Delivery Today', 'Milton, FL, United States',
    '08/19/2026', '3:48 A.M.', 'On the Way', 'Loaded on Delivery Vehicle', 'Milton, FL, United States',
    '08/19/2026', '3:43 A.M.', 'Processing at UPS Facility', 'Milton, FL, United States',
    '08/12/2026', '7:47 P.M.', 'We Have Your Package', 'Arrived at Facility', 'Fremont, CA, United States',
    '08/12/2026', '3:23 P.M.', 'Dropped off at UPS Access Point by Customer',
    'The UPS Access Point location has prepared the package for return to UPS or pickup by UPS.', 'Fremont, CA, United States',
    '08/12/2026', '3:23 P.M.', 'Drop-Off', 'Fremont, CA, United States',
    '08/12/2026', '2:10 A.M.', 'Label Created', 'Shipper created a label, UPS has not received the package yet.', 'United States',
  ].join('\n'));
  const result = reader()(doc(`${code}\nDelivered`, {
    '#st_App_PkgSts': [current],
    '#stApp_ShpmtProg_LVP': [packageHistory],
  }), code);
  assert.equal(result.history.length, 8);
  assert.equal(result.history[0].rawStatus, 'Delivered');
  assert.equal(result.history[0].date, '08/19/2026');
  assert.match(result.history[0].time, /1:08 P\.M/i);
  assert.doesNotMatch(result.history[0].details || '', /DELIVERED|Copy Tracking/i);
  assert.match(result.history[2].details, /Loaded on Delivery Vehicle/);
  assert.equal(result.history[5].status, 'Đã gửi tại UPS Access Point');
  assert.equal(result.history[6].rawStatus, 'Drop-Off');
  assert.equal(result.history[7].status, 'Đã tạo nhãn');
  assert.equal(result.history[7].location, 'United States');
});
test('does not turn undated progress labels into journey history', () => {
  const progress = node('Label Created\nOn the Way\nOut for Delivery\nDelivered');
  const result = reader()(doc(`${code}\nDelivered`, {
    '#st_App_PkgSts': [node('Delivered')],
    'app-shipment-progress': [progress],
  }), code);
  assert.equal(result.history.length, 1);
  assert.equal(result.history[0].rawStatus, 'Delivered');
  assert.equal(result.history[0].date, undefined);
});
test('keeps unknown dated scan descriptions instead of dropping journey events', () => {
  const timeline = node([
    '09/09/2026', '10:15 A.M.', 'Package transferred to a local agent', 'ORLANDO, FL, US',
    '09/09/2026', '8:10 A.M.', 'Processing at UPS Facility', 'ORLANDO, FL, US',
  ].join('\n'));
  const result = reader()(doc(`${code}\nOn the Way`, {
    '#st_App_PkgSts': [node('On the Way')],
    'app-shipment-progress-details': [timeline],
  }), code);
  assert.equal(result.history.length, 3);
  assert.equal(result.history[0].status, 'Đang vận chuyển');
  assert.equal(result.history[1].status, 'Package transferred to a local agent');
  assert.equal(result.history[1].location, 'ORLANDO, FL, US');
  assert.equal(result.history[2].status, 'Đang xử lý tại cơ sở UPS');
});
test('opens UPS Show Details and waits for the dated history before returning', () => {
  const attributes = new Map();
  let clicked = false;
  const control = {
    ...node('Show Details'),
    click: () => { clicked = true; },
    getAttribute: (name) => attributes.get(name) || null,
  };
  const documentElement = {
    getAttribute: (name) => attributes.get(name) || null,
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const page = doc(`${code}\nDelivered`, {
    'button, a, [role="button"]': [control],
    '#st_App_PkgSts': [node('Delivered')],
  });
  page.documentElement = documentElement;
  const result = reader()(page, code, true);
  assert.equal(clicked, true);
  assert.equal(result.pending, true);
  assert.equal(result.reason, 'DETAILS_EXPANDING');
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

