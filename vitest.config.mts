import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		exclude: ['src/test/**'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/test/**', 'src/types/**'],
			reporter: ['text', 'json-summary', 'lcov'],
			reportsDirectory: 'coverage',
			thresholds: {
				branches: 75,
				functions: 90,
				lines: 90,
				statements: 90,
				perFile: true,
			},
		},
	},
});
