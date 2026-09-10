import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { Queue, mergeHistory } from './queue.mjs';
import { AdaptiveLimit, profileLimit } from './adaptive.mjs';
import { shouldDiscard } from './observations.mjs';
import { clampProfiles, profileIds, profileIsEnabled, profileNumber } from './profiles.mjs';

const VERSION = '0.4.4';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = process.env.SPEEGO_RUNNER_ENV || path.join(root, '.env.runner');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env.SPEEGO_RUNNER_SUPABASE_URL;
const key = process.env.SPEEGO_RUNNER_SUPABASE_KEY;
if (!url || !key) throw new Error('Thiếu .env.runner. Xem runner/README.md.');
// Never allow this coordinator to write to the source project.
if (new URL(url).hostname !== 'skcnduuulyjeexwavbnd.supabase.co') throw new Error('Chỉ cho phép Supabase đích SpeeGo.');
const dataDir = path.resolve(process.env.SPEEGO_RUNNER_DATA || path.join(root, '.runner-data'));
fs.mkdirSync(dataDir, { recursive: true });
const port = Number(process.env.SPEEGO_RUNNER_PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('SPEEGO_RUNNER_PORT phải là số từ 1024 đến 65535.');
const origin = `http://127.0.0.1:${port}`;
const configuredProfiles = clampProfiles(process.env.SPEEGO_RUNNER_PROFILES || 3);
const perProfile = Math.max(1, Math.min(10, Number(process.env.SPEEGO_RUNNER_TABS || 10)));
if (!Number.isInteger(configuredProfiles) || !Number.isInteger(perProfile)) throw new Error('Số profile/tab phải là số nguyên.');
const configuredMaxTabs = Math.min(30, configuredProfiles * perProfile);
const browser = process.env.SPEEGO_RUNNER_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
].find((file) => fs.existsSync(file));
if (!browser) throw new Error('Không tìm thấy Chrome. Đặt SPEEGO_RUNNER_BROWSER.');
const secretPath = path.join(dataDir, 'local-token');
if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, randomBytes(32).toString('hex'), { mode: 0o600 });
const secret = fs.readFileSync(secretPath, 'utf8').trim();
const ownerPath = path.join(dataDir, 'owner-id');
let owner = fs.existsSync(ownerPath) ? fs.readFileSync(ownerPath, 'utf8').trim() : '';
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(owner)) {
  owner = randomUUID();
  fs.writeFileSync(ownerPath, owner, { mode: 0o600 });
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) } });
const queue = new Queue(path.join(dataDir, 'queue.sqlite'), { stopDelivered: process.env.SPEEGO_RUNNER_STOP_DELIVERED === 'true' });
let enabled = false, connectedAt = 0, controlAt = 0, lastSync = 0, lastHeartbeat = 0, busy = false, closing = false;
// Apply the hard memory ceiling before an already-open worker can reconnect and claim work.
const controller = new AdaptiveLimit(configuredMaxTabs, Date.now(), os.freemem() / 1024 ** 2);
let requested = 30, requestedProfiles = configuredProfiles, adaptive = controller.limit, cooldownUntil = queue.setting('cooldownUntil') || 0;
let lastError = '', lastOutbox = 0;
const bootAt = Date.now();
const workers = new Map();
const launches = new Map();
const validWorker = (worker) => profileNumber(worker) > 0 && profileNumber(worker) <= configuredProfiles;
const now = () => Date.now();
const activeMaxTabs = () => Math.min(30, requestedProfiles * perProfile);
const log = (message) => {
  const line = `${new Date().toISOString()} ${message}\n`;
  process.stdout.write(line);
  const target = path.join(dataDir, 'runner.log');
  if (fs.existsSync(target) && fs.statSync(target).size > 5_000_000) fs.renameSync(target, `${target}.previous`);
  fs.appendFileSync(target, line);
};
const status = () => ({ ...queue.stats(), enabled, connected: now() - connectedAt < 60_000,
  concurrency: Math.min(requested, adaptive, activeMaxTabs()), requestedConcurrency: requested, maxTabs: activeMaxTabs(),
  freeMemoryMB: Math.round(os.freemem() / 1024 ** 2),
  cooldownUntil, lastError, lastSync: lastSync ? new Date(lastSync).toISOString() : null,
  workers: profileIds(requestedProfiles).map((id) => {
    const worker = workers.get(id);
    return { id, online: Boolean(worker && now() - worker.at < 20_000), extension: worker?.version || '' };
  }),
  uptimeSeconds: Math.round(process.uptime()), version: VERSION, adaptationReason: controller.reason,
  profiles: requestedProfiles, configuredProfiles, perProfile });

function launch(worker) {
  if (!profileIsEnabled(worker, requestedProfiles, configuredProfiles)) return;
  const profileDir = path.join(dataDir, 'profiles', worker);
  const link = `${origin}/worker#${secret}:${worker}`;
  const child = spawn(browser, [`--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check',
    '--disable-sync',
    ...(process.env.SPEEGO_RUNNER_DEBUG_PORT ? [`--remote-debugging-port=${Number(process.env.SPEEGO_RUNNER_DEBUG_PORT) + Number(worker.slice(8)) - 1}`] : []),
    `--load-extension=${path.join(root, 'ups-browser-extension')}`, '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--app=${link}`],
  { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => { lastError = 'Không mở được trình duyệt. Kiểm tra đường dẫn trong .env.runner.'; });
  child.unref();
  launches.set(worker, now());
}

function changeProfiles(value) {
  const next = clampProfiles(value, configuredProfiles);
  if (next === requestedProfiles) return;
  const previous = requestedProfiles;
  requestedProfiles = next;
  if (next < previous) {
    for (let index = next + 1; index <= previous; index++) {
      launches.delete(`profile-${index}`);
      workers.delete(`profile-${index}`);
    }
  } else {
    for (let index = previous + 1; index <= next; index++) {
      const worker = `profile-${index}`;
      launches.delete(worker); workers.delete(worker); launch(worker);
    }
  }
  log(`Đổi số profile hoạt động: ${previous} → ${next}.`);
}

async function refresh() {
  const rows = [];
  let cursor;
  for (;;) {
    let query = supabase.from('speego')
      .select('id,tracking_code,status,raw_status,checked_at,edd,error').order('id').limit(500);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw new Error(`Đọc bảng đích: ${error.message}`);
    rows.push(...data);
    if (data.length < 500) break;
    cursor = data[data.length - 1].id;
    if (rows.length >= 100_000) throw new Error('Vượt giới hạn an toàn 100.000 đơn; chưa thay hàng đợi.');
  }
  queue.sync(rows);
  lastSync = now();
}

async function upload() {
  for (const item of queue.pending()) {
    const result = JSON.parse(item.payload);
    const fields = 'id,tracking_code,status,raw_status,checked_at,edd,error'
      + (result.ok && result.mode === 'full' ? ',history' : '');
    const { data: current, error: readError } = await supabase.from('speego')
      .select(fields).eq('id', item.job_id).maybeSingle();
    if (readError) throw new Error(`Đọc trước khi lưu: ${readError.message}`);
    if (shouldDiscard(item, current)) { queue.discard(item, current); continue; }
    const patch = result.ok ? {
      status: result.status, raw_status: result.rawStatus, checked_at: result.checkedAt, error: null,
      ...(result.edd ? { edd: result.edd } : {}),
      ...(result.mode === 'full' ? { history: mergeHistory(current.history || [], result.history) } : {}),
    } : { error: result.error };
    let update = supabase.from('speego').update(patch).eq('id', item.job_id).eq('tracking_code', item.code);
    update = current.checked_at ? update.eq('checked_at', current.checked_at) : update.is('checked_at', null);
    const { data, error } = await update.select('id');
    if (error) throw new Error(`Lưu kết quả: ${error.message}`);
    if (!data.length) continue; // Compare-and-swap lost: re-read on the next upload pass.
    queue.acknowledge(item, { ...current, ...patch });
  }
}

function adapt() {
  const stats = queue.stats();
  adaptive = controller.evaluate({ now: now(), max: Math.min(requested, activeMaxTabs()),
    freeMB: os.freemem() / 1024 ** 2, active: stats.active, due: stats.due,
    enabled: enabled && now() - controlAt < 60000 && now() >= cooldownUntil, outbox: stats.outbox });
}

async function tick() {
  if (busy || closing) return;
  busy = true;
  try {
    if (now() - lastHeartbeat >= 10_000) {
      const { data, error } = await supabase.rpc('speego_runner_heartbeat', {
        p_owner: owner, p_machine: os.hostname(), p_stats: status(),
      });
      if (error) throw new Error(`Bộ điều khiển Supabase chưa sẵn sàng: ${error.message}`);
      lastHeartbeat = now();
      if (!data?.length) { enabled = false; connectedAt = 0; lastError = 'Một phiên khác đang giữ quyền chạy. Sau khi phiên đó ngừng, có thể cần chờ tối đa 5 phút.'; return; }
      enabled = data[0].enabled;
      requested = data[0].requested_concurrency;
      changeProfiles(data[0].requested_profiles);
      connectedAt = now(); controlAt = now();
    }
    if (!connectedAt || now() - connectedAt > 60_000) return;
    if (now() - lastSync > 60_000) await refresh();
    if (now() - lastOutbox > 1000) { await upload(); lastOutbox = now(); }
    lastError = '';
  } catch (error) {
    const message = String(error.message || error).slice(0, 400);
    if (lastError !== message) log(message);
    lastError = message;
  } finally { busy = false; }
}

async function body(request) {
  let data = '';
  for await (const chunk of request) {
    data += chunk;
    if (data.length > 256_000) throw new Error('Payload too large');
  }
  return JSON.parse(data || '{}');
}
function authenticated(request) {
  const token = (request.headers.authorization || '').replace(/^Bearer /, '');
  const a = Buffer.from(token), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const reply = (code, value) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
  if (request.headers.host !== `127.0.0.1:${port}` || (request.headers.origin && request.headers.origin !== origin)) return reply(403, { error: 'Origin denied' });
  const pathname = new URL(request.url, origin).pathname;
  if (request.method === 'GET' && ['/', '/worker', '/client.js', '/style.css'].includes(pathname)) {
    const file = pathname === '/client.js' ? 'client.js' : pathname === '/style.css' ? 'style.css' : 'index.html';
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
    return response.end(fs.readFileSync(path.join(root, 'runner', file)));
  }
  if (!authenticated(request)) return reply(401, { error: 'Unauthorized' });
  try {
    if (request.method === 'GET' && pathname === '/status') return reply(200, status());
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    const input = await body(request);
    if (pathname === '/control') {
      const patch = {};
      if (typeof input.enabled === 'boolean') patch.enabled = input.enabled;
      if (Number.isInteger(input.concurrency) && input.concurrency >= 1 && input.concurrency <= 30) patch.requested_concurrency = input.concurrency;
      if (Number.isInteger(input.profiles) && input.profiles >= 1 && input.profiles <= configuredProfiles) patch.requested_profiles = input.profiles;
      const { error } = await supabase.from('speego_runner').update(patch).eq('id', true);
      if (error) throw error;
      if (input.enabled === false) enabled = false;
      if (patch.requested_profiles) changeProfiles(patch.requested_profiles);
      lastHeartbeat = 0;
      return reply(200, { ok: true });
    }
    if (!validWorker(input.worker)) return reply(400, { error: 'Invalid worker' });
    if (pathname === '/claim') {
      if (!profileIsEnabled(input.worker, requestedProfiles, configuredProfiles)) return reply(200, { job: null, shutdown: true });
      workers.set(input.worker, { at: now(), version: input.version });
      const stats = status();
      if (!enabled || now() - controlAt > 60_000 || now() - lastSync > 180_000 || input.version !== '0.4.0'
        || now() < cooldownUntil || stats.active >= stats.concurrency || stats.outbox >= activeMaxTabs()) return reply(200, { job: null, status: stats });
      const localActive = queue.db.prepare('SELECT count(*) n FROM jobs WHERE worker=? AND token IS NOT NULL').get(input.worker).n;
      const onlineProfiles = [...workers].filter(([id, worker]) => profileIsEnabled(id, requestedProfiles, configuredProfiles)
        && now() - worker.at < 20000 && worker.version === '0.4.0').length;
      if (localActive >= profileLimit(stats.concurrency, now() - bootAt < 30000 ? requestedProfiles : onlineProfiles, perProfile)) return reply(200, { job: null });
      return reply(200, { job: queue.claim(input.worker) });
    }
    if (pathname === '/result') {
      const duplicate = queue.db.prepare('SELECT 1 FROM outbox WHERE token=?').get(String(input.token || ''));
      const accepted = queue.receive(input.worker, input.token, input.result);
      if (accepted && !duplicate) {
        const outcome = queue.outcome(input.token);
        controller.record(outcome?.ok === true);
        if (/xác minh|chặn truy cập|access denied|verify.*human|unusual traffic/i.test(outcome?.error || '')) {
          cooldownUntil = now() + 30 * 60_000;
          queue.setting('cooldownUntil', cooldownUntil);
          adaptive = controller.limit = 1;
          controller.probe = null; controller.reset(now());
          log('UPS yêu cầu xác minh: nghỉ toàn bộ 30 phút, giảm tải về 1 tab.');
        }
      }
      return reply(200, { accepted });
    }
    return reply(404, { error: 'Not found' });
  } catch { return reply(500, { error: 'Yêu cầu thất bại. Kiểm tra trạng thái bộ chạy.' }); }
});
server.on('error', (error) => { log(error.code === 'EADDRINUSE' ? 'Bộ chạy đã mở hoặc cổng đang bận.' : 'Không mở được máy chủ cục bộ.'); process.exit(1); });
server.listen(port, '127.0.0.1', () => {
  log(`SpeeGo runner ${VERSION}; tối đa ${configuredProfiles} profile / ${configuredMaxTabs} tab. Dữ liệu: ${dataDir}`);
  // This file stays on this machine; never include it in a downloadable bundle.
  fs.writeFileSync(path.join(dataDir, 'open-dashboard.url'), `[InternetShortcut]\nURL=${origin}/#${secret}\n`);
  void tick();
});
const timer = setInterval(() => {
  if (closing) return;
  // Allow already-open worker pages to reconnect after a coordinator restart.
  if (now() - bootAt > 5000) for (let i = 1; i <= requestedProfiles; i++) {
    const worker = `profile-${i}`;
    if (!launches.has(worker) && workers.has(worker)) launches.set(worker, now());
    if (!launches.has(worker) || (workers.has(worker) && now() - workers.get(worker).at > 90_000
      && now() - launches.get(worker) > 180_000)) launch(worker);
  }
  adapt();
  void tick();
}, 1000);
async function stop() {
  closing = true; enabled = false; clearInterval(timer);
  server.close();
  // Keep durable leases/outbox. A new coordinator waits for the remote lease to expire.
  log('Đang dừng. Hàng đợi và kết quả chưa gửi được giữ trên ổ đĩa.');
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
