import assert from 'node:assert/strict';
import test from 'node:test';

import { clampProfiles, profileIds, profileIsEnabled, profileNumber } from '../runner/profiles.mjs';

test('profile selection stays between one and the configured capacity', () => {
  assert.equal(clampProfiles(0, 3), 1);
  assert.equal(clampProfiles(2, 3), 2);
  assert.equal(clampProfiles(9, 3), 3);
  assert.equal(clampProfiles(3, 2), 2);
  assert.equal(clampProfiles('bad', 3), 3);
});

test('profile list and worker validation follow the selected count', () => {
  assert.deepEqual(profileIds(3), ['profile-1', 'profile-2', 'profile-3']);
  assert.equal(profileNumber('profile-2'), 2);
  assert.equal(profileNumber('profile-4'), 0);
  assert.equal(profileIsEnabled('profile-2', 2, 3), true);
  assert.equal(profileIsEnabled('profile-3', 2, 3), false);
});
