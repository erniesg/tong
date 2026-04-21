import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLine } from './voice-rules';

test('shoucheng rejects forbidden tokens', () => {
  const result = validateLine('shoucheng', '我觉得你不愿意。不一样的。');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.violations.includes('forbidden_token:不一样的'));
  }
});

test('shoucheng allows the locked H1 line', () => {
  assert.deepEqual(validateLine('shoucheng', '我觉得你装不下去。'), { ok: true });
});

test('dingman allows the minimum viable b1b reply', () => {
  assert.deepEqual(validateLine('dingman', '看了。', { id: 'b1b' }), { ok: true });
});

test('dingman rejects overlength b1b variants', () => {
  const result = validateLine('dingman', '看了看，感觉还行。', { id: 'b1b' });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.violations.includes('overlength:b1b'));
  }
});

test('fangayi requires diminutives when naming the leads directly', () => {
  const result = validateLine('fangayi', '守成今天又来晚了。');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.violations.includes('missing_diminutive:shoucheng'));
  }
});
