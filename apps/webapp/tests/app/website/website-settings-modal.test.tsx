import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, expect, it, vi } from "vitest";

import { EditorLanguageSelect } from "@/app/[locale]/dashboard/components/editor/editor-language-select";
import { WebsiteSettingsModal } from "@/app/[locale]/dashboard/components/editor/website-settings-modal";
import en from "@/i18n/messages/en.json";
import { defaultWebsiteSettings } from "@starter/infinite-website";

vi.unmock("next-intl");

const mocks = vi.hoisted(() => ({
	add: vi.fn(),
	edit: vi.fn(),
	main: vi.fn(),
	mobile: false,
	publishedAt: "",
	unpublish: vi.fn(),
	url: vi.fn(),
}));

vi.mock("@starter/ui/hooks/use-is-mobile", () => ({ useIsMobile: () => mocks.mobile }));

vi.mock("@/app/[locale]/dashboard/website/website-domains-panel", () => ({ WebsiteDomainsContent: () => null }));

vi.mock("@/app/[locale]/dashboard/components/editor/use-website-languages", () => ({
	useWebsiteLanguages: () => ({
		add: mocks.add,
		document: {
			content: { en: { site: { name: "Studio" } } },
			defaultLocale: "en",
			locales: ["en", "ar"],
			settings: defaultWebsiteSettings,
		},
		edit: mocks.edit,
		enabled: true,
		pending: false,
		setDefault: mocks.main,
		unpublish: mocks.unpublish,
		unpublishing: false,
		website: { id: "website", publication: { hasUnpublishedChanges: false, publishedAt: mocks.publishedAt } },
	}),
}));

beforeEach(() => {
	mocks.mobile = false;
	mocks.publishedAt = "";
	mocks.unpublish.mockReset().mockResolvedValue({});
	mocks.add.mockReset();
	mocks.edit.mockReset().mockResolvedValue({});
});

const mount = (searchParams = "") =>
	render(
		<NuqsTestingAdapter hasMemory onUrlUpdate={mocks.url} searchParams={searchParams}>
			<NextIntlClientProvider locale='en' messages={en}>
				<EditorLanguageSelect
					allowAddLanguage
					locale='en'
					locales={["en", "ar"]}
					onLocaleChange={() => undefined}
				/>
				<WebsiteSettingsModal />
			</NextIntlClientProvider>
		</NuqsTestingAdapter>
	);

it("opens the Credenza, navigates with URL state, and saves a validated setting", async () => {
	const user = userEvent.setup();
	mount();
	await user.click(screen.getByRole("button", { name: "Site settings" }));
	const dialog = await screen.findByRole("dialog", { name: "Site settings" });
	await user.click(within(dialog).getByRole("button", { name: "Integrations" }));
	await user.type(within(dialog).getByRole("textbox", { name: "Google Analytics measurement ID" }), "G-TEST123");
	await user.click(within(dialog).getByRole("button", { name: "Save" }));
	await waitFor(() =>
		expect(mocks.edit).toHaveBeenCalledWith({
			operation: "update-settings",
			settings: { ...defaultWebsiteSettings, googleAnalyticsId: "G-TEST123" },
		})
	);
	await user.click(within(dialog).getByRole("button", { name: "Languages" }));
	await user.click(within(dialog).getByRole("button", { name: "Set as main language" }));
	expect(mocks.main).toHaveBeenCalledWith("ar");
	await waitFor(() =>
		expect(mocks.url).toHaveBeenLastCalledWith(
			expect.objectContaining({ queryString: "?websiteSettings=languages" })
		)
	);
});

it("hides unpublish until the website is published and confirms before unpublishing", async () => {
	const user = userEvent.setup();
	const first = mount("?websiteSettings=integrations");
	const initial = await screen.findByRole("dialog", { name: "Site settings" });
	expect(within(initial).queryByRole("button", { name: "Unpublish website" })).not.toBeInTheDocument();
	first.unmount();
	mocks.publishedAt = "2026-09-28T00:00:00.000Z";
	mount("?websiteSettings=integrations");
	const dialog = await screen.findByRole("dialog", { name: "Site settings" });
	await user.click(within(dialog).getByRole("button", { name: "Unpublish website" }));
	expect(mocks.unpublish).not.toHaveBeenCalled();
	const confirm = await screen.findByRole("alertdialog");
	await user.click(within(confirm).getByRole("button", { name: "Unpublish website" }));
	await waitFor(() => expect(mocks.unpublish).toHaveBeenCalledTimes(1));
});

it("uses the mobile settings list and back navigation inside the drawer", async () => {
	mocks.mobile = true;
	const user = userEvent.setup();
	mount();
	await user.click(screen.getByRole("button", { name: "Site settings" }));
	const dialog = await screen.findByRole("dialog", { name: "Site settings" });
	expect(within(dialog).queryByRole("button", { name: "Blog" })).not.toBeInTheDocument();
	expect(within(dialog).queryByRole("button", { name: "General" })).not.toBeInTheDocument();
	expect(within(dialog).queryByRole("button", { name: "Favicon" })).not.toBeInTheDocument();
	await user.click(within(dialog).getByRole("button", { name: "Integrations" }));
	expect(within(dialog).getByText("Google Analytics measurement ID")).toBeInTheDocument();
	await user.click(within(dialog).getByRole("button", { name: "Site settings" }));
	expect(within(dialog).getByRole("button", { name: "Languages" })).toBeInTheDocument();
	expect(within(dialog).queryByText("Google Analytics measurement ID")).not.toBeInTheDocument();
});

it("opens language settings from the compact dropdown and keeps direction labels hidden", async () => {
	const user = userEvent.setup();
	mount();
	screen.getByRole("combobox", { name: "Language: English" }).focus();
	await user.keyboard("{ArrowDown}");
	expect(screen.queryByRole("option", { name: "French" })).not.toBeInTheDocument();
	await user.click(await screen.findByRole("option", { name: "Add languages" }));
	const dialog = await screen.findByRole("dialog", { name: "Site settings" });
	expect(within(dialog).getByRole("heading", { name: "Languages" })).toBeInTheDocument();
	expect(within(dialog).queryByText(/\b(?:LTR|RTL)\b/)).not.toBeInTheDocument();
	await user.click(within(dialog).getByRole("button", { name: "Add language" }));

	for (const name of ["Bulgarian", "Irish", "Maltese", "Albanian", "Bosnian", "Serbian"]) {
		expect(within(dialog).getByRole("button", { name })).toBeInTheDocument();
	}

	expect(within(dialog).queryByText(/\b(?:LTR|RTL)\b/)).not.toBeInTheDocument();
});

it("immediately shows the selected language with a translating badge and no search field", async () => {
	const finished = Promise.withResolvers<void>();
	mocks.add.mockReturnValue(finished.promise);
	const user = userEvent.setup();
	mount("?websiteSettings=languages");
	const dialog = await screen.findByRole("dialog", { name: "Site settings" });
	await user.click(within(dialog).getByRole("button", { name: "Add language" }));
	expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
	await user.click(within(dialog).getByRole("button", { name: "Swedish" }));
	expect(within(dialog).getByText("Swedish")).toBeInTheDocument();
	expect(within(dialog).getByRole("status")).toHaveTextContent("Translating");
	expect(within(dialog).queryByRole("button", { name: "French" })).not.toBeInTheDocument();
	await act(async () => {
		finished.resolve();
	});
});

it("confirms before removing a language", async () => {
	const user = userEvent.setup();
	mount("?websiteSettings=languages");
	const dialog = await screen.findByRole("dialog", { name: "Site settings" });
	await user.click(within(dialog).getByRole("button", { name: "Remove" }));
	await user.click(
		within(await screen.findByRole("alertdialog", { name: "Remove Arabic?" })).getByRole("button", {
			name: "Cancel",
		})
	);
	expect(mocks.edit).not.toHaveBeenCalled();
	await user.click(within(dialog).getByRole("button", { name: "Remove" }));
	await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));
	expect(mocks.edit).toHaveBeenCalledExactlyOnceWith({ locale: "ar", operation: "remove-language" });
});
