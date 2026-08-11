import assert from 'node:assert/strict';
import test from 'node:test';
import { pnpmCommand } from '../scripts/lib/commands.mjs';

test('pnpm command selection uses the Windows command shim only on Windows', () => {
	assert.equal(pnpmCommand('win32'), 'pnpm.cmd');
	assert.equal(pnpmCommand('darwin'), 'pnpm');
	assert.equal(pnpmCommand('linux'), 'pnpm');
});
