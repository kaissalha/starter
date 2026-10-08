"use client";

import { use, type ComponentProps } from "react";

import { Copy01Icon, Download01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { CodeBlock, StreamdownContext, useIsCodeFenceIncomplete, type ExtraProps } from "streamdown";

import { downloadContent } from "@/utils/download-content";
import { Button } from "@starter/ui/components/button";
import { useCopyToClipboard } from "@starter/ui/hooks/use-copy-to-clipboard";
import { cn } from "@starter/ui/lib/utils";

export const ChatMessageMarkdownCode = ({
	children,
	className,
	node,
	...props
}: ComponentProps<"code"> & ExtraProps) => {
	const t = useTranslations("components.chat.markdown");
	const { isAnimating, lineNumbers } = use(StreamdownContext);
	const incomplete = useIsCodeFenceIncomplete();
	const { copyToClipboard, isCopied } = useCopyToClipboard();

	if (!("data-block" in props)) {
		return (
			<code className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-sm", className)} {...props}>
				{children}
			</code>
		);
	}

	const code =
		node?.children
			.filter((child) => child.type === "text")
			.map((child) => child.value)
			.join("") ?? "";

	const language = className?.match(/language-([^\s]+)/)?.[1] ?? "";
	const meta = String(node?.properties.metastring ?? "");
	const startLine = Number(meta.match(/\bstartLine=(\d+)/)?.[1]) || undefined;

	return (
		<CodeBlock
			code={code}
			isIncomplete={incomplete}
			language={language}
			lineNumbers={lineNumbers !== false && !meta.includes("showLineNumbers=false")}
			startLine={startLine}
		>
			<Button
				aria-label={t("downloadCode")}
				disabled={isAnimating}
				onClick={() =>
					downloadContent({
						content: code,
						filename: `code.${language || "txt"}`,
						type: "text/plain;charset=utf-8",
					})
				}
				size='icon-xs'
				variant='ghost'
			>
				<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Download01Icon} strokeWidth={1.75} />
			</Button>
			<Button
				aria-label={t(isCopied ? "copied" : "copyCode")}
				disabled={isAnimating}
				onClick={() => copyToClipboard(code)}
				size='icon-xs'
				variant='ghost'
			>
				<HugeiconsIcon
					aria-hidden='true'
					className='scale-110'
					icon={isCopied ? Tick02Icon : Copy01Icon}
					strokeWidth={1.75}
				/>
			</Button>
		</CodeBlock>
	);
};
