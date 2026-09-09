// Creates a test sign-in link for an EXISTING destination admin, without sending email.
// No source project is accessed. Sessions never go to stdout.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
const dest = parseEnv(fs.readFileSync('.env.local', 'utf8'));
const db = createClient(dest.NEXT_PUBLIC_SUPABASE_URL, dest.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(dest.NEXT_PUBLIC_SUPABASE_URL, dest.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: profile } = await admin.from('profiles').select('id').eq('role', 'admin').limit(1).single();
if (!profile) throw new Error('No existing admin available.');
const { data: existing } = await admin.auth.admin.getUserById(profile.id);
if (!existing.user?.email) throw new Error('Admin has no email.');
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: existing.user.email });
if (linkError) throw new Error('Cannot prepare local test session.');
const { data, error } = await db.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (error || !data.session) throw new Error('Local admin sign-in unavailable.');
const version = await fetch('http://127.0.0.1:9323/json/version').then((r) => r.json());
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const callbacks = new Map();
socket.onmessage = (event) => { const msg = JSON.parse(event.data); if (callbacks.has(msg.id)) callbacks.get(msg.id)(msg); };
async function call(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { callbacks.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20_000);
    callbacks.set(id, (msg) => { clearTimeout(timer); callbacks.delete(id); if (msg.error) reject(new Error(`CDP failed: ${method}`)); else resolve(msg.result); });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
try {
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Page.enable', {}, sessionId);
  const storageKey = `sb-${new URL(dest.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.origin==='https://cong-no-ha-hoa-v2.vercel.app')localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(data.session))});` }, sessionId);
  await call('Page.navigate', { url: 'https://cong-no-ha-hoa-v2.vercel.app/tracking-ups' }, sessionId);
  let panel;
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await call('Runtime.evaluate', { expression: `(()=>{const p=document.querySelector('.ups-runner-panel');if(!p)return null;const r=p.getBoundingClientRect();return {text:p.innerText,x:r.x,y:r.y+scrollY,width:r.width,height:r.height};})()`, returnByValue: true }, sessionId);
    panel = response.result?.value;
    if (panel?.text.includes('profile-')) break;
  }
  if (!panel) {
    const diagnostic = await call('Runtime.evaluate', { expression: `JSON.stringify({origin:location.origin,path:location.pathname,title:document.title,ready:document.readyState,loginForm:!!document.querySelector('input[type=password]'),hasSession:!!localStorage.getItem(${JSON.stringify(storageKey)}),bodyStart:document.body?.innerText.slice(0,160)})`, returnByValue: true }, sessionId);
    console.log(diagnostic.result?.value);
    throw new Error('Runner panel was not rendered.');
  }
  console.log({ runnerPanelRendered: true, profilesVisible: /profile-/.test(panel.text), controlsPresent: /Tạm dừng tự động|Bật tự động/.test(panel.text),
    downloadPresent: /Tải bộ chạy máy nhà/.test(panel.text) });
  const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: Math.max(0, panel.x), y: Math.max(0, panel.y), width: panel.width, height: panel.height, scale: 1 } }, sessionId);
  fs.writeFileSync('.runner-data/web-panel.png', Buffer.from(shot.data, 'base64'));
} finally {
  await call('Target.closeTarget', { targetId }); socket.close(); await db.auth.signOut({ scope: 'local' });
}
