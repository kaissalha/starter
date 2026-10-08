import type { WebsiteAssetBindings, WebsiteSnapshotV1 } from "@starter/infinite-website/contracts";
import {
	editWebsiteSnapshots,
	prepareWebsiteEditInputs,
	type WebsiteEditInput,
} from "@starter/infinite-website/editing";
import { getTemplateBrand, templatePreviews } from "@starter/infinite-website/template-previews";

type Store = {
	id: string;
	snapshot: WebsiteSnapshotV1;
	updatedAt: string;
};

const stores = new Map<string, Store>();

export class WebsiteMutationConflictError extends Error {
	constructor() {
		super("This website already has an active operation or changed elsewhere.");
		this.name = "WebsiteMutationConflictError";
	}
}

const nextRevision = (current: string) => new Date(Math.max(Date.now(), Date.parse(current) + 1)).toISOString();

export const seedWebsite = ({
	organizationId,
	removeCategories = [],
	templateId,
}: {
	organizationId: string;
	removeCategories?: Array<string>;
	templateId: string;
}) => {
	const preview = templatePreviews.find(({ id }) => id === templateId);

	if (!preview) {
		throw new Error(`Template "${templateId}" not found`);
	}

	const store: Store = {
		id: crypto.randomUUID(),
		snapshot: {
			assets: preview.assets,
			brand: getTemplateBrand({ templateId }),
			document: preview.document,
			schemaVersion: 1,
			templateId,
		},
		updatedAt: new Date().toISOString(),
	};

	const home = store.snapshot.document.structure.pages.find((page) => page.home);

	const removals = (home?.sections ?? []).flatMap(({ category, id }) =>
		home && removeCategories.includes(category)
			? [{ operation: "delete" as const, pageId: home.id, sectionId: id }]
			: []
	);

	if (removals.length > 0) {
		const { brand, document } = editWebsiteSnapshots({ inputs: removals, snapshot: store.snapshot });
		store.snapshot = { ...store.snapshot, brand, document };
	}

	stores.set(organizationId, store);

	return store;
};

export const readSeededWebsite = (organizationId: string) => {
	const store = stores.get(organizationId);

	if (!store) {
		throw new Error("Website not seeded");
	}

	return store;
};

export const getWebsite = async ({ organizationId }: { organizationId: string }) => {
	const store = stores.get(organizationId);

	return store
		? {
				brief: null,
				createdAt: store.updatedAt,
				id: store.id,
				locale: store.snapshot.document.defaultLocale,
				publication: { hasUnpublishedChanges: false, publishedAt: null },
				snapshot: store.snapshot,
				updatedAt: store.updatedAt,
				workflow: null,
			}
		: null;
};

export const editWebsite = async ({
	assetBindings,
	inputs,
	organizationId,
	updatedAt,
}: {
	assetBindings?: WebsiteAssetBindings;
	inputs: Array<WebsiteEditInput>;
	organizationId: string;
	updatedAt: string;
}) => {
	const store = readSeededWebsite(organizationId);

	if (store.updatedAt !== updatedAt) {
		throw new WebsiteMutationConflictError();
	}

	const { brand, document } = editWebsiteSnapshots({
		inputs: await prepareWebsiteEditInputs(inputs),
		snapshot: store.snapshot,
	});

	store.snapshot = { ...store.snapshot, assets: { ...store.snapshot.assets, ...assetBindings }, brand, document };
	store.updatedAt = nextRevision(store.updatedAt);

	return { updatedAt: store.updatedAt };
};

const placeholderPalette = ["#c9d6df", "#e3d5ca", "#d4e2d4", "#e5d4e8", "#f0e6c8", "#cfd8e8"];

export const resolveWebsiteAuthoringMedia = async (media: Readonly<Record<string, { query: string }>>) => {
	const entries = Object.keys(media).map((key, index) => ({ id: crypto.randomUUID(), index, key }));

	const svg = (index: number) =>
		`data:image/svg+xml;utf8,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="${placeholderPalette[index % placeholderPalette.length]}"/></svg>`
		)}`;

	return {
		assets: Object.fromEntries(entries.map(({ id, key }) => [key, id])),
		bindings: Object.fromEntries(
			entries.map(({ id, index }) => [
				id,
				{ height: 800, loading: "lazy", src: svg(index), type: "image", width: 1200 },
			])
		),
	};
};

export const websiteServiceOverrides = { editWebsite, getWebsite, WebsiteMutationConflictError };
