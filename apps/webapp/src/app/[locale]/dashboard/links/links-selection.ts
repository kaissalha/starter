import { revealInScrollArea } from "../components/editor/reveal-in-scroll-area";
import type { LinksPageController } from "./use-links-page-controller";

export const findLinksSelectionContent = ({ blockId, frame }: { blockId: string | null; frame: HTMLElement }) => {
	if (!blockId) {
		return frame.querySelector<HTMLElement>("[data-links-profile]") ?? undefined;
	}

	const block = frame.querySelector<HTMLElement>(`[data-links-block-id="${blockId}"]`);

	return block?.querySelector<HTMLElement>("[data-links-block-content]") ?? block ?? undefined;
};

export const revealLinksSelection = ({ blockId, frame }: { blockId: string | null; frame: HTMLElement | null }) =>
	revealInScrollArea(frame && findLinksSelectionContent({ blockId, frame }));

export const followLinksSelection = ({
	controller,
	element,
}: {
	controller: LinksPageController;
	element: Element;
}) => {
	const blockId = element.closest<HTMLElement>("[data-links-block-id]")?.dataset.linksBlockId;

	if (blockId) {
		controller.openBlock(blockId);
	} else {
		controller.setView({ kind: "design", section: "header" });
	}
};
