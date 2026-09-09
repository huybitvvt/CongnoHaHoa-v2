export function shouldDiscard(item, current) {
  if (!current || current.tracking_code !== item.code) return true;
  const result = JSON.parse(item.payload);
  const baseline = JSON.parse(item.snapshot);
  if (result.ok) return Boolean(current.checked_at && Date.parse(current.checked_at) > Date.parse(result.checkedAt));
  // A failed old attempt must not turn a newly successful shipment back into an error.
  return (current.checked_at || null) !== (baseline.checked_at || null);
}
