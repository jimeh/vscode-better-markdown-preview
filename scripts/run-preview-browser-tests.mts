import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { isPathWithin } from './lib/paths.mts';

interface BrowserElement {
	readonly textContent: string | null;
	readonly scrollTop: number;
	getBoundingClientRect(): { top: number; bottom: number };
	querySelector(selector: string): BrowserElement | null;
}

interface BrowserGlobal {
	document: {
		querySelector(selector: string): BrowserElement | null;
	};
}

const repositoryRoot = resolve(import.meta.dirname, '..');
const previewRoot = resolve(repositoryRoot, 'dist/preview');
const fixtureCsp = [
	"default-src 'none'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"base-uri 'none'",
].join('; ');

const fixture = `<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="stylesheet" href="/dist/preview/preview.css">
	<style>
		:root { --vscode-editor-background: #fff; --vscode-editor-foreground: #222; --vscode-panel-border: #888; --vscode-textLink-foreground: #06c; }
	</style>
</head>
<body class="vscode-light">
	<div class="markdown-body">
		<h1 id="title">Fixture</h1>
		<h2 id="one">One</h2>
		<h2 id="two">Two</h2>
		<figure class="better-markdown-preview-code" data-bmp-lines="2"><pre><code>one\ntwo</code></pre></figure>
		<pre class="better-markdown-preview-mermaid" data-bmp-mermaid-source data-bmp-mermaid-state="source">graph TD\nA--&gt;|transition|B</pre>
	</div>
	<script src="/dist/preview/preview.js"></script>
</body>
</html>`;

function contentType(path: string): string {
	return (
		{
			'.css': 'text/css; charset=utf-8',
			'.js': 'text/javascript; charset=utf-8',
		}[extname(path)] ?? 'application/octet-stream'
	);
}

async function listen(server: Server): Promise<number> {
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('Preview browser server did not bind a TCP port');
	}
	return address.port;
}

async function closeServer(server: Server): Promise<void> {
	if (!server.listening) {
		return;
	}
	await new Promise<void>((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}

async function expectCount(
	page: Page,
	selector: string,
	count: number,
): Promise<void> {
	const actual = await page.locator(selector).count();
	if (actual !== count) {
		throw new Error(
			`Expected ${count} ${selector} elements, received ${actual}`,
		);
	}
}

const server = createServer(async (request, response) => {
	try {
		const url = new URL(request.url ?? '/', 'http://127.0.0.1');
		if (url.pathname === '/') {
			response.writeHead(200, {
				'content-security-policy': fixtureCsp,
				'content-type': 'text/html; charset=utf-8',
			});
			response.end(fixture);
			return;
		}
		if (!url.pathname.startsWith('/dist/preview/')) {
			response.writeHead(404).end();
			return;
		}
		const relative = url.pathname.slice('/dist/preview/'.length);
		const path = resolve(previewRoot, relative);
		if (!isPathWithin(previewRoot, path)) {
			response.writeHead(403).end();
			return;
		}
		response.writeHead(200, { 'content-type': contentType(path) });
		response.end(await readFile(path));
	} catch (error) {
		response.writeHead(500).end(String(error));
	}
});

let browser: Browser | undefined;
let page: Page | undefined;
let primaryFailure: unknown;
try {
	const port = await listen(server);
	browser = await chromium.launch({ headless: true });
	page = await browser.newPage({ viewport: { width: 1280, height: 480 } });
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(`console: ${message.text()}`);
		}
	});
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	await page.addInitScript({
		content: `window.__bmpUnhandledRejections = [];
window.addEventListener('unhandledrejection', event => {
	window.__bmpUnhandledRejections.push(String(event.reason));
});`,
	});

	const navigation = await page.goto(`http://127.0.0.1:${port}/`, {
		waitUntil: 'networkidle',
	});
	if (navigation?.headers()['content-security-policy'] !== fixtureCsp) {
		throw new Error(
			'The preview fixture response did not apply its expected CSP',
		);
	}
	await page.locator('[data-bmp-mermaid-state="rendered"] svg').waitFor();
	const initialNodeColors = await page.evaluate<{
		fill: string;
		stroke: string;
	}>(`(() => {
		const node = document.querySelector(
			'[data-bmp-mermaid-state="rendered"] .node rect'
		);
		const styles = window.getComputedStyle(node);
		return { fill: styles.fill, stroke: styles.stroke };
	})()`);
	if (
		initialNodeColors.fill !== 'rgb(224, 237, 249)' ||
		initialNodeColors.stroke !== 'rgb(140, 186, 232)'
	) {
		throw new Error(
			`Mermaid did not apply the default theme shifts: ${JSON.stringify(initialNodeColors)}`,
		);
	}
	const initialEdgeLabelBackground = await page.evaluate<string>(
		`window.getComputedStyle(
			document.querySelector('[data-bmp-mermaid-state="rendered"] .edgeLabel p')
		).backgroundColor`,
	);
	if (initialEdgeLabelBackground !== 'rgb(255, 255, 255)') {
		throw new Error(
			`Mermaid did not preserve the editor background behind edge labels: ${initialEdgeLabelBackground}`,
		);
	}

	await expectCount(page, '[data-bmp-layout]', 1);
	await expectCount(page, '[data-bmp-toc]', 1);
	await expectCount(page, '[data-bmp-toc] a', 2);
	if (
		(await page.locator('[data-bmp-toc]').textContent())?.includes('Fixture')
	) {
		throw new Error('The browser TOC unexpectedly included the leading H1');
	}
	await expectCount(page, '[data-bmp-code-line]', 2);
	await expectCount(page, '[data-bmp-mermaid-open]', 1);

	const trigger = page.locator('[data-bmp-mermaid-open]');
	await trigger.focus();
	await trigger.click();
	await page.locator('[data-bmp-mermaid-dialog][open]').waitFor();
	const canvasFocused = await page.evaluate<boolean>(
		'document.activeElement?.hasAttribute("data-bmp-mermaid-canvas") === true',
	);
	if (!canvasFocused) {
		const active = await page.evaluate<string>(
			'document.activeElement?.outerHTML ?? "none"',
		);
		throw new Error(
			`The Mermaid viewer canvas did not receive focus; active element: ${active}`,
		);
	}
	await page.keyboard.press('Escape');
	await page.waitForFunction(
		'!document.querySelector("[data-bmp-mermaid-dialog]")?.hasAttribute("open")',
	);
	const triggerFocused = await page.evaluate<boolean>(
		'document.activeElement?.hasAttribute("data-bmp-mermaid-open") === true',
	);
	if (!triggerFocused) {
		throw new Error('The Mermaid viewer did not restore trigger focus');
	}

	await page.evaluate(`(() => {
		window.__bmpInitialSvg = document.querySelector(
			'[data-bmp-mermaid-state="rendered"] svg'
		);
		const marker = document.createElement('span');
		marker.hidden = true;
		marker.dataset.bmpPreviewConfig = JSON.stringify({
			mermaidTheme: {
				primary: 30,
				secondary: 36,
				tertiary: 20,
				border: 60,
			},
		});
		document.querySelector('.markdown-body')?.append(marker);
	})()`);
	await page.waitForFunction(
		`document.querySelector('[data-bmp-mermaid-state="rendered"] svg') !==
			window.__bmpInitialSvg`,
	);
	const configuredNodeColors = await page.evaluate<{
		fill: string;
		stroke: string;
	}>(`(() => {
		const node = document.querySelector(
			'[data-bmp-mermaid-state="rendered"] .node rect'
		);
		const styles = window.getComputedStyle(node);
		return { fill: styles.fill, stroke: styles.stroke };
	})()`);
	if (
		configuredNodeColors.fill !== 'rgb(179, 209, 240)' ||
		configuredNodeColors.stroke !== 'rgb(102, 163, 224)'
	) {
		throw new Error(
			`Mermaid did not apply configured theme shifts: ${JSON.stringify(configuredNodeColors)}`,
		);
	}

	await page.evaluate(`window.__bmpInitialSvg = document.querySelector(
		'[data-bmp-mermaid-state="rendered"] svg'
	);
	document.body.classList.replace('vscode-light', 'vscode-dark');`);
	await page.waitForFunction(
		`document.querySelector('[data-bmp-mermaid-state="rendered"] svg') !==
			window.__bmpInitialSvg`,
	);

	await page.evaluate(`(() => {
		const body = document.querySelector('.markdown-body');
		body.innerHTML = '<h1 id="long-title">Long fixture</h1>' + Array.from(
			{ length: 40 },
			(_, index) => {
				const number = index + 1;
				return '<h2 id="section-' + number + '">Section ' + number +
					'</h2><p style="min-height: 4rem">Section content</p>';
			},
		).join('');
	})()`);
	await page.locator('[data-bmp-toc] a', { hasText: 'Section 40' }).waitFor();
	await page.evaluate(
		'window.scrollTo(0, document.documentElement.scrollHeight)',
	);
	await page.waitForFunction(() => {
		const browserDocument = (globalThis as unknown as BrowserGlobal).document;
		const nav = browserDocument.querySelector('[data-bmp-toc]');
		const active = nav?.querySelector('[aria-current="location"]');
		if (!nav || active?.textContent !== 'Section 40') {
			return false;
		}
		const navBounds = nav.getBoundingClientRect();
		const activeBounds = active.getBoundingClientRect();
		return (
			nav.scrollTop > 0 &&
			activeBounds.top >= navBounds.top &&
			activeBounds.bottom <= navBounds.bottom
		);
	});
	const longTocState = await page.evaluate<{
		activeText: string | null;
		atDocumentBottom: boolean;
		activeWithinNav: boolean;
		navScrollTop: number;
	}>(`(() => {
		const nav = document.querySelector('[data-bmp-toc]');
		const active = nav.querySelector('[aria-current="location"]');
		const navBounds = nav.getBoundingClientRect();
		const activeBounds = active.getBoundingClientRect();
		return {
			activeText: active.textContent,
			atDocumentBottom:
				Math.ceil(window.scrollY + window.innerHeight) >=
				document.documentElement.scrollHeight,
			activeWithinNav:
				activeBounds.top >= navBounds.top &&
				activeBounds.bottom <= navBounds.bottom,
			navScrollTop: nav.scrollTop,
		};
	})()`);
	if (
		longTocState.activeText !== 'Section 40' ||
		!longTocState.atDocumentBottom ||
		!longTocState.activeWithinNav ||
		longTocState.navScrollTop <= 0
	) {
		throw new Error(
			`The long TOC did not reveal its final active link: ${JSON.stringify(longTocState)}`,
		);
	}

	await page.evaluate(`(() => {
		const replacement = document.createElement('div');
		replacement.className = 'markdown-body';
		replacement.innerHTML =
			'<h2 id="three">Three</h2><h2 id="four">Four</h2><p>Replacement body</p>';
		document.querySelector('.markdown-body')?.replaceWith(replacement);
	})()`);
	await page.locator('[data-bmp-toc] a', { hasText: 'Four' }).waitFor();
	await expectCount(page, '[data-bmp-layout]', 1);
	await expectCount(page, '[data-bmp-toc]', 1);
	await expectCount(page, '[data-bmp-mermaid-open]', 0);

	const unhandled = await page.evaluate<string[]>(
		'window.__bmpUnhandledRejections',
	);
	if (unhandled.length > 0) {
		errors.push(...unhandled.map((error) => `unhandledrejection: ${error}`));
	}
	if (errors.length > 0) {
		throw new Error(`Browser errors:\n${errors.join('\n')}`);
	}
	console.log(
		'Preview browser contract passed: CSP-restricted bundles, long TOC active-link reveal, TOC/body replacement, code enhancement, Mermaid import/theme rerender, and dialog focus.',
	);
} catch (error) {
	primaryFailure = error;
}

const cleanupErrors: unknown[] = [];
for (const cleanup of [
	async () => page?.close(),
	async () => browser?.close(),
	async () => closeServer(server),
]) {
	try {
		await cleanup();
	} catch (error) {
		cleanupErrors.push(error);
	}
}
if (primaryFailure !== undefined) {
	throw primaryFailure;
}
if (cleanupErrors.length > 0) {
	throw cleanupErrors[0];
}
