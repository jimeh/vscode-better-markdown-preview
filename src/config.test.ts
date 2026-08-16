import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
	CONFIGURATION_SECTION,
	configurationKeys,
	defaultConfiguration,
	previewConfiguration,
	readConfiguration,
} from './config';

describe('configuration', () => {
	test('keeps runtime keys aligned with the contributed manifest settings', () => {
		const manifest = JSON.parse(
			readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
		) as {
			contributes: { configuration: { properties: Record<string, unknown> } };
		};
		expect(Object.keys(manifest.contributes.configuration.properties)).toEqual(
			configurationKeys.map((key) => `${CONFIGURATION_SECTION}.${key}`),
		);
	});

	test('reads all feature defaults from the manifest contract', () => {
		const seen: string[] = [];
		const configuration = readConfiguration({
			get(key, fallback) {
				seen.push(key);
				return fallback;
			},
		});

		expect(configuration).toEqual(defaultConfiguration);
		expect(seen).toEqual(configurationKeys);
	});

	test('reads explicit values and exposes only browser-facing settings', () => {
		const disabled = new Set([
			'rendering.mermaid',
			'navigation.tableOfContents',
			'navigation.smoothScrolling',
			'mermaid.viewer',
		]);
		const enabled = new Set(['rendering.emoticonShortcuts']);
		const configuration = readConfiguration({
			get(key, fallback) {
				return (
					disabled.has(key) ? false : enabled.has(key) ? true : fallback
				) as typeof fallback;
			},
		});

		expect(configuration.rendering.mermaid).toBe(false);
		expect(configuration.rendering.emoticonShortcuts).toBe(true);
		expect(previewConfiguration(configuration)).toEqual({
			tableOfContents: false,
			smoothScrolling: false,
			mermaidViewer: false,
		});
	});
});
