/* Runs in the isolated extension world. Never infer status from the full milestone list. */
function readUpsDocument(doc, code, diagnose = false) {
  if (!doc) {
    const currentUrl = new URL(location.href);
    const currentCode = currentUrl.searchParams.get('tracknum')?.toUpperCase();
    if (!['https://www.ups.com', 'https://ups.com'].includes(currentUrl.origin)
      || !currentUrl.pathname.startsWith('/track')
      || (currentCode && currentCode !== code)) {
      return { ok: false, fatal: true, error: 'Tab UPS đã chuyển trang hoặc không khớp mã yêu cầu.' };
    }
  }
  doc = doc || document;
  const pending = (reason) => diagnose ? { pending: true, reason, readerVersion: '0.1.7' } : null;
  const visible = (node) => node && node.getClientRects().length > 0;
  const body = doc.body?.innerText || '';
  if (/access denied|verify you are human|verify you're human|unusual traffic|robot verification|security check|temporarily blocked/i.test(body)) {
    return { ok: false, fatal: true, error: 'UPS yêu cầu xác minh hoặc đang chặn truy cập. Mở UPS để kiểm tra rồi thử lại.' };
  }
  if (/we could not locate|could not find.*shipment|tracking number.*not valid|invalid tracking number|unable to locate.*shipment/i.test(body)) {
    return { ok: false, error: 'UPS không tìm thấy mã vận đơn này.' };
  }
  // Bind the result to a visibly rendered tracking number, not just the requested URL.
  if (!/^[A-Z0-9]{7,34}$/.test(code)
    || !new RegExp(`(?:^|[^A-Z0-9])${code}(?:$|[^A-Z0-9])`).test(body.toUpperCase())) return pending('CODE_NOT_VISIBLE');
  const selectors = [
    'app-header-tile #stApp_nameKey',
    '#st_App_PkgSts', '#st_App_PkgSts span',
    '[data-testid="shipment-status"]', '[data-testid="package-status"]',
  ];
  let candidates = selectors.flatMap((selector) => [...doc.querySelectorAll(selector)]).filter(visible);
  // New UPS layout: status heading and tracking number share a compact banner.
  if (!candidates.length) candidates = [...doc.querySelectorAll('h1, h2, h3, [role="heading"]')].filter((heading) => {
    if (!visible(heading)) return false;
    let parent = heading.parentElement;
    for (let depth = 0; parent && depth < 3; depth++, parent = parent.parentElement) {
      const text = (parent.innerText || '').trim();
      if (text.length <= 250 && new RegExp(`(?:^|[^A-Z0-9])${code}(?:$|[^A-Z0-9])`).test(text.toUpperCase())) return true;
    }
    return false;
  });
  // Semantic current markers are allowed; ordinary timeline labels are not.
  if (!candidates.length) candidates = [...doc.querySelectorAll('[aria-current="step"], [aria-current="true"]')].filter(visible);
  const statuses = new Map([
    ['delivered', 'Đã giao hàng'], ['out for delivery', 'Đang giao hàng'],
    ['on the way', 'Đang vận chuyển'], ['shipped', 'Đã gửi hàng'],
    ['in transit', 'Đang vận chuyển'], ['label created', 'Đã tạo nhãn'],
    ['we have your package', 'UPS đã nhận hàng'],
    ['dropped off at ups access point by customer', 'Đã gửi tại UPS Access Point'],
    ['exception', 'Có sự cố'], ['delivery exception', 'Có sự cố giao hàng'],
    ['delay', 'Bị chậm'], ['delayed', 'Bị chậm'],
    ['return to sender', 'Hoàn về người gửi'], ['returned to sender', 'Đã hoàn về người gửi'],
  ]);
  const statusText = (node) => {
    if (!node.cloneNode) return node.innerText;
    const copy = node.cloneNode(true);
    // Material icon ligatures (e.g. check_circle) are text in the DOM, not status.
    copy.querySelectorAll('.icon, .material-icons, .ups-material-symbols, [aria-hidden="true"], .sr-only')
      .forEach((icon) => icon.remove());
    return copy.textContent || '';
  };
  const matches = candidates.map((node) => statusText(node).replace(/\s+/g, ' ').trim())
    .filter((text) => statuses.has(text.toLowerCase()));
  const unique = [...new Set(matches.map((text) => text.toLowerCase()))];
  if (unique.length !== 1) return pending(`STATUS_NOT_RESOLVED candidates=${candidates.length} recognized=${unique.join('|') || 'none'}`);
  return { ok: true, code, status: statuses.get(unique[0]), rawStatus: matches[0], checkedAt: new Date().toISOString() };
}
globalThis.readUpsDocument = readUpsDocument;
