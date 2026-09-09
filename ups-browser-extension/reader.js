/* Runs in the isolated extension world. The current status and dated journey history are read separately. */
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
  const READER_VERSION = '0.2.0';
  const pending = (reason) => diagnose ? { pending: true, reason, readerVersion: READER_VERSION } : null;
  const visible = (node) => node && typeof node.getClientRects === 'function' && node.getClientRects().length > 0;
  const queryAll = (root, selector) => {
    try { return [...root.querySelectorAll(selector)]; } catch { return []; }
  };
  const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const cleanNodeText = (node) => {
    const text = String(node?.innerText || node?.textContent || '');
    // Keep innerText line breaks for event parsing while removing common Material icon ligatures.
    return text.replace(/\b(?:check_circle|keyboard_arrow_(?:up|down|left|right)|expand_(?:more|less)|content_copy|local_shipping|radio_button_checked)\b/gi, '');
  };
  const body = doc.body?.innerText || '';
  if (/access denied|verify you are human|verify you're human|unusual traffic|robot verification|security check|temporarily blocked/i.test(body)) {
    return { ok: false, fatal: true, error: 'UPS yêu cầu xác minh hoặc đang chặn truy cập. Mở UPS để kiểm tra rồi thử lại.' };
  }
  if (/we could not locate|could not find.*shipment|tracking number.*not valid|invalid tracking number|unable to locate.*shipment/i.test(body)) {
    return { ok: false, error: 'UPS không tìm thấy mã vận đơn này.' };
  }
  // Bind every result to a visibly rendered tracking number, not just the requested URL.
  if (!/^[A-Z0-9]{7,34}$/.test(code)
    || !new RegExp(`(?:^|[^A-Z0-9])${code}(?:$|[^A-Z0-9])`).test(body.toUpperCase())) return pending('CODE_NOT_VISIBLE');

  // UPS keeps the detailed scan history behind this control on some layouts.
  const detailControl = queryAll(doc, 'button, a, [role="button"]').find((node) => {
    if (!visible(node) || typeof node.click !== 'function') return false;
    const text = compact(cleanNodeText(node) || node.getAttribute?.('aria-label'));
    return /^(show|view)\s+(shipment\s+)?details$|^(xem|hiện)\s+chi tiết$/i.test(text);
  });
  const markerHost = doc.documentElement || detailControl;
  const marker = markerHost?.getAttribute?.('data-hahoa-ups-details-at');
  if (detailControl && detailControl.getAttribute?.('aria-expanded') !== 'true' && !marker) {
    markerHost?.setAttribute?.('data-hahoa-ups-details-at', String(Date.now()));
    detailControl.click();
    return pending('DETAILS_EXPANDING');
  }
  if (marker && Date.now() - Number(marker) < 4000) return pending('DETAILS_LOADING');

  const currentStatuses = new Map([
    ['delivered', 'Đã giao hàng'], ['out for delivery', 'Đang giao hàng'],
    ['on the way', 'Đang vận chuyển'], ['shipped', 'Đã gửi hàng'],
    ['in transit', 'Đang vận chuyển'], ['label created', 'Đã tạo nhãn'],
    ['we have your package', 'UPS đã nhận hàng'],
    ['dropped off at ups access point by customer', 'Đã gửi tại UPS Access Point'],
    ['exception', 'Có sự cố'], ['delivery exception', 'Có sự cố giao hàng'],
    ['delay', 'Bị chậm'], ['delayed', 'Bị chậm'],
    ['return to sender', 'Hoàn về người gửi'], ['returned to sender', 'Đã hoàn về người gửi'],
  ]);
  const eventPatterns = [
    [/^delivered$/i, 'Đã giao hàng'],
    [/^out for delivery(?: today)?$/i, 'Đang giao hàng'],
    [/^(?:on the way|in transit|shipped)$/i, 'Đang vận chuyển'],
    [/^label created$/i, 'Đã tạo nhãn'],
    [/^we have your package$/i, 'UPS đã nhận hàng'],
    [/^dropped off at ups access point by customer$/i, 'Đã gửi tại UPS Access Point'],
    [/^arrived at (?:a )?(?:ups )?facility$/i, 'Đã đến cơ sở UPS'],
    [/^departed from (?:a )?(?:ups )?facility$/i, 'Đã rời cơ sở UPS'],
    [/^(?:processing|processed) at ups facility$/i, 'Đang xử lý tại cơ sở UPS'],
    [/^loaded on delivery vehicle$/i, 'Đã xếp lên xe giao hàng'],
    [/^pickup scan$/i, 'Đã quét nhận hàng'],
    [/^origin scan$/i, 'Đã quét tại điểm gửi'],
    [/^departure scan$/i, 'Đã quét rời điểm UPS'],
    [/^arrival scan$/i, 'Đã quét đến điểm UPS'],
    [/^destination scan$/i, 'Đã quét tại điểm đến'],
    [/^import scan$/i, 'Đã quét nhập khẩu'],
    [/^export scan$/i, 'Đã quét xuất khẩu'],
    [/^warehouse scan$/i, 'Đã quét tại kho'],
    [/^(?:clearance in progress|import clearance in progress)$/i, 'Đang làm thủ tục thông quan'],
    [/^(?:cleared import customs|import scan complete)$/i, 'Đã thông quan nhập khẩu'],
    [/^(?:delivery attempted|the receiver was not available.*)$/i, 'Đã thử giao hàng'],
    [/^(?:exception|delivery exception)$/i, 'Có sự cố giao hàng'],
    [/^(?:delay|delayed)$/i, 'Bị chậm'],
    [/^return to sender$/i, 'Đang hoàn về người gửi'],
    [/^returned to sender$/i, 'Đã hoàn về người gửi'],
  ];
  const datePattern = /\b(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?\b|\b\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?\b/i;
  const timePattern = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:A\.?M\.?|P\.?M\.?)?(?=\s|$|[,;])/i;
  const titleFor = (line) => {
    const normalized = compact(line).replace(/[.:]+$/, '');
    const exact = eventPatterns.find(([pattern]) => pattern.test(normalized));
    if (exact) return { rawStatus: normalized, status: exact[1] };
    const fragment = normalized.match(/delivered|out for delivery(?: today)?|on the way|in transit|label created|we have your package|arrived at (?:a )?(?:ups )?facility|departed from (?:a )?(?:ups )?facility|processing at ups facility|loaded on delivery vehicle|(?:pickup|origin|departure|arrival|destination|import|export|warehouse) scan|clearance in progress|cleared import customs|delivery attempted|delivery exception|return(?:ed)? to sender|delayed?/i)?.[0];
    if (!fragment) return null;
    const translated = eventPatterns.find(([pattern]) => pattern.test(fragment));
    return { rawStatus: fragment, status: translated?.[1] || fragment };
  };
  const extractDate = (text) => compact(text).match(datePattern)?.[0];
  const extractTime = (text) => compact(text).match(timePattern)?.[0];
  const isLocation = (line) => line.length <= 140 && line.includes(',') && !datePattern.test(line) && !timePattern.test(line);
  const linesOf = (text) => String(text || '').split(/\r?\n/).map(compact).filter(Boolean);
  const makeEvent = (rawStatus, status, date, time, locationText, detailLines) => ({
    status: compact(status || rawStatus).slice(0, 120),
    rawStatus: compact(rawStatus).slice(0, 160),
    ...(date ? { date: compact(date).slice(0, 80) } : {}),
    ...(time ? { time: compact(time).slice(0, 40) } : {}),
    ...(locationText ? { location: compact(locationText).slice(0, 180) } : {}),
    ...(detailLines.length ? { details: compact(detailLines.join(' · ')).slice(0, 320) } : {}),
  });
  const parseBlock = (text, forcedTitle) => {
    const lines = linesOf(text).filter((line) => !new RegExp(`^${code}$`, 'i').test(line));
    const title = forcedTitle || lines.map(titleFor).find(Boolean);
    if (!title) return null;
    const date = lines.map(extractDate).find(Boolean);
    const time = lines.map(extractTime).find(Boolean);
    const locationText = lines.find((line) => isLocation(line));
    const details = lines.map((line) => compact(line
      .replace(datePattern, '').replace(timePattern, '').replace(title.rawStatus, '')))
      .filter((line) => line && line !== locationText && !/^(show|hide|view) details$|^shipment (?:progress|details)$/i.test(line));
    return makeEvent(title.rawStatus, title.status, date, time, locationText, [...new Set(details)]);
  };
  const parseTimeline = (text) => {
    const events = [];
    let contextDate;
    let contextTime;
    let contextLocation;
    let event = null;
    const finish = () => {
      if (event && (event.date || event.time)) events.push(makeEvent(event.rawStatus, event.status,
        event.date, event.time, event.location, event.details));
      event = null;
    };
    for (const line of linesOf(text)) {
      if (line.toUpperCase() === code) continue;
      const date = extractDate(line);
      const time = extractTime(line);
      const title = titleFor(line);
      if (date && event && event.date && event.date !== date) finish();
      if (time && event && event.time && event.time !== time) finish();
      if (date) contextDate = date;
      if (time) contextTime = time;
      if (title) {
        finish();
        event = { ...title, date: date || contextDate, time: time || contextTime, location: contextLocation || '', details: [] };
        contextTime = undefined;
        contextLocation = undefined;
        const residue = compact(line.replace(datePattern, '').replace(timePattern, '').replace(title.rawStatus, ''));
        if (residue) event.details.push(residue);
      } else if (event) {
        if (time && !event.time) { event.time = time; contextTime = undefined; }
        if (isLocation(line) && !event.location) event.location = line;
        else {
          const residue = compact(line.replace(datePattern, '').replace(timePattern, ''));
          if (residue && !/^(show|hide|view) details$|^shipment (?:progress|details)$/i.test(residue)) event.details.push(residue);
        }
      } else if (isLocation(line)) {
        contextLocation = line;
      } else if ((contextDate || contextTime) && !date && !time
        && !/^(date|time|location|activity|package progress|shipment progress|show details|hide details)$/i.test(line)) {
        event = { rawStatus: line, status: line, date: contextDate, time: contextTime, location: contextLocation || '', details: [] };
        contextTime = undefined;
        contextLocation = undefined;
      }
    }
    finish();
    return events;
  };

  const statusSelectors = [
    'app-header-tile #stApp_nameKey',
    '#st_App_PkgSts', '#st_App_PkgSts span',
    '[data-testid="shipment-status"]', '[data-testid="package-status"]',
  ];
  let candidates = statusSelectors.flatMap((selector) => queryAll(doc, selector)).filter(visible);
  // New UPS layout: status heading and tracking number share a compact banner.
  if (!candidates.length) candidates = queryAll(doc, 'h1, h2, h3, [role="heading"]').filter((heading) => {
    if (!visible(heading)) return false;
    let parent = heading.parentElement;
    for (let depth = 0; parent && depth < 3; depth++, parent = parent.parentElement) {
      const text = compact(parent.innerText);
      if (text.length <= 250 && new RegExp(`(?:^|[^A-Z0-9])${code}(?:$|[^A-Z0-9])`).test(text.toUpperCase())) return true;
    }
    return false;
  });
  // Semantic current markers are allowed; ordinary timeline labels are not current status.
  if (!candidates.length) candidates = queryAll(doc, '[aria-current="step"], [aria-current="true"]').filter(visible);
  const matches = candidates.map((node) => compact(cleanNodeText(node)))
    .filter((text) => currentStatuses.has(text.toLowerCase()));
  const unique = [...new Set(matches.map((text) => text.toLowerCase()))];
  if (unique.length !== 1) return pending(`STATUS_NOT_RESOLVED candidates=${candidates.length} recognized=${unique.join('|') || 'none'}`);
  const rawStatus = matches[0];
  const status = currentStatuses.get(unique[0]);

  const rootSelectors = [
    'app-shipment-progress-details', 'app-shipment-progress', 'app-track-details',
    '#stApp_ShpmtProg_LVP', '[id*="ShpmtProg"]',
    '[data-testid*="shipment-progress"]', '[data-testid*="tracking-detail"]',
    '[class*="shipment-progress"]', '[class*="tracking-details"]', '[class*="tracking-detail"]',
    '[class*="timeline"]',
  ];
  const itemSelectors = [
    '[data-testid*="milestone"]', '[data-testid*="event"]', '[data-testid*="activity"]',
    '[class*="milestone"]', '[class*="tracking-event"]', '[class*="activity-row"]',
    'li', '[role="listitem"]', 'article', 'tr',
  ];
  const roots = rootSelectors.flatMap((selector) => queryAll(doc, selector)).filter(visible);
  const history = roots.flatMap((root) => parseTimeline(cleanNodeText(root)));
  const blocks = itemSelectors.flatMap((selector) => queryAll(doc, selector)).filter((node) => {
    if (!visible(node)) return false;
    const text = cleanNodeText(node);
    return text.length > 0 && text.length <= 1200 && Boolean(extractDate(text) || extractTime(text));
  });
  blocks.forEach((node) => {
    const event = parseBlock(cleanNodeText(node));
    if (event && (event.date || event.time)) history.push(event);
  });

  const currentNode = candidates.find((node) => compact(cleanNodeText(node)).toLowerCase() === unique[0]);
  let currentContext = currentNode;
  for (let depth = 0, parent = currentNode?.parentElement; parent && depth < 5; depth++, parent = parent.parentElement) {
    const text = cleanNodeText(parent);
    if (text.length > 0 && text.length <= 800 && (extractDate(text) || extractTime(text))) { currentContext = parent; break; }
  }
  const currentEvent = parseBlock(cleanNodeText(currentContext), { rawStatus, status })
    || makeEvent(rawStatus, status, undefined, undefined, undefined, []);
  const normalized = (value) => compact(value).toLowerCase();
  const deduped = [];
  const seen = new Set();
  for (const event of history) {
    const key = [event.rawStatus, event.date, event.time, event.location, event.details].map(normalized).join('|');
    if (!seen.has(key)) { seen.add(key); deduped.push(event); }
  }
  const hasCurrent = deduped.some((event) => normalized(event.rawStatus) === normalized(rawStatus)
    && ((!currentEvent.date && !currentEvent.time) || (normalized(event.date) === normalized(currentEvent.date)
      && normalized(event.time) === normalized(currentEvent.time))));
  if (!hasCurrent) deduped.unshift(currentEvent);
  if (!deduped.length) deduped.push(currentEvent);

  return { ok: true, code, status, rawStatus, history: deduped.slice(0, 100), checkedAt: new Date().toISOString() };
}
globalThis.readUpsDocument = readUpsDocument;
