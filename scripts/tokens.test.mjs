import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('repository-owned design tokens reproduce the checked-in stylesheet', () => {
  const tokens = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(tokens.colors).length > 0);
  assert.ok(Object.keys(tokens.type).length > 0);
  assert.ok(tokens.space.length > 0);
  assert.ok(Object.keys(tokens.radius).length > 0);
  assert.ok(Object.keys(tokens.touch).length > 0);
  execFileSync('python', ['scripts/tokens.py', '--check'], { stdio: 'pipe' });
});
