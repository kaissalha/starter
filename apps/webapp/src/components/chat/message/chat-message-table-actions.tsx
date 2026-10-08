"use client";

import { use, type RefObject } from "react";

import { Copy01Icon, Download01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import {
	extractTableDataFromElement,
	StreamdownContext,
	tableDataToCSV,
	tableDataToMarkdown,
	tableDataToTSV,
} from "streamdown";

import { downloadContent } from "@/utils/download-content";
import { Button } from "@starter/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@starter/ui/components/dropdown-menu";
import { useCopyToClipboard } from "@starter/ui/hooks/use-copy-to-clipboard";

const formats = {
	csv: { serialize: tableDataToCSV, type: "text/csv;charset=utf-8" },
	md: { serialize: tableDataToMarkdown, type: "text/markdown;charset=utf-8" },
	tsv: { serialize: tableDataToTSV, type: "text/tab-separated-values;charset=utf-8" },
};

export const ChatMessageTableActions = ({
	action,
	table,
}: {
	action: "copy" | "download";
	table: RefObject<HTMLTableElement | null>;
}) => {
	const t = useTranslations("components.chat.markdown");
	const { isAnimating } = use(StreamdownContext);
	const { copyToClipboard, isCopied } = useCopyToClipboard();
	const copyIcon = isCopied ? Tick02Icon : Copy01Icon;
	const formatNames: Array<keyof typeof formats> = action === "copy" ? ["csv", "tsv", "md"] : ["csv", "md"];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={t(action === "copy" && isCopied ? "copied" : action)}
						disabled={isAnimating}
						size='icon-xs'
						variant='ghost'
					/>
				}
			>
				<HugeiconsIcon
					aria-hidden='true'
					className='scale-110'
					icon={action === "download" ? Download01Icon : copyIcon}
					strokeWidth={1.75}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{formatNames.map((format) => (
					<DropdownMenuItem
						key={format}
						onClick={() => {
							if (!table.current) {
								return;
							}

							const content = formats[format].serialize(extractTableDataFromElement(table.current));

							if (action === "copy") {
								copyToClipboard(content);
							} else {
								downloadContent({ content, filename: `table.${format}`, type: formats[format].type });
							}
						}}
					>
						{t(format)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
