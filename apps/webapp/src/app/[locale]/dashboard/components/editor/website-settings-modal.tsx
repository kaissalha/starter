"use client";

import {
	ArrowLeft02Icon,
	CodeIcon,
	File01Icon,
	Globe02Icon,
	LanguageCircleIcon,
	Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";

import { defaultWebsiteSettings, type Iso6391LanguageCode } from "@starter/infinite-website";
import { Button } from "@starter/ui/components/button";
import {
	Credenza,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaDescription,
} from "@starter/ui/components/credenza";
import { ScrollArea } from "@starter/ui/components/scroll-area";
import { useIsMobile } from "@starter/ui/hooks/use-is-mobile";

import { WebsiteDomainsContent } from "../../website/website-domains-panel";
import { useWebsiteLanguages } from "./use-website-languages";
import { WebsiteLanguageSettings } from "./website-language-settings";
import { WebsitePageSeoSettings } from "./website-page-seo-settings";
import { WebsiteSettingsFields } from "./website-settings-fields";

const settingsTabs = ["domains", "pages", "languages", "integrations"] as const;

export const WebsiteSettingsModal = ({
	disabled,
	onAddLanguage,
	publicUrl,
	showTrigger = true,
}: {
	disabled?: boolean;
	onAddLanguage?: (locale: Iso6391LanguageCode) => Promise<boolean | void>;
	publicUrl?: string;
	showTrigger?: boolean;
}) => {
	const t = useTranslations("website.settings");
	const tCommon = useTranslations("common");
	const isMobile = useIsMobile();
	const [activeTab, setTab] = useQueryState("websiteSettings", parseAsStringEnum([...settingsTabs, "list"]));
	const open = activeTab !== null;
	const tab = activeTab === "list" && !isMobile ? "domains" : (activeTab ?? "domains");

	const setOpen = (value: boolean) => {
		if (!value) {
			setTab(null);
		}
	};

	const controller = useWebsiteLanguages();
	const initial = controller.document?.settings ?? defaultWebsiteSettings;

	const icons = {
		domains: Globe02Icon,
		integrations: CodeIcon,
		languages: LanguageCircleIcon,
		pages: File01Icon,
	};

	const navigation = (
		<nav aria-label={t("title")} className='flex flex-1 flex-col overflow-y-auto'>
			<ul className='flex flex-1 flex-col gap-0.5 px-2 py-1'>
				{settingsTabs.map((item) => (
					<li key={item}>
						<Button
							aria-current={tab === item ? "page" : undefined}
							className='w-full justify-start'
							onClick={() => setTab(item)}
							variant={tab === item ? "secondary" : "ghost"}
						>
							<HugeiconsIcon
								aria-hidden='true'
								className='scale-110'
								icon={icons[item]}
								strokeWidth={1.75}
							/>
							<span>{t(item)}</span>
						</Button>
					</li>
				))}
			</ul>
		</nav>
	);

	const renderPanel = () => {
		if (tab === "list") {
			return null;
		}

		if (tab === "domains") {
			return (
				<ScrollArea className='flex-1'>
					{controller.website && <WebsiteDomainsContent embedded publicUrl={publicUrl} />}
				</ScrollArea>
			);
		}

		if (tab === "pages") {
			return <WebsitePageSeoSettings controller={controller} />;
		}

		if (tab === "languages") {
			return (
				<ScrollArea className='flex-1'>
					<div className='space-y-6 p-4 md:p-10'>
						<h2 className='text-xl font-semibold'>{t("languages")}</h2>
						<WebsiteLanguageSettings controller={controller} onAddLanguage={onAddLanguage} />
					</div>
				</ScrollArea>
			);
		}

		return <WebsiteSettingsFields controller={controller} initial={initial} key={JSON.stringify(initial)} />;
	};

	return (
		<>
			{showTrigger && (
				<Button
					aria-label={t("title")}
					disabled={disabled || !controller.document}
					onClick={() => {
						setTab(isMobile ? "list" : "domains");
					}}
					size='icon'
					variant='ghost'
				>
					<HugeiconsIcon aria-hidden='true' className='scale-110' icon={Settings01Icon} strokeWidth={1.75} />
				</Button>
			)}
			<Credenza onOpenChange={setOpen} open={open}>
				<CredenzaContent
					aria-label={t("title")}
					className='h-160 max-h-[90dvh] w-240 max-w-full overflow-hidden sm:max-w-full md:max-w-[90vw]'
					closeLabel={tCommon("close")}
					padding='none'
				>
					<CredenzaHeader className='sr-only'>
						<CredenzaTitle>{t("title")}</CredenzaTitle>
						<CredenzaDescription>{t("title")}</CredenzaDescription>
					</CredenzaHeader>
					{isMobile ? (
						<div className='flex min-h-0 flex-1 flex-col'>
							{tab === "list" ? (
								<div className='flex h-full flex-col bg-sidebar'>
									<p className='px-6 pt-4 pb-2 text-2xl font-semibold text-sidebar-foreground'>
										{t("title")}
									</p>
									{navigation}
								</div>
							) : (
								<>
									<Button
										className='ms-2 w-fit'
										onClick={() => setTab("list")}
										size='sm'
										variant='ghost'
									>
										<HugeiconsIcon
											aria-hidden='true'
											className='scale-110'
											icon={ArrowLeft02Icon}
											strokeWidth={1.75}
										/>
										{t("title")}
									</Button>
									{open && renderPanel()}
								</>
							)}
						</div>
					) : (
						<div className='flex h-full max-h-full overflow-hidden'>
							<aside className='flex h-full w-50 shrink-0 flex-col bg-sidebar'>
								<div className='px-4 py-5'>
									<p className='px-2 text-sm font-semibold text-sidebar-foreground'>{t("title")}</p>
								</div>
								{navigation}
							</aside>
							<div
								className='animate-fade-in-only flex min-w-0 flex-1 flex-col motion-reduce:animate-none'
								key={tab}
							>
								{open && renderPanel()}
							</div>
						</div>
					)}
				</CredenzaContent>
			</Credenza>
		</>
	);
};
