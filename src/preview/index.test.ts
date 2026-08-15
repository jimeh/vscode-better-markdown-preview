// @vitest-environment happy-dom

import { expect, test, vi } from 'vitest';

const enhancePreview = vi.hoisted(() => vi.fn());
vi.mock('./runtime', () => ({ enhancePreview }));

test('preview entry point enhances the current host document', async () => {
	await import('./index');

	expect(enhancePreview).toHaveBeenCalledOnce();
	expect(enhancePreview).toHaveBeenCalledWith(document);
});
