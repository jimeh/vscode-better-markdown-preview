import { afterEach, describe, expect, test, vi } from 'vitest';
import { assertConfigurationRoundTrip } from './test/render-contract';

describe('host render contract', () => {
	afterEach(() => vi.restoreAllMocks());

	test('reports every configuration restoration failure', async () => {
		const restoreFailures = [
			new Error('failed to restore Mermaid viewer'),
			new Error('failed to restore Terraform callouts'),
		];
		const defaultRender =
			'better-markdown-preview-terraform-callout better-markdown-preview-columns Named 😂. Shortcut :). Escaped :). Internal :). &quot;mermaidViewer&quot;:true';
		const renders = [
			defaultRender,
			'Named 😂. Shortcut 😃. Escaped :). Internal :).',
			'Named :joy:. Shortcut :). Escaped :). Internal :).',
			'-&gt; Terraform note.',
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
					if (updateCount === 16 || updateCount === 17) {
						throw restoreFailures[updateCount - 16];
					}
				},
				{
					'mermaid.viewer': true,
					'rendering.terraformCallouts': false,
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
		expect(updateCount).toBe(20);
	});

	test('keeps the test failure primary when restoration also fails', async () => {
		const primaryFailure = new Error('render failed');
		const restoreFailures = [
			new Error('failed to restore Mermaid viewer'),
			new Error('failed to restore Terraform callouts'),
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
					if (updateCount === 6 || updateCount === 7) {
						throw restoreFailures[updateCount - 6];
					}
				},
				{
					'mermaid.viewer': true,
					'rendering.terraformCallouts': false,
					'rendering.columns': false,
					'rendering.emojiShortcodes': false,
					'rendering.emoticonShortcuts': true,
				},
			),
		).rejects.toBe(primaryFailure);

		expect(updateCount).toBe(10);
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
