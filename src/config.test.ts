import { describe, expect, test } from 'vitest';
import {
	configurationKeys,
	defaultConfiguration,
	previewConfiguration,
	readConfiguration,
} from './config';

describe('configuration', () => {
	test('reads all feature defaults as enabled', () => {
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
		const configuration = readConfiguration({
			get(key, fallback) {
				return (disabled.has(key) ? false : fallback) as typeof fallback;
			},
		});

		expect(configuration.rendering.mermaid).toBe(false);
		expect(previewConfiguration(configuration)).toEqual({
			tableOfContents: false,
			smoothScrolling: false,
			mermaidViewer: false,
		});
	});
});
