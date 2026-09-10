/* The loopback coordinator is the durable scheduler; this page only executes leased jobs. */
(() => {
  const [token, worker] = location.hash.slice(1).split(':');
  if (!token) { document.getElementById('error').textContent = 'Mở file .runner-data/open-dashboard.url trên máy này.'; return; }
  let version = '', active = 0, polling = false, hadConnection = false, failedPings = 0, shutdown = false;
  const request = (action, job = {}) => new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const receive = (event) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'hahoa-ups-extension'
        || event.data.requestId !== requestId) return;
      clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('message', receive);
      resolve({ ok: false, error: 'Tiện ích không phản hồi trong thời hạn.' });
    }, action === 'ping' ? 3000 : 90_000);
    window.addEventListener('message', receive);
    window.postMessage({ source: 'hahoa-ups-page', requestId, action, ...job, fresh: true, automatic: true }, location.origin);
  });
  async function api(route, data) {
    const response = await fetch(route, { method: data ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Không kết nối được bộ chạy.');
    return response.json();
  }
  // Keep a browser-side copy too when the coordinator itself restarts before receiving a result.
  const storageKey = `speego-outbox:${worker}`;
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); }
  catch { document.getElementById('error').textContent = 'Bản sao tạm trên trình duyệt không đọc được. Hàng đợi trên máy vẫn được giữ.'; }
  const pending = new Map(Array.isArray(saved) ? saved.filter((item) => Array.isArray(item) && item.length === 2) : []);
  const persist = () => localStorage.setItem(storageKey, JSON.stringify([...pending]));
  async function flush() {
    for (const [id, result] of pending) {
      await api('/result', { worker, token: id, result });
      pending.delete(id); persist();
    }
  }
  async function execute(job) {
    active++;
    try {
      const result = await request('track', job);
      if (!result.ok && /tiện ích|extension/i.test(result.error || '')) version = '';
      pending.set(job.token, result); persist();
      await flush();
    } catch (error) { document.getElementById('error').textContent = error.message; }
    finally {
      active--;
      if (shutdown && !active) window.close();
    }
  }
  async function poll() {
    if (polling || !worker) return;
    if (shutdown) { if (!active) window.close(); return; }
    polling = true;
    try {
      if (!version) {
        const ping = await request('ping'); version = ping.ok ? ping.version : '';
        if (version) { hadConnection = true; failedPings = 0; }
        else if (hadConnection && ++failedPings >= 3 && !active) { location.reload(); return; }
      }
      await flush();
      const { job, shutdown: shouldClose } = await api('/claim', { worker, version });
      if (shouldClose) {
        shutdown = true;
        document.getElementById('worker').textContent = `${worker} · Đang đóng theo cấu hình số profile`;
        if (!active) window.close();
        return;
      }
      if (job) void execute(job);
      document.getElementById('worker').textContent = `${worker} · Extension ${version || 'chưa kết nối'} · ${active} tab đang xử lý`;
    } catch { version = ''; }
    finally { polling = false; }
  }
  async function render() {
    try {
      const s = await api('/status');
      document.getElementById('connection').textContent = !s.connected ? 'Chưa kết nối Supabase / đang chờ quyền chạy'
        : s.cooldownUntil > Date.now() ? 'Đang nghỉ do UPS yêu cầu xác minh' : s.enabled ? 'Tự động đang bật' : 'Đã tạm dừng';
      document.getElementById('error').textContent = s.lastError;
      if (document.activeElement.id !== 'concurrency') document.getElementById('concurrency').value = s.requestedConcurrency;
      if (document.activeElement.id !== 'profiles') document.getElementById('profiles').value = s.profiles;
      const metrics = [['Tổng đơn', s.total], ['Đến hạn', s.due], ['Đang xử lý', s.active], ['Tab cho phép', s.concurrency],
        ['Chờ gửi Supabase', s.outbox], ['Thành công / phút (15p)', s.successfulPerMinute], ['Lỗi trong 15p', s.failed], ['95% lượt dưới (giây)', s.p95Seconds]];
      const nodes = metrics.map(([label, value]) => {
        const node = document.createElement('div'); node.className = 'metric'; node.textContent = label;
        const number = document.createElement('strong'); number.textContent = value ?? 0; node.append(number); return node;
      });
      document.getElementById('metrics').replaceChildren(...nodes);
    } catch { document.getElementById('connection').textContent = 'Bộ chạy đã ngắt. Đang kết nối lại…'; }
  }
  const control = (data) => api('/control', data).then(render).catch((e) => { document.getElementById('error').textContent = e.message; });
  document.getElementById('start').onclick = () => control({ enabled: true });
  document.getElementById('stop').onclick = () => control({ enabled: false });
  document.getElementById('concurrency').onchange = (event) => control({ concurrency: Number(event.target.value) });
  document.getElementById('profiles').onchange = (event) => control({ profiles: Number(event.target.value) });
  setInterval(poll, 250); setInterval(render, 3000); void poll(); void render();
})();
