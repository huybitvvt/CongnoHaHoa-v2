export const MAX_PROFILES = 3;

export function clampProfiles(value, capacity = MAX_PROFILES) {
  const configured = Math.max(1, Math.min(MAX_PROFILES, Number(capacity) || MAX_PROFILES));
  const requested = Number(value);
  return Number.isInteger(requested) ? Math.max(1, Math.min(configured, requested)) : configured;
}

export function profileNumber(worker) {
  const match = /^profile-([1-3])$/.exec(String(worker || ''));
  return match ? Number(match[1]) : 0;
}

export function profileIds(count) {
  return Array.from({ length: clampProfiles(count) }, (_, index) => `profile-${index + 1}`);
}

export function profileIsEnabled(worker, requestedProfiles, capacity = MAX_PROFILES) {
  const number = profileNumber(worker);
  return number > 0 && number <= clampProfiles(requestedProfiles, capacity);
}
