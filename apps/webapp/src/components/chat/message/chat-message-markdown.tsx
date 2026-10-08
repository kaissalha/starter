import { type Components, Streamdown } from "streamdown";

import { ChatMessageMarkdownCode } from "./chat-message-markdown-code";
import { ChatMessageMarkdownImage } from "./chat-message-markdown-image";
import { ChatMessageMarkdownTable } from "./chat-message-markdown-table";
import { LinkPreview } from "./link-preview";

const normalizeExternalHref = (href: string) => (href.startsWith("http") ? href : `https://${href}`);

const components: Partial<Components> = {
	...ChatMessageMarkdownTable,
	a: ({ children, href }) => {
		if (!href || (!href.startsWith("http") && !href.startsWith("www"))) {
			return <>{children}</>;
		}

		return <LinkPreview url={normalizeExternalHref(href)}>{children}</LinkPreview>;
	},
	code: ChatMessageMarkdownCode,
	img: ChatMessageMarkdownImage,
};

const streamingComponents: Partial<Components> = {
	...components,
	a: ({ children, href, ...props }) => {
		if (!href || (!href.startsWith("http") && !href.startsWith("www"))) {
			return <a {...props}>{children}</a>;
		}

		return (
			<a href={normalizeExternalHref(href)} rel='noreferrer' target='_blank' {...props}>
				{children}
			</a>
		);
	},
};

const remendOptions = { linkMode: "text-only" as const };

export const ChatMessageMarkdown = ({ children, streaming = false }: { children: string; streaming?: boolean }) => {
	return (
		<div className='typeset typeset-chat'>
			<Streamdown
				components={streaming ? streamingComponents : components}
				isAnimating={streaming}
				remend={remendOptions}
			>
				{children}
			</Streamdown>
		</div>
	);
};

ChatMessageMarkdown.displayName = "ChatMessageMarkdown";
