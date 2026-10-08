import type { WebsiteVersionRecord } from "@starter/db";
import type { PersistedWebsiteSiteV1, WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";

export const readPersistedWebsiteSite = ({ record }: { record: WebsiteVersionRecord }) => {
	return {
		assetBindings: record.assetBindings,
		brand: record.brand,
		document: { ...record.structure, content: record.content, logic: record.logic },
		schemaVersion: 1,
		templateId: record.templateId,
	} satisfies PersistedWebsiteSiteV1;
};

export const projectWebsiteSnapshot = ({ site }: { site: PersistedWebsiteSiteV1 }): WebsiteSnapshotV1 => ({
	assets: site.assetBindings,
	brand: site.brand,
	document: site.document,
	schemaVersion: 1,
	templateId: site.templateId,
});
