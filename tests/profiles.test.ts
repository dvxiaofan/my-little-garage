import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS, avatarFor, isAvatar } from '../src/profiles.ts';
import { carAvatarSvg } from '../src/avatars.ts';

test('six car avatars have stable unique identities, colors and silhouettes', () => {
  assert.equal(AVATARS.length, 6);
  for (const key of ['id', 'color', 'shape', 'legacy'] as const) assert.equal(new Set(AVATARS.map(avatar => avatar[key])).size, 6);
  for (const avatar of AVATARS) {
    assert.equal(isAvatar(avatar.id), true);
    assert.equal(isAvatar(avatar.legacy), true);
    assert.equal(avatarFor(avatar.legacy), avatar);
    assert.equal(carAvatarSvg(avatar.legacy), carAvatarSvg(avatar.id));
  }
});

test('unknown avatar values fall back to local artwork without interpolating untrusted markup', () => {
  for (const value of [null, undefined, {}, '__proto__', '<svg onload="alert(1)">']) {
    assert.equal(isAvatar(value), false);
    assert.equal(avatarFor(value), AVATARS[0]);
    assert.equal(carAvatarSvg(value), carAvatarSvg(AVATARS[0].id));
  }
});
