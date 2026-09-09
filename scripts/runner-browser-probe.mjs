// Read-only diagnostic of the dedicated runner browser. Never prints worker URLs/tokens or customer data.
import fs from 'node:fs';
const port = Number(process.env.SPEEGO_PROBE_PORT || 9322);
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP timeout')), 10_000);
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id !== 1) return;
        clearTimeout(timer); resolve(data.result?.result?.value ?? data.error);
      };
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
  } finally { socket.close(); }
}
for (const target of targets.filter((t) => t.type === 'page')) {
  if (target.url.startsWith('http://127.0.0.1:4317/')) {
    console.log('Runner UI:', await evaluate(target, `JSON.stringify({connection:document.getElementById('connection')?.textContent,error:document.getElementById('error')?.textContent,worker:document.getElementById('worker')?.textContent})`));
  } else if (target.url.startsWith('https://www.ups.com/')) {
    console.log('UPS page:', await evaluate(target, `JSON.stringify({ready:document.readyState,chars:document.body?.innerText.length,challenge:/verify.*human|access denied|unusual traffic/i.test(document.body?.innerText||''),errorPage:location.protocol==='chrome-error:',details:document.documentElement.getAttribute('data-hahoa-ups-details-at'),status:document.querySelector('#stApp_nameKey,#st_App_PkgSts')?.innerText})`));
  }
}
if (process.argv.includes('--screenshot')) {
  const target = targets.find((t) => t.url.startsWith('http://127.0.0.1:4317/'));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  await new Promise((resolve) => {
    socket.onmessage = (event) => { const data = JSON.parse(event.data); if (data.id !== 1) return;
      if (data.result?.data) fs.writeFileSync('.runner-data/dashboard.png', Buffer.from(data.result.data, 'base64'));
      resolve(); };
    socket.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });
  socket.close();
}
