import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';

type TerraformCalloutSigil = '->' | '~>' | '!>';

interface TerraformCalloutDefinition {
	title: 'Note' | 'Warning';
	alertType: 'note' | 'warning' | 'caution';
}

const definitions: Record<TerraformCalloutSigil, TerraformCalloutDefinition> = {
	'->': { title: 'Note', alertType: 'note' },
	'~>': { title: 'Note', alertType: 'warning' },
	'!>': { title: 'Warning', alertType: 'caution' },
};

const calloutStart = /^(?:\\)?([!~-]>)[ \t]?/;

export function installTerraformCallouts(md: MarkdownIt): void {
	md.core.ruler.after(
		'block',
		'better_markdown_preview_terraform_callouts',
		(state) => {
			const output: Token[] = [];
			let listDepth = 0;
			for (let index = 0; index < state.tokens.length; index += 1) {
				const token = state.tokens[index];
				if (
					token.type === 'bullet_list_open' ||
					token.type === 'ordered_list_open'
				) {
					listDepth += 1;
				}

				const inline = state.tokens[index + 1];
				const close = state.tokens[index + 2];
				const match =
					listDepth === 0 &&
					token.type === 'paragraph_open' &&
					inline?.type === 'inline' &&
					close?.type === 'paragraph_close'
						? calloutStart.exec(inline.content)
						: null;
				const definition = match
					? definitions[match[1] as TerraformCalloutSigil]
					: undefined;
				if (match && definition) {
					output.push(
						...calloutTokens(
							state.Token,
							token,
							inline,
							close,
							match[0].length,
							definition,
						),
					);
					index += 2;
					continue;
				}

				output.push(token);
				if (
					token.type === 'bullet_list_close' ||
					token.type === 'ordered_list_close'
				) {
					listDepth -= 1;
				}
			}
			state.tokens = output;
		},
	);

	md.renderer.rules.better_markdown_preview_terraform_callout_open = (
		tokens,
		index,
		_options,
		_env,
		renderer,
	) => {
		const token = tokens[index];
		const definition = token.meta as TerraformCalloutDefinition;
		token.attrJoin(
			'class',
			`better-markdown-preview-terraform-callout better-markdown-preview-alert better-markdown-preview-alert-${definition.alertType}`,
		);
		return `<div${renderer.renderAttrs(token)}>\n`;
	};
	md.renderer.rules.better_markdown_preview_terraform_callout_close = () =>
		'</div>\n';
}

function calloutTokens(
	TokenConstructor: typeof Token,
	open: Token,
	inline: Token,
	close: Token,
	prefixLength: number,
	definition: TerraformCalloutDefinition,
): Token[] {
	const wrapperLevel = open.level;
	open.type = 'better_markdown_preview_terraform_callout_open';
	open.tag = 'div';
	open.meta = definition;

	const titleOpen = new TokenConstructor('paragraph_open', 'p', 1);
	titleOpen.block = true;
	titleOpen.level = wrapperLevel + 1;
	titleOpen.attrJoin('class', 'better-markdown-preview-alert-title');
	const titleInline = new TokenConstructor('inline', '', 0);
	titleInline.content = definition.title;
	titleInline.children = [];
	titleInline.level = wrapperLevel + 2;
	const titleClose = new TokenConstructor('paragraph_close', 'p', -1);
	titleClose.block = true;
	titleClose.level = wrapperLevel + 1;

	const bodyOpen = new TokenConstructor('paragraph_open', 'p', 1);
	bodyOpen.block = true;
	bodyOpen.level = wrapperLevel + 1;
	inline.content = inline.content.slice(prefixLength);
	inline.level = wrapperLevel + 2;
	close.level = wrapperLevel + 1;

	const calloutClose = new TokenConstructor(
		'better_markdown_preview_terraform_callout_close',
		'div',
		-1,
	);
	calloutClose.block = true;
	calloutClose.level = wrapperLevel;

	return [
		open,
		titleOpen,
		titleInline,
		titleClose,
		bodyOpen,
		inline,
		close,
		calloutClose,
	];
}
