"use client";

import { use, useRef, type ComponentProps, type ReactNode } from "react";

import { Maximize01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { StreamdownContext, type Components } from "streamdown";

import { Button } from "@starter/ui/components/button";
import { Dialog, DialogClose, DialogPopup, DialogTrigger } from "@starter/ui/components/dialog";

import { ChatMessageTableActions } from "./chat-message-table-actions";

type TableProps = ComponentProps<"table"> & { node?: unknown };

type TheadProps = ComponentProps<"thead"> & { node?: unknown };

type TbodyProps = ComponentProps<"tbody"> & { node?: unknown };

type TrProps = ComponentProps<"tr"> & { node?: unknown };

type ThProps = ComponentProps<"th"> & { node?: unknown };

type TdProps = ComponentProps<"td"> & { node?: unknown };

const TableFullscreenButton = ({ children }: { children: ReactNode }) => {
	const t = useTranslations("components.chat.markdown");
	const { isAnimating } = use(StreamdownContext);
	const table = useRef<HTMLTableElement>(null);

	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button
						aria-label={t("viewFullscreen")}

						disabled={isAnimating}
						size='icon-xs'
						title={t("viewFullscreen")}
						type='button'
						variant='ghost'
					/>
				}
			>
				<HugeiconsIcon
					aria-hidden='true'
					className='scale-110'
					icon={Maximize01Icon}

					strokeWidth={1.75}
				/>
			</DialogTrigger>
			<DialogPopup
				aria-label={t("viewFullscreen")}

				data-streamdown='table-fullscreen'
				fullScreen
				showCloseButton={false}
			>
				<div className='flex h-full min-h-0 flex-col'>
					<div className='flex items-center justify-end gap-1 p-4'>
						<ChatMessageTableActions action='copy' table={table} />
						<ChatMessageTableActions action='download' table={table} />
						<DialogClose
							render={
								<Button
									aria-label={t("exitFullscreen")}

									size='icon-sm'
									type='button'
									variant='ghost'
								/>
							}
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={Cancel01Icon}

								strokeWidth={1.75}
							/>
						</DialogClose>
					</div>
					<div className='typeset typeset-chat flex-1 overflow-auto p-4 pt-0 [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-background'>
						<table data-streamdown='table' ref={table}>
							{children}
						</table>
					</div>
				</div>
			</DialogPopup>
		</Dialog>
	);
};

const MarkdownTable = ({ children }: TableProps) => {
	const table = useRef<HTMLTableElement>(null);

	return (
		<div className='mt-4 flex flex-col gap-2' data-streamdown='table-wrapper'>
			<div className='flex items-center justify-end gap-1'>
				<ChatMessageTableActions action='copy' table={table} />
				<ChatMessageTableActions action='download' table={table} />
				<TableFullscreenButton>{children}</TableFullscreenButton>
			</div>
			<div className='overflow-x-auto'>
				<table data-streamdown='table' ref={table}>
					{children}
				</table>
			</div>
		</div>
	);
};

const markdownThead = ({ children, className: _className, node: _node, ...props }: TheadProps) => {
	return (
		<thead data-streamdown='table-header' {...props}>
			{children}
		</thead>
	);
};

const markdownTbody = ({ children, className: _className, node: _node, ...props }: TbodyProps) => {
	return (
		<tbody data-streamdown='table-body' {...props}>
			{children}
		</tbody>
	);
};

const markdownTr = ({ children, className: _className, node: _node, ...props }: TrProps) => {
	return (
		<tr data-streamdown='table-row' {...props}>
			{children}
		</tr>
	);
};

const markdownTh = ({ children, className: _className, node: _node, ...props }: ThProps) => {
	return (
		<th data-streamdown='table-header-cell' {...props}>
			{children}
		</th>
	);
};

const markdownTd = ({ children, className: _className, node: _node, ...props }: TdProps) => {
	return (
		<td data-streamdown='table-cell' {...props}>
			{children}
		</td>
	);
};

export const ChatMessageMarkdownTable = {
	table: MarkdownTable,
	tbody: markdownTbody,
	td: markdownTd,
	th: markdownTh,
	thead: markdownThead,
	tr: markdownTr,
} satisfies Partial<Components>;
