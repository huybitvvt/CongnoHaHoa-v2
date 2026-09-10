// Destination-only browser smoke test for the UPS order controls. No session or key is logged.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
if (project !== 'skcnduuulyjeexwavbnd.supabase.co') throw new Error('UI test only allows the destination SpeeGo project.');

const pageUrl = process.env.SPEEGO_UI_URL || 'http://127.0.0.1:3000/tracking-ups';
const debugPort = Number(process.env.SPEEGO_UI_DEBUG_PORT || 9330);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const testCode = `1ZUITEST${Date.now().toString(36).toUpperCase()}`;

const { data: profile } = await admin.from('profiles').select('id').eq('role', 'admin').limit(1).single();
if (!profile) throw new Error('No existing destination admin available.');
const { data: existing } = await admin.auth.admin.getUserById(profile.id);
if (!existing.user?.email) throw new Error('Destination admin has no email.');
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: existing.user.email });
if (linkError) throw new Error('Cannot prepare local UI test session.');
const { data: auth, error: authError } = await db.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError || !auth.session) throw new Error('Local UI test sign-in unavailable.');

const { data: orderDates, error: datesError } = await admin.from('speego').select('order_date').order('order_date');
if (datesError || !orderDates?.length) throw new Error('Destination speego table has no dates to test.');
const frequency = (keys) => keys.reduce((result, key) => result.set(key, (result.get(key) || 0) + 1), new Map());
const topKey = (counts) => [...counts].sort((a, b) => b[1] - a[1])[0];
const [testMonth, expectedMonthRows] = topKey(frequency(orderDates.map((row) => row.order_date.slice(0, 7))));
const [testDay, expectedDayRows] = topKey(frequency(orderDates.map((row) => row.order_date.slice(0, 10))));

const version = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then((response) => response.json());
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const callbacks = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (callbacks.has(message.id)) callbacks.get(message.id)(message);
};
async function call(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { callbacks.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20_000);
    callbacks.set(id, (message) => {
      clearTimeout(timer); callbacks.delete(id);
      if (message.error) reject(new Error(`CDP failed: ${method}`));
      else resolve(message.result);
    });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(sessionId, expression) {
  const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  return response.result?.value;
}
async function waitFor(sessionId, expression, timeout = 40_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await evaluate(sessionId, expression);
    if (value) return value;
    await sleep(500);
  }
  throw new Error('UI condition timed out.');
}

const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
try {
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Page.enable', {}, sessionId);
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  const storageKey = `sb-${project.split('.')[0]}-auth-token`;
  const origin = new URL(pageUrl).origin;
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `if(location.origin===${JSON.stringify(origin)})localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(auth.session))});`,
  }, sessionId);
  await call('Page.navigate', { url: pageUrl }, sessionId);
  await waitFor(sessionId, `Boolean(document.querySelector('.speego-quick-add') && document.querySelector('.speego-orders-table tbody tr'))`);
  await waitFor(sessionId, `document.querySelector('.ups-connection-state small')?.textContent.includes('Đồng bộ Supabase')`);

  const controls = await evaluate(sessionId, `JSON.stringify({
    quickAdd:!!document.querySelector('.speego-quick-add textarea[aria-label="Danh sách mã vận đơn UPS"]'),
    day:!!document.querySelector('input[aria-label="Lọc theo ngày tạo đơn"]'),
    month:!!document.querySelector('input[aria-label="Lọc theo tháng tạo đơn"]'),
    manual:!![...document.querySelectorAll('button')].find((button)=>button.textContent.includes('Tạo đơn'))
  })`);

  const setInput = (selector, value) => `(()=>{const input=document.querySelector(${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return input.value})()`;
  await evaluate(sessionId, setInput('input[aria-label="Lọc theo tháng tạo đơn"]', testMonth));
  await sleep(400);
  const actualMonthRows = await evaluate(sessionId, `document.querySelectorAll('.speego-orders-table tbody tr:not(:has(.ups-orders-empty))').length`);
  const monthDiagnostic = await evaluate(sessionId, `JSON.stringify({month:document.querySelector('input[aria-label="Lọc theo tháng tạo đơn"]')?.value,day:document.querySelector('input[aria-label="Lọc theo ngày tạo đơn"]')?.value,period:document.querySelector('select[aria-label="Lọc khoảng thời gian"]')?.value,empty:document.querySelector('.ups-orders-empty')?.textContent||''})`);
  await evaluate(sessionId, setInput('input[aria-label="Lọc theo ngày tạo đơn"]', testDay));
  await sleep(400);
  const actualDayRows = await evaluate(sessionId, `document.querySelectorAll('.speego-orders-table tbody tr:not(:has(.ups-orders-empty))').length`);
  if (actualMonthRows !== expectedMonthRows || actualDayRows !== expectedDayRows) {
    throw new Error(`Date filters returned ${actualMonthRows}/${actualDayRows}, expected ${expectedMonthRows}/${expectedDayRows}; month state ${monthDiagnostic}.`);
  }

  await evaluate(sessionId, setInput('input[aria-label="Lọc theo ngày tạo đơn"]', ''));
  const quickSelector = 'textarea[aria-label="Danh sách mã vận đơn UPS"]';
  await evaluate(sessionId, `(()=>{const input=document.querySelector(${JSON.stringify(quickSelector)});const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(input,${JSON.stringify(testCode)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);
  await evaluate(sessionId, `(()=>{document.querySelector('.speego-quick-add .speego-create-btn').click();return true})()`);

  let insertedRow;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(500);
    const { data } = await admin.from('speego').select('tracking_code,order_id,order_date,shipping_unit,collected').eq('tracking_code', testCode).maybeSingle();
    if (data) { insertedRow = data; break; }
  }
  if (!insertedRow) throw new Error('Quick-add did not insert into destination speego.');
  const notice = await evaluate(sessionId, `document.querySelector('[role="status"]')?.textContent || ''`);
  if (!notice.includes('Đã thêm 1 mã')) throw new Error('Quick-add success notice was not rendered.');

  await call('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 1440, height: 1500, scale: 1 },
    captureBeyondViewport: true,
  }, sessionId).then((shot) => fs.writeFileSync('.runner-data/orders-ui-check.png', Buffer.from(shot.data, 'base64')));

  console.log(JSON.stringify({
    controls: JSON.parse(controls),
    monthFilter: { value: testMonth, expected: expectedMonthRows, rendered: actualMonthRows },
    dayFilter: { value: testDay, expected: expectedDayRows, rendered: actualDayRows },
    quickAdd: {
      inserted: true,
      code: `…${testCode.slice(-4)}`,
      validOrderId: /^#[A-Z0-9-]{2,31}$/.test(insertedRow.order_id),
      shippingUnit: insertedRow.shipping_unit,
      collected: insertedRow.collected,
    },
    screenshot: '.runner-data/orders-ui-check.png',
  }, null, 2));
} finally {
  await admin.from('speego').delete().eq('tracking_code', testCode);
  await call('Target.closeTarget', { targetId }).catch(() => {});
  socket.close();
  await db.auth.signOut({ scope: 'local' });
}
