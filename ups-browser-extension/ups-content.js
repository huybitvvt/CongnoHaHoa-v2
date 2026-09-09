(() => {
  if (globalThis.__HAHOA_UPS_CONTENT__) return;
  globalThis.__HAHOA_UPS_CONTENT__ = true;

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'HAHOA_UPS_CONTENT' || message.action !== 'read') return false;
    const code = String(message.code || '').trim().toUpperCase();
    try {
      if (typeof globalThis.readUpsDocument !== 'function') {
        respond({ pending: true, reason: 'READER_NOT_READY', readerVersion: '0.1.7' });
        return false;
      }
      respond(globalThis.readUpsDocument(null, code, true));
    } catch (error) {
      respond({
        ok: false,
        fatal: true,
        error: `Không đọc được DOM UPS. Tải lại tab UPS rồi thử lại. Chi tiết: ${String(error?.message || error).slice(0, 220)}`,
      });
    }
    return false;
  });
})();
