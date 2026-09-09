/* Runs in the isolated extension world. The current status and dated journey history are read separately. */
function readUpsDocument(doc, code, diagnose = false, mode = 'full') {
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
  const READER_VERSION = '0.4.0';
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
  if (mode !== 'quick' && detailControl && detailControl.getAttribute?.('aria-expanded') !== 'true' && !marker) {
    markerHost?.setAttribute?.('data-hahoa-ups-details-at', String(Date.now()));
    detailControl.click();
    return pending('DETAILS_EXPANDING');
  }
  if (mode !== 'quick' && marker && Date.now() - Number(marker) < 4000) return pending('DETAILS_LOADING');

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
  const isoDate = (year, month, day) => {
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return undefined;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const estimatedDateFromText = (value) => {
    const text = compact(value);
    if (!text || /provided as soon as possible|not (?:yet )?available|unavailable|pending|to be determined|cannot be determined/i.test(text)) return undefined;
    const direct = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (direct) return isoDate(Number(direct[1]), Number(direct[2]), Number(direct[3]));
    const numeric = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
    if (numeric) return isoDate(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]));
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'];
    const named = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?\b/i);
    if (!named) return undefined;
    const month = monthNames.indexOf(named[1].toLowerCase()) + 1;
    const day = Number(named[2]);
    let year = named[3] ? Number(named[3]) : new Date().getFullYear();
    let result = isoDate(year, month, day);
    if (!named[3] && result) {
      const candidate = Date.parse(`${result}T12:00:00Z`);
      if (candidate < Date.now() - 45 * 24 * 60 * 60 * 1000) result = isoDate(++year, month, day);
    }
    return result;
  };
  const estimatedDeliverySelectors = [
    '[data-testid*="estimated-delivery"]', '[data-testid*="scheduled-delivery"]',
    '[id*="estimatedDelivery"]', '[id*="scheduledDelivery"]',
    '[class*="estimated-delivery"]', '[class*="scheduled-delivery"]',
  ];
  const estimatedDeliveryTexts = estimatedDeliverySelectors.flatMap((selector) => queryAll(doc, selector))
    .filter(visible).flatMap((node) => {
      const own = compact(cleanNodeText(node) || node.getAttribute?.('aria-label'));
      const sibling = compact(cleanNodeText(node.nextElementSibling));
      const parent = compact(cleanNodeText(node.parentElement));
      return [own, sibling, parent.length <= 500 ? parent : ''];
    }).filter(Boolean);
  const bodyLines = String(body).split(/\r?\n/).map(compact).filter(Boolean);
  bodyLines.forEach((line, index) => {
    if (/estimated (?:delivery|arrival)|scheduled delivery|delivery date/i.test(line)) {
      estimatedDeliveryTexts.push(bodyLines.slice(index, index + 4).join(' '));
    }
  });
  const edd = estimatedDeliveryTexts.map(estimatedDateFromText).find(Boolean);
  const isLocation = (line) => {
    if (line.length > 140 || datePattern.test(line) || timePattern.test(line)) return false;
    if (/^(?:United States|US|USA)$/i.test(line)) return true;
    const parts = line.split(',').map(compact).filter(Boolean);
    if (parts.length >= 3 && /^[A-Z]{2,3}$/.test(parts.at(-2))) return true;
    return parts.length === 2 && /^[A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){0,3}$/.test(parts[1]);
  };
  const isNoise = (line) => /^(?:copy tracking number|tracking number copied to clipboard\.?|check|close|completed|to:?|from:?|at|show details|hide details|view details|shipment (?:progress|details)|package history|select time zone|origin time|proof of delivery|file a claim|get updates)$/i.test(compact(line));
  const linesOf = (text) => String(text || '').split(/\r?\n/).map(compact).filter(Boolean);
  const makeEvent = (rawStatus, status, date, time, locationText, detailLines) => {
    const raw = compact(rawStatus);
    const translated = compact(status || rawStatus);
    const details = [...new Set(detailLines.map(compact).filter((line) => line && !isNoise(line)
      && line.toLowerCase() !== raw.toLowerCase() && line.toLowerCase() !== translated.toLowerCase()))];
    return {
      status: translated.slice(0, 120),
      rawStatus: raw.slice(0, 160),
      ...(date ? { date: compact(date).slice(0, 80) } : {}),
      ...(time ? { time: compact(time).slice(0, 40) } : {}),
      ...(locationText ? { location: compact(locationText).slice(0, 180) } : {}),
      ...(details.length ? { details: details.join(' · ').slice(0, 320) } : {}),
    };
  };
  const parseBlock = (text, forcedTitle) => {
    const lines = linesOf(text).filter((line) => !new RegExp(`^${code}$`, 'i').test(line));
    const title = forcedTitle || lines.map(titleFor).find(Boolean);
    if (!title) return null;
    const date = lines.map(extractDate).find(Boolean);
    const time = lines.map(extractTime).find(Boolean);
    const locationText = lines.find((line) => isLocation(line));
    const details = lines.map((line) => compact(line
      .replace(datePattern, '').replace(timePattern, '').replace(title.rawStatus, '')))
      .filter((line) => line && line !== locationText && !isNoise(line));
    return makeEvent(title.rawStatus, title.status, date, time, locationText, [...new Set(details)]);
  };
  const parseTimeline = (text) => {
    const events = [];
    let contextDate;
    let contextTime;
    let contextLocation;
    let event = null;
    const finish = () => {
      if (event?.time) events.push(makeEvent(event.rawStatus, event.status,
        event.date, event.time, event.location, event.details));
      event = null;
    };
    for (const line of linesOf(text)) {
      if (line.toUpperCase() === code) continue;
      const date = extractDate(line);
      const time = extractTime(line);
      const title = titleFor(line);
      if (date && event) finish();
      if (time && event && event.time && event.time !== time) finish();
      if (date) contextDate = date;
      if (time) contextTime = time;
      if (title && event && !contextTime && !time && (!date || date === event.date)) {
        if (!isNoise(line)) event.details.push(line);
      } else if (title) {
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
          if (residue && !isNoise(residue)) event.details.push(residue);
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

  const currentNode = candidates.find((node) => compact(cleanNodeText(node)).toLowerCase() === unique[0]);
  let currentContext = currentNode;
  for (let depth = 0, parent = currentNode?.parentElement; parent && depth < 5; depth++, parent = parent.parentElement) {
    const text = cleanNodeText(parent);
    if (text.length > 0 && text.length <= 800 && (extractDate(text) || extractTime(text))) {
      currentContext = parent;
      if (extractDate(text) && extractTime(text)) break;
    }
  }
  const currentEvent = parseBlock(cleanNodeText(currentContext), { rawStatus, status })
    || makeEvent(rawStatus, status, undefined, undefined, undefined, []);
  if (mode === 'quick') return { ok: true, code, status, rawStatus, mode, currentEvent,
    ...(edd ? { edd } : {}), checkedAt: new Date().toISOString() };

  const rootSelectors = [
    'app-shipment-progress-details', 'app-track-details',
    '[data-testid*="tracking-detail"]',
    '[class*="tracking-details"]', '[class*="tracking-detail"]',
    '[class*="timeline"]',
  ];
  const itemSelectors = [
    '[data-testid*="event"]', '[data-testid*="activity"]',
    '[class*="tracking-event"]', '[class*="activity-row"]',
    'li', '[role="listitem"]', 'article', 'tr',
  ];
  const exactRoots = queryAll(doc, '#stApp_ShpmtProg_LVP').filter(visible);
  const headingRoots = queryAll(doc, 'h1, h2, h3, h4, [role="heading"]').flatMap((heading) => {
    if (!visible(heading) || compact(cleanNodeText(heading)).toLowerCase() !== 'package history') return [];
    for (let depth = 0, parent = heading.parentElement; parent && depth < 7; depth++, parent = parent.parentElement) {
      const text = cleanNodeText(parent);
      const times = text.match(new RegExp(timePattern.source, 'gi')) || [];
      if (text.length <= 30000 && times.length >= 2) return [parent];
    }
    return [];
  });
  const candidateRoots = [...new Set(rootSelectors.flatMap((selector) => queryAll(doc, selector)))].filter(visible);
  const roots = exactRoots.length ? exactRoots : headingRoots.length ? [headingRoots[0]]
    : candidateRoots.sort((left, right) => cleanNodeText(right).length - cleanNodeText(left).length).slice(0, 1);
  const history = roots.flatMap((root) => parseTimeline(cleanNodeText(root)));
  const blocks = [...new Set(itemSelectors.flatMap((selector) => queryAll(doc, selector)))].filter((node) => {
    if (!visible(node)) return false;
    const text = cleanNodeText(node);
    return text.length > 0 && text.length <= 1200 && Boolean(extractTime(text));
  });
  if (!history.length) blocks.forEach((node) => {
    const event = parseBlock(cleanNodeText(node));
    if (event?.time) history.push(event);
  });

  const normalized = (value) => compact(value).toLowerCase();
  const compatible = (left, right) => normalized(left.rawStatus) === normalized(right.rawStatus)
    && (!left.date || !right.date || normalized(left.date) === normalized(right.date))
    && (!left.time || !right.time || normalized(left.time) === normalized(right.time));
  const mergeEvents = (left, right) => makeEvent(left.rawStatus || right.rawStatus, left.status || right.status,
    left.date || right.date, left.time || right.time, left.location || right.location,
    [left.details, right.details].filter(Boolean));
  const deduped = [];
  for (const event of history) {
    const index = deduped.findIndex((item) => compatible(item, event));
    if (index === -1) deduped.push(event);
    else deduped[index] = mergeEvents(deduped[index], event);
  }
  const currentIndex = deduped.findIndex((event) => normalized(event.rawStatus) === normalized(rawStatus));
  if (currentIndex === -1) deduped.unshift(currentEvent);
  else deduped.unshift(deduped.splice(currentIndex, 1)[0]);

  return { ok: true, code, status, rawStatus, mode: 'full', currentEvent, history: deduped.slice(0, 100),
    ...(edd ? { edd } : {}), checkedAt: new Date().toISOString() };
}
globalThis.readUpsDocument = readUpsDocument;
