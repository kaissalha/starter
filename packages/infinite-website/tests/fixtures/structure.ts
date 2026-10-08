import type { SiteSection } from "../../src/document/structure-schema";

export const singlePageStructure = ({ pageId, sections }: { pageId: string; sections: Array<SiteSection> }) => ({
	layout: { footer: [], header: [] },
	pages: [{ home: true, id: pageId, sections }],
});
