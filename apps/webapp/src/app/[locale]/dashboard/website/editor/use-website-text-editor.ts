import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
} from "react";

import { useTranslations } from "next-intl";

import { client } from "@/lib/api-client";
import { pendingTextContent } from "@starter/infinite-website/contracts";
import { resolveSectionContentReference } from "@starter/infinite-website/editing";
import type { SiteTextElementPropsResolver, SiteTextElementTarget } from "@starter/infinite-website/preview";
import { toast } from "@starter/ui/components/toaster";

import { useWebsiteGenerationStore } from "../generation/website-generation-store";
import type { WebsiteEditor } from "../use-website-editor";

export const useWebsiteTextEditor = ({ editor }: { editor: Pick<WebsiteEditor, "disabled" | "edit" | "pending"> }) => {
	const t = useTranslations("website.inlineEdit");
	const { disabled, edit, pending } = editor;
	const request = useRef<AbortController | null>(null);

	const [active, setActive] = useState<{
		anchor: HTMLElement;
		expanded: boolean;
		generating: boolean;
		target: SiteTextElementTarget;
	} | null>(null);

	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const keepOpen = useCallback(() => {
		if (hideTimer.current) {
			clearTimeout(hideTimer.current);
		}
	}, []);

	useEffect(() => keepOpen, [keepOpen]);

	const cancel = useCallback(() => {
		request.current?.abort();
		setActive((current) => (current?.generating ? { ...current, generating: false } : current));
	}, []);

	const close = () => {
		cancel();
		keepOpen();
		setActive(null);
	};

	const leave = useCallback(() => {
		keepOpen();
		hideTimer.current = setTimeout(() => setActive((current) => (current?.expanded ? current : null)), 180);
	}, [keepOpen]);

	const show = useCallback(
		(anchor: HTMLElement, target: SiteTextElementTarget) => {
			keepOpen();

			if (!disabled && !pending && target.content !== pendingTextContent) {
				setActive((current) =>
					current?.expanded ||
					(current?.target.nodeId === target.nodeId && current.target.content === target.content)
						? current
						: { anchor, expanded: false, generating: false, target }
				);
			}
		},
		[disabled, keepOpen, pending]
	);

	const generate = async (instruction: string) => {
		const { websiteId } = useWebsiteGenerationStore.getState();

		if (!active || !websiteId || (request.current && !request.current.signal.aborted)) {
			return;
		}

		const { anchor, target } = active;
		const controller = new AbortController();
		request.current = controller;
		setActive({ ...active, generating: true });

		try {
			const result = await client.websites.regenerateText(
				{
					instruction,
					locale: target.locale,
					pointer: target.pointer,
					sectionId: target.sectionId,
					value: target.content,
					websiteId,
				},
				{ signal: controller.signal }
			);

			if (controller.signal.aborted) {
				return;
			}

			const current = useWebsiteGenerationStore.getState();

			const content =
				current.snapshot &&
				resolveSectionContentReference({
					content: current.snapshot.document.content,
					contentId: target.contentId,
					defaultLocale: current.snapshot.document.defaultLocale,
					locale: target.locale,
					reference: { $text: target.pointer },
				});

			if (
				current.websiteId !== websiteId ||
				current.workflow.phase !== "idle" ||
				content !== target.content ||
				!anchor.isConnected ||
				anchor.textContent !== target.content
			) {
				toast.error(t("ai.changed"));
				close();

				return;
			}

			const saved = await edit({
				locale: target.locale,
				operation: "update-text",
				pointer: target.pointer,
				sectionId: target.sectionId,
				value: result.text,
			});

			if (saved && !controller.signal.aborted) {
				close();
			}
		} catch {
			if (!controller.signal.aborted) {
				toast.error(t("ai.failed"));
			}
		} finally {
			if (!controller.signal.aborted) {
				cancel();
			}
		}
	};

	const generatingNodeId = active?.generating ? active.target.nodeId : null;

	const textElementProps = useCallback<SiteTextElementPropsResolver>(
		(target) => {
			if (target.linkLabel) {
				return undefined;
			}

			const generating = target.nodeId === generatingNodeId;
			const editable = !disabled && !pending && !generating && target.content !== pendingTextContent;

			return {
				"aria-busy": generating || undefined,
				"aria-label": t("label"),
				"aria-multiline": true,
				"aria-placeholder": t("placeholder"),
				contentEditable: editable ? "plaintext-only" : false,
				"data-placeholder": t("placeholder"),
				"data-website-inline-text": "",
				"data-website-text-generating": generating ? "" : undefined,
				onBlur: (event: FocusEvent<HTMLElement>) => {
					leave();
					const value = event.currentTarget.textContent ?? "";

					if (!editable || value === target.content) {
						return;
					}

					edit({
						locale: target.locale,
						operation: "update-text",
						pointer: target.pointer,
						sectionId: target.sectionId,
						value,
					});
				},
				onClick: (event: MouseEvent<HTMLElement>) => {
					event.preventDefault();
					event.stopPropagation();
				},
				onFocus: (event: FocusEvent<HTMLElement>) => show(event.currentTarget, target),
				onKeyDown: (event: KeyboardEvent<HTMLElement>) => event.stopPropagation(),
				onPointerEnter: (event: PointerEvent<HTMLElement>) => show(event.currentTarget, target),
				onPointerLeave: (event: PointerEvent<HTMLElement>) => {
					if (event.pointerType === "mouse" || globalThis.document.activeElement !== event.currentTarget) {
						leave();
					}
				},
				role: "textbox",
				suppressContentEditableWarning: true,
				tabIndex: disabled ? -1 : 0,
			};
		},
		[disabled, edit, generatingNodeId, leave, pending, show, t]
	);

	return {
		active,
		cancel,
		close,
		expand: () => {
			keepOpen();
			setActive((current) => (current ? { ...current, expanded: true } : null));
		},
		generate,
		keepOpen,
		leave,
		textElementProps,
	};
};
