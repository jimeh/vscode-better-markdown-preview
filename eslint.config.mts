import eslint from '@eslint/js';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

export default [
	{
		ignores: [
			'.vscode-test/**',
			'.vscode-test-web/**',
			'artifacts/**',
			'coverage/**',
			'dist/**',
			'node_modules/**',
			'out/**',
		],
	},
	{
		files: ['.vscode-test.mjs'],
		languageOptions: {
			ecmaVersion: 2022,
			globals: globals.node,
		},
		rules: eslint.configs.recommended.rules,
	},
	{
		files: ['**/*.{ts,mts}'],
		languageOptions: {
			ecmaVersion: 2022,
			globals: {
				...globals.mocha,
				...globals.node,
			},
			parser: typescriptEslint.parser,
			sourceType: 'module',
		},
		plugins: {
			'@typescript-eslint': typescriptEslint.plugin,
		},
		rules: {
			...eslint.configs.recommended.rules,
			'no-undef': 'off',
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'import',
					format: ['camelCase', 'PascalCase'],
				},
			],
			curly: 'error',
			eqeqeq: 'error',
			'no-throw-literal': 'error',
			semi: 'error',
		},
	},
];
