"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import { useBusinessLogo } from "@/components/business-logo-field";
import { useOrganizationPermissions } from "@/hooks/use-organization-permissions";
import { apiClient, client } from "@/lib/api-client";
import { downloadContent } from "@/utils/download-content";
import type { BrandUpdate } from "@starter/infinite-brand";
import {
	applyLinkPageTheme,
	linkPageDocumentSchema,
	resolveLinkPageBrand,
	type LinkPageAppearance,
	type LinkPageBlock,
	type LinkPageBlockKind,
	type LinkPageDocument,
	type LinkPageLink,
	type LinkPageLocale,
	type LinkPageProfile,
	type LinkPageSectionAppearance,
	type LinkPageSocial,
	type LinkPageSurfaceAppearance,
	type LinkPageSocialPlatform,
	type LinkPageState,
	type LinkPageTextTarget,
	type LinkPageTheme,
} from "@starter/infinite-links";
import {
	appearanceOperations,
	blockOperations,
	collectionOperations,
	socialOperations,
} from "@starter/infinite-links/editing";
import type { Iso6391LanguageCode } from "@starter/infinite-website";
import { toast } from "@starter/ui/components/toaster";

import { useEditorDraftSession } from "../components/editor/use-editor-draft-session";
import { useWebsiteLanguages } from "../components/editor/use-website-languages";
import {
	createLinkPageBlock,
	createLinkPageLink,
	createLinkPagePresetLink,
	createLinkPageSocial,
	createLinkPageUrlLink,
	type LinkPagePreset,
} from "./links-document-operations";
import { useLinksEditorView } from "./use-links-editor-view";

const documentSignature = (document: LinkPageDocument) => JSON.stringify(document);

const historyGroupMs = 800;

const historyLimit = 50;

const indexSchema = z.number().int().nonnegative();

type LinkPageSaveRequest = {
	document: LinkPageDocument;
	resolvers: Array<(state: LinkPageState | null) => void>;
};

type LinksDraftSession = {
	document: LinkPageDocument;
	error: "conflict" | "request" | null;
	publishing: boolean;
	recoveryDocument: LinkPageDocument | null;
	saved: LinkPageState;
	saveQueue: Array<LinkPageSaveRequest>;
	saving: boolean;
};

const hasPendingLinksDraft = (state: LinksDraftSession) =>
	state.saving ||
	state.publishing ||
	state.error !== null ||
	documentSignature(state.document) !== documentSignature(state.saved.document);

const resolveLinkPageSaveRequest = (request: LinkPageSaveRequest, state: LinkPageState | null) => {
	for (const resolve of request.resolvers) {
		resolve(state);
	}
};

const updateInlineText = ({
	document,
	locale,
	target,
	value,
}: {
	document: LinkPageDocument;
	locale: LinkPageLocale;
	target: LinkPageTextTarget;
	value: string;
}) => {
	const copy = (current: Partial<Record<string, string>>) => ({
		...current,
		[locale]: value.slice(0, target.maxLength),
	});

	if (target.kind === "profile") {
		return appearanceOperations.profile(document, { [target.field]: copy(document.profile[target.field] ?? {}) });
	}

	if (target.kind === "collectionLink") {
		return collectionOperations.updateLink(document, target.blockId, target.linkId, (link) => ({
			...link,
			label: copy(link.label),
		}));
	}

	return blockOperations.patch(document, target.blockId, (block) => {
		switch (target.field) {
			case "buttonLabel":
				return block.kind === "text" && block.button
					? { ...block, button: { ...block.button, label: copy(block.button.label) } }
					: block;
			case "label":
				return block.kind === "link" ? { ...block, label: copy(block.label) } : block;
			case "text":
				return block.kind === "header" || block.kind === "text" ? { ...block, text: copy(block.text) } : block;
			case "title":
				return block.kind === "collection" || block.kind === "video"
					? { ...block, title: copy(block.title) }
					: block;
		}
	});
};

const collectInvalidBlockIds = ({
	document,
	issues,
}: {
	document: LinkPageDocument;
	issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>;
}) => {
	const ids = new Set<string>();

	for (const issue of issues) {
		const [root, blockIndex, nested, linkIndex] = issue.path;
		const blockPosition = indexSchema.safeParse(blockIndex);

		if (root !== "blocks" || !blockPosition.success) {
			continue;
		}

		const block = document.blocks[blockPosition.data];

		if (!block) {
			continue;
		}

		ids.add(block.id);
		const linkPosition = indexSchema.safeParse(linkIndex);

		if (block.kind === "collection" && nested === "links" && linkPosition.success) {
			const link = block.links[linkPosition.data];

			if (link) {
				ids.add(link.id);
			}
		}
	}

	return ids;
};

const useLinksPersistence = ({
	isActive,
	store,
	valid,
}: {
	isActive: () => boolean;
	store: StoreApi<LinksDraftSession>;
	valid: { data: LinkPageDocument; success: true } | { success: false };
}) => {
	const { can } = useOrganizationPermissions();
	const queryClient = useQueryClient();
	const t = useTranslations("links");
	const { document, error, publishing, recoveryDocument, saved: state, saving } = useStore(store);
	const dirty = documentSignature(document) !== documentSignature(state.document);
	const retries = useRef(0);

	const adoptState = useCallback(
		(nextState: LinkPageState) => {
			store.setState({ saved: nextState });

			if (isActive()) {
				queryClient.setQueryData(apiClient.linkPages.get.queryKey(), nextState);
			}

			return nextState;
		},
		[isActive, queryClient, store]
	);

	const recover = useCallback(async () => {
		try {
			const recovered = await queryClient.query({
				...apiClient.linkPages.get.queryOptions(),
				staleTime: 0,
			});

			const current = store.getState();
			adoptState(recovered);
			store.setState({
				document: recovered.document,
				error: null,
				recoveryDocument:
					documentSignature(current.document) !== documentSignature(current.saved.document)
						? current.document
						: current.recoveryDocument,
			});

			return true;
		} catch {
			toast.error(t("save.failed"));

			return false;
		}
	}, [adoptState, queryClient, store, t]);

	const persistSaveRequest = useCallback(
		async (request: LinkPageSaveRequest) => {
			if (!isActive() || !can("workspace.write")) {
				resolveLinkPageSaveRequest(request, null);

				return;
			}

			const current = store.getState();

			if (documentSignature(request.document) === documentSignature(current.saved.document)) {
				resolveLinkPageSaveRequest(request, current.saved);

				return;
			}

			try {
				const saved = adoptState(
					await client.linkPages.save({
						document: request.document,
						updatedAt: current.saved.updatedAt,
					})
				);

				resolveLinkPageSaveRequest(request, saved);
			} catch (error) {
				store.setState({
					error: error instanceof ORPCError && error.code === "CONFLICT" ? "conflict" : "request",
				});
				resolveLinkPageSaveRequest(request, null);

				for (const queuedRequest of store.getState().saveQueue.splice(0)) {
					resolveLinkPageSaveRequest(queuedRequest, null);
				}
			}
		},
		[can, adoptState, isActive, store]
	);

	const flushSaveQueue = useCallback(async () => {
		if (store.getState().saving) {
			return;
		}

		store.setState({ saving: true });

		try {
			while (store.getState().saveQueue.length > 0) {
				const request = store.getState().saveQueue.shift();

				if (request) {
					await persistSaveRequest(request);
				}
			}
		} finally {
			store.setState({ saving: false });
		}
	}, [persistSaveRequest, store]);

	const save = useCallback(
		(nextDocument: LinkPageDocument) => {
			const current = store.getState();

			if (current.error === "conflict") {
				return Promise.resolve(null);
			}

			const request = Promise.withResolvers<LinkPageState | null>();
			const queuedRequest = current.saveQueue.at(-1);

			if (current.saving && queuedRequest) {
				queuedRequest.document = nextDocument;
				queuedRequest.resolvers.push(request.resolve);
			} else {
				current.saveQueue.push({ document: nextDocument, resolvers: [request.resolve] });
			}

			if (current.error !== null) {
				store.setState({ error: null });
			}

			flushSaveQueue();

			return request.promise;
		},
		[flushSaveQueue, store]
	);

	useEffect(() => {
		if (!dirty) {
			retries.current = 0;

			return;
		}

		const retry = error === "request";

		if (
			!can("workspace.write") ||
			error === "conflict" ||
			publishing ||
			!valid.success ||
			(retry && retries.current > 1)
		) {
			return;
		}

		const draft = valid.data;

		const timer = setTimeout(
			() => {
				if (retry) {
					retries.current += 1;
				}

				save(draft);
			},
			retry ? 1000 * 3 ** retries.current : 800
		);

		return () => clearTimeout(timer);
	}, [can, dirty, error, publishing, save, valid]);

	const publish = async () => {
		if (!isActive() || !can("workspace.write")) {
			return null;
		}

		if (!valid.success) {
			toast.error(t("validation.invalid"));

			return null;
		}

		store.setState({ publishing: true });

		try {
			const saved = await save(valid.data);

			if (!isActive() || !saved?.updatedAt) {
				return null;
			}

			const published = adoptState(await client.linkPages.publish({ updatedAt: saved.updatedAt }));
			toast.success(t("publish.success"));

			return published;
		} catch (error) {
			toast.error(t("publish.failed"));

			if (error instanceof ORPCError && error.code === "CONFLICT") {
				store.setState({ error: "conflict" });
			}

			return null;
		} finally {
			store.setState({ publishing: false });
		}
	};

	return { adoptState, dirty, error, publish, publishing, recover, recoveryDocument, save, saving, state };
};

const useLinksTranslation = ({
	document,
	languages,
	onTranslated,
	persistence,
}: {
	document: LinkPageDocument;
	languages: ReturnType<typeof useWebsiteLanguages>;
	onTranslated: (document: LinkPageDocument, locale: Iso6391LanguageCode) => void;
	persistence: ReturnType<typeof useLinksPersistence>;
}) => {
	const { can } = useOrganizationPermissions();
	const translationMessages = useTranslations("website.languages");
	const [translating, setTranslating] = useState(false);

	const translate = async (nextLocale: Iso6391LanguageCode) => {
		if (!can("workspace.write") || translating) {
			return false;
		}

		setTranslating(true);

		try {
			const saved = await persistence.save(document);

			if (!saved) {
				return false;
			}

			await languages.add(nextLocale);
			const translated = await client.linkPages.get();
			persistence.adoptState(translated);
			onTranslated(translated.document, nextLocale);
		} catch {
			toast.error(translationMessages("failed"));
			await persistence.recover();

			return false;
		} finally {
			setTranslating(false);
		}

		return true;
	};

	return { translate, translating };
};

const useLinksDraft = (initialState: LinkPageState) => {
	const session = useEditorDraftSession<LinksDraftSession>({
		create: (_active, previous) => ({
			document: initialState.document,
			error: null,
			publishing: false,
			recoveryDocument: previous?.recoveryDocument ?? null,
			saved: initialState,
			saveQueue: [],
			saving: false,
		}),
		id: `links:${initialState.id}`,
		resume: hasPendingLinksDraft,
		retain: (state) => hasPendingLinksDraft(state) || state.recoveryDocument !== null,
	});

	const { store } = session;
	const document = useStore(store, (state) => state.document);

	const [history, setHistory] = useState<{ future: Array<LinkPageDocument>; past: Array<LinkPageDocument> }>({
		future: [],
		past: [],
	});

	const lastEdit = useRef(0);

	const setDocument = useCallback(
		(update: (current: LinkPageDocument) => LinkPageDocument) => {
			const current = store.getState().document;
			const next = update(current);

			if (documentSignature(next) === documentSignature(current)) {
				return;
			}

			const now = Date.now();
			const grouped = now - lastEdit.current < historyGroupMs;
			lastEdit.current = now;
			setHistory((value) => ({
				future: [],
				past: grouped ? value.past : [...value.past, current].slice(-historyLimit),
			}));
			store.setState({ document: next });
		},
		[store]
	);

	const replaceDocument = useCallback((next: LinkPageDocument) => store.setState({ document: next }), [store]);

	const step = (direction: "redo" | "undo") => {
		const source = direction === "undo" ? history.past : history.future;
		const target = direction === "undo" ? source.at(-1) : source[0];

		if (!target) {
			return;
		}

		const current = store.getState().document;
		lastEdit.current = 0;
		setHistory(
			direction === "undo"
				? { future: [current, ...history.future], past: history.past.slice(0, -1) }
				: { future: history.future.slice(1), past: [...history.past, current] }
		);
		store.setState({ document: target });
	};

	return {
		...session,
		document,
		history: {
			canRedo: history.future.length > 0,
			canUndo: history.past.length > 0,
			redo: () => step("redo"),
			undo: () => step("undo"),
		},
		replaceDocument,
		setDocument,
	};
};

const createLinksBlockActions = ({
	brand,
	document,
	locales,
	openBlock,
	setDocument,
}: {
	brand: { defaultLocale: LinkPageLocale };
	document: LinkPageDocument;
	locales: ReadonlyArray<LinkPageLocale>;
	openBlock: (id: string) => void;
	setDocument: (update: (current: LinkPageDocument) => LinkPageDocument) => void;
}) => {
	const insert = ({
		block,
		index,
		placement = "page",
	}: {
		block: LinkPageBlock;
		index?: number;
		placement?: "header" | "page";
	}) => {
		setDocument((current) => blockOperations.add(current, block, index, placement));
		openBlock(block.id);
	};

	return {
		addBlock: ({
			index,
			kind,
			placement,
		}: {
			index?: number;
			kind: LinkPageBlockKind;
			placement?: "header" | "page";
		}) => insert({ block: createLinkPageBlock({ kind, locales }), index, placement }),
		addPresetLink: ({
			index,
			placement,
			preset,
		}: {
			index?: number;
			placement?: "header" | "page";
			preset: LinkPagePreset;
		}) =>
			insert({
				block: createLinkPagePresetLink({
					businessName: document.profile.title[brand.defaultLocale] ?? "",
					locales,
					preset,
				}),
				index,
				placement,
			}),
		addUrlLink: ({
			index,
			label,
			placement,
			url,
		}: {
			index?: number;
			label: string;
			placement?: "header" | "page";
			url: string;
		}) => insert({ block: createLinkPageUrlLink({ label, locales, url }), index, placement }),
	};
};

export const useLinksPageController = ({ initialState }: { initialState: LinkPageState }) => {
	const { can, role } = useOrganizationPermissions();
	const languages = useWebsiteLanguages();
	const draft = useLinksDraft(initialState);
	const { document, isActive, replaceDocument, setDocument, store } = draft;
	const [selectedLocale, setLocale] = useState<LinkPageLocale>(initialState.inheritedBrand.defaultLocale);
	const [mode, setModeState] = useState<"edit" | "preview">("edit");

	const { baseline, cancelView, setView, view } = useLinksEditorView({
		document,
		restore: (restored) => setDocument(() => restored),
	});

	const selectedBlockId = view.kind === "block" ? view.id : null;

	const openBlock = (id: string) => {
		setView({ id, kind: "block" });
	};

	const validation = useMemo(() => linkPageDocumentSchema.safeParse(document), [document]);
	const persistence = useLinksPersistence({ isActive, store, valid: validation });

	const { translate, translating } = useLinksTranslation({
		document,
		languages,
		onTranslated: (translated, locale) => {
			replaceDocument(translated);
			setLocale(locale);
		},
		persistence,
	});

	const locales = languages.document?.locales ?? persistence.state.inheritedBrand.locales;

	const brand = resolveLinkPageBrand({
		brandOverride: document.appearance.brandOverride,
		inheritedBrand: {
			...persistence.state.inheritedBrand,
			defaultLocale: languages.document?.defaultLocale ?? persistence.state.inheritedBrand.defaultLocale,
			locales,
		},
	});

	const locale = locales.includes(selectedLocale) ? selectedLocale : brand.defaultLocale;

	const invalidBlockIds = useMemo(
		() =>
			validation.success
				? new Set<string>()
				: collectInvalidBlockIds({ document, issues: validation.error.issues }),
		[document, validation]
	);

	const logo = useBusinessLogo({
		onSaved: async () => {
			const { inheritedBrand, publication } = await client.linkPages.get();
			store.setState(({ saved }) => ({ saved: { ...saved, inheritedBrand, publication } }));
		},
	});

	const publish = async () => {
		const submitted = documentSignature(store.getState().document);
		const published = await persistence.publish();

		if (published && documentSignature(store.getState().document) === submitted) {
			replaceDocument(published.document);
		}
	};

	return {
		...createLinksBlockActions({ brand, document, locales, openBlock, setDocument }),
		...draft.history,
		addCollectionLink: ({ collectionId }: { collectionId: string }) =>
			setDocument((current) =>
				collectionOperations.addLink(current, collectionId, createLinkPageLink({ locales }))
			),
		addSocial: ({ blockId, platform }: { blockId: string; platform: LinkPageSocialPlatform }) => {
			setDocument((current) => socialOperations.add(current, blockId, createLinkPageSocial(platform)));
			setView({ id: blockId, kind: "block" });
		},
		applyTheme: ({ theme }: { theme: LinkPageTheme }) =>
			setDocument((current) => applyLinkPageTheme({ document: current, theme })),
		brand,
		can,
		cancelView,
		changeLogo: logo.change,
		changingLogo: logo.pending,
		dirty: persistence.dirty,
		dismissRecovery: () => store.setState({ recoveryDocument: null }),
		document,
		downloadDraft: () =>
			downloadContent({
				content: JSON.stringify(
					persistence.error ? document : (persistence.recoveryDocument ?? document),
					null,
					2
				),
				filename: "links-draft.json",
				type: "application/json",
			}),
		error: persistence.error,
		hasRecovery: persistence.recoveryDocument !== null,
		invalidBlockIds,
		languages,
		locale,
		locales,
		mode: role === "owner" || role === "admin" ? mode : "preview",
		moveBlock: ({ id, offset }: { id: string; offset: -1 | 1 }) =>
			setDocument((current) => blockOperations.move(current, id, offset)),
		openBlock,
		publish,
		publishing: persistence.publishing,
		refresh: persistence.recover,
		removeBlock: ({ id }: { id: string }) => {
			if (!can("workspace.delete")) {
				return;
			}

			setDocument((current) => blockOperations.remove(current, id));

			if ((view.kind === "block" || view.kind === "add-social") && view.id === id) {
				setView({ kind: "root" });
			}
		},
		removeCollectionLink: ({ collectionId, linkId }: { collectionId: string; linkId: string }) =>
			can("workspace.delete") &&
			setDocument((current) => collectionOperations.removeLink(current, collectionId, linkId)),
		removeSocial: ({ blockId, id }: { blockId: string; id: string }) =>
			can("workspace.delete") && setDocument((current) => socialOperations.remove(current, blockId, id)),
		reorderCollectionLinks: ({ collectionId, orderedIds }: { collectionId: string; orderedIds: Array<string> }) =>
			setDocument((current) => collectionOperations.reorderLinks(current, collectionId, orderedIds)),
		reorderSocials: ({ blockId, orderedIds }: { blockId: string; orderedIds: Array<string> }) =>
			setDocument((current) => socialOperations.reorder(current, blockId, orderedIds)),
		resetToBrand: () => setDocument((current) => appearanceOperations.resetToBrand(current)),
		retrySave: () => (validation.success ? persistence.save(validation.data) : Promise.resolve(null)),
		saving: persistence.saving,
		selectedBlockId,
		selectLocale: (nextLocale: LinkPageLocale) => {
			if (locales.includes(nextLocale)) {
				setLocale(nextLocale);
			}
		},
		setMode: (nextMode: "edit" | "preview") => {
			setModeState(nextMode);

			if (nextMode === "preview") {
				setView({ kind: "root" });
			}
		},
		setRedirect: ({ blockId }: { blockId: string | null }) =>
			setDocument((current) => appearanceOperations.redirect(current, blockId)),
		setSectionHeaderLinked: ({ id, linked }: { id: string; linked: boolean }) =>
			setDocument((current) => blockOperations.setHeaderLinked(current, id, linked)),
		setView,
		state: persistence.state,
		translate,
		translating,
		updateAppearance: (update: Partial<Omit<LinkPageAppearance, "brandOverride" | "buttons" | "wallpaper">>) =>
			setDocument((current) => appearanceOperations.patch(current, update)),
		updateBlock: <Kind extends LinkPageBlockKind>({
			id,
			kind,
			update,
		}: {
			id: string;
			kind: Kind;
			update: (block: Extract<LinkPageBlock, { kind: Kind }>) => LinkPageBlock;
		}) => setDocument((current) => blockOperations.update(current, id, kind, update)),
		updateBlockAppearance: ({
			id,
			update,
		}: {
			id: string;
			update: (appearance: LinkPageSectionAppearance) => LinkPageSectionAppearance;
		}) =>
			setDocument((current) =>
				blockOperations.patch(current, id, (block) => ({ ...block, appearance: update(block.appearance) }))
			),
		updateBrandOverride: (brandOverride: BrandUpdate | null) =>
			setDocument((current) => appearanceOperations.brandOverride(current, brandOverride)),
		updateButtonColors: (colors: Partial<LinkPageAppearance["buttons"]["colors"]>) =>
			setDocument((current) => appearanceOperations.buttonColors(current, colors)),
		updateButtons: (buttons: Partial<Omit<LinkPageAppearance["buttons"], "colors">>) =>
			setDocument((current) => appearanceOperations.buttons(current, buttons)),
		updateCollectionLink: ({
			collectionId,
			linkId,
			update,
		}: {
			collectionId: string;
			linkId: string;
			update: (link: LinkPageLink) => LinkPageLink;
		}) => setDocument((current) => collectionOperations.updateLink(current, collectionId, linkId, update)),
		updateHeaderAppearance: (update: Partial<LinkPageSurfaceAppearance>) =>
			setDocument((current) =>
				appearanceOperations.patch(current, {
					header: { ...current.appearance.header, ...update },
				})
			),
		updateInlineText: ({ target, value }: { target: LinkPageTextTarget; value: string }) =>
			setDocument((current) => updateInlineText({ document: current, locale, target, value })),
		updateProfile: (update: Partial<LinkPageProfile>) =>
			setDocument((current) => appearanceOperations.profile(current, update)),
		updateSocial: ({
			blockId,
			id,
			update,
		}: {
			blockId: string;
			id: string;
			update: (social: LinkPageSocial) => LinkPageSocial;
		}) => setDocument((current) => socialOperations.update(current, blockId, id, update)),
		updateWallpaper: (wallpaper: Partial<LinkPageAppearance["wallpaper"]>) =>
			setDocument((current) => appearanceOperations.wallpaper(current, wallpaper)),
		valid: validation.success,
		view,
		viewDirty: baseline !== null && documentSignature(baseline) !== documentSignature(document),
	};
};

export type LinksPageController = ReturnType<typeof useLinksPageController>;
