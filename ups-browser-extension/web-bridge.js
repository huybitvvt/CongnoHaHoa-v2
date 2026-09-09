(() => {
  if (window.__HAHOA_UPS_BRIDGE__) return;
  window.__HAHOA_UPS_BRIDGE__ = true;
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin
      || data?.source !== 'hahoa-ups-page' || typeof data.requestId !== 'string'
      || !['ping', 'track'].includes(data.action)) return;
    const respond = (result) => window.postMessage({
      source: 'hahoa-ups-extension', requestId: data.requestId, ...result,
    }, location.origin);
    try {
      chrome.runtime.sendMessage({ type: 'HAHOA_UPS', action: data.action, code: data.code, mode: data.mode, fresh: data.fresh, automatic: data.automatic }, (result) => {
        const error = chrome.runtime.lastError;
        respond(error ? { ok: false, fatal: true, error: 'Tiện ích bị ngắt. Tải lại tiện ích và trang web.' }
          : result || { ok: false, fatal: true, error: 'Tiện ích không phản hồi.' });
      });
    } catch {
      respond({ ok: false, fatal: true, error: 'Hãy tải lại trang sau khi cập nhật tiện ích.' });
    }
  });
})();
