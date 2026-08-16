import { afterEach, describe, expect, test, vi } from 'vitest';
import { assertConfigurationRoundTrip } from './test/render-contract';

describe('host render contract', () => {
	afterEach(() => vi.restoreAllMocks());

	test('reports every configuration restoration failure', async () => {
		const restoreFailures = [
			new Error('failed to restore Mermaid viewer'),
			new Error('failed to restore columns'),
		];
		const defaultRender =
			'better-markdown-preview-columns Named 😂. Shortcut :). Escaped :). Internal :). &quot;mermaidViewer&quot;:true';
		const renders = [
			defaultRender,
			'Named 😂. Shortcut 😃. Escaped :). Internal :).',
			'Named :joy:. Shortcut :). Escaped :). Internal :).',
			'columns disabled',
			'&quot;mermaidViewer&quot;:false',
			defaultRender,
		];
		let updateCount = 0;

		await expect(
			assertConfigurationRoundTrip(
				async () => renders.shift(),
				async () => {
					updateCount += 1;
					if (updateCount === 13 || updateCount === 14) {
						throw restoreFailures[updateCount - 13];
					}
				},
				{
					'mermaid.viewer': true,
					'rendering.columns': false,
					'rendering.emojiShortcodes': false,
					'rendering.emoticonShortcuts': true,
				},
			),
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(AggregateError);
			expect((error as AggregateError).errors).toEqual(restoreFailures);
			return true;
		});
		expect(updateCount).toBe(16);
	});

	test('keeps the test failure primary when restoration also fails', async () => {
		const primaryFailure = new Error('render failed');
		const restoreFailures = [
			new Error('failed to restore Mermaid viewer'),
			new Error('failed to restore columns'),
		];
		const report = vi.spyOn(console, 'error').mockImplementation(() => {});
		let updateCount = 0;

		await expect(
			assertConfigurationRoundTrip(
				async () => {
					throw primaryFailure;
				},
				async () => {
					updateCount += 1;
					if (updateCount === 5 || updateCount === 6) {
						throw restoreFailures[updateCount - 5];
					}
				},
				{
					'mermaid.viewer': true,
					'rendering.columns': false,
					'rendering.emojiShortcodes': false,
					'rendering.emoticonShortcuts': true,
				},
			),
		).rejects.toBe(primaryFailure);

		expect(updateCount).toBe(8);
		expect(report).toHaveBeenCalledOnce();
		expect(report.mock.calls[0]?.[0]).toBe(
			'Configuration restoration also failed:',
		);
		const reportedError = report.mock.calls[0]?.[1];
		expect(reportedError).toBeInstanceOf(AggregateError);
		if (!(reportedError instanceof AggregateError)) {
			throw new TypeError('Expected an aggregate restoration error.');
		}
		expect(reportedError.errors).toEqual(restoreFailures);
	});
});
