"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";

import Image from "next/image";

import {
	AndroidIcon,
	AppleIcon,
	ArrowRight01Icon,
	BingIcon,
	BrowserIcon,
	Call02Icon,
	ChatGptIcon,
	ChromeIcon,
	ClaudeIcon,
	ComputerIcon,
	Door01Icon,
	Facebook01Icon,
	FileDownloadIcon,
	GithubIcon,
	Globe02Icon,
	GoogleGeminiIcon,
	GoogleIcon,
	InstagramIcon,
	LaptopIcon,
	Link01Icon,
	Linkedin01Icon,
	Location01Icon,
	Mail01Icon,
	Megaphone01Icon,
	Message01Icon,
	NewTwitterIcon,
	PerplexityAiIcon,
	PinterestIcon,
	RedditIcon,
	SafariIcon,
	Search01Icon,
	Share08Icon,
	SmartPhone01Icon,
	Tablet01Icon,
	Tag01Icon,
	TiktokIcon,
	UserGroupIcon,
	WhatsappIcon,
	WindowsNewIcon,
	YoutubeIcon,
	AiBrain01Icon,
	Logout03Icon,
	Login03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useLocale, useTranslations } from "next-intl";

import type { analyticsDimensions } from "@starter/analytics";
import { cn } from "@starter/ui/lib/utils";

export type AnalyticsDimension = (typeof analyticsDimensions)[number];

const AnalyticsFlagIcon = lazy(async () => ({ default: (await import("./analytics-flags")).AnalyticsFlagIcon }));

const brands: Array<{ hosts: Array<string>; icon: IconSvgElement; name: string }> = [
	{ hosts: ["gemini.google"], icon: GoogleGeminiIcon, name: "Gemini" },
	{ hosts: ["google"], icon: GoogleIcon, name: "Google" },
	{ hosts: ["bing"], icon: BingIcon, name: "Bing" },
	{ hosts: ["facebook", "fb"], icon: Facebook01Icon, name: "Facebook" },
	{ hosts: ["instagram"], icon: InstagramIcon, name: "Instagram" },
	{ hosts: ["x", "twitter", "t.co"], icon: NewTwitterIcon, name: "X" },
	{ hosts: ["linkedin", "lnkd"], icon: Linkedin01Icon, name: "LinkedIn" },
	{ hosts: ["youtube", "youtu.be"], icon: YoutubeIcon, name: "YouTube" },
	{ hosts: ["tiktok"], icon: TiktokIcon, name: "TikTok" },
	{ hosts: ["pinterest"], icon: PinterestIcon, name: "Pinterest" },
	{ hosts: ["reddit"], icon: RedditIcon, name: "Reddit" },
	{ hosts: ["github"], icon: GithubIcon, name: "GitHub" },
	{ hosts: ["whatsapp", "wa.me"], icon: WhatsappIcon, name: "WhatsApp" },
	{ hosts: ["chatgpt", "chat.openai", "openai"], icon: ChatGptIcon, name: "ChatGPT" },
	{ hosts: ["claude"], icon: ClaudeIcon, name: "Claude" },
	{ hosts: ["perplexity"], icon: PerplexityAiIcon, name: "Perplexity" },
	{ hosts: ["copilot.microsoft"], icon: AiBrain01Icon, name: "Copilot" },
	{ hosts: ["grok"], icon: AiBrain01Icon, name: "Grok" },
];

const findBrand = (host: string) => {
	const value = host.toLowerCase().replace(/^www\./u, "");
	const labels = value.split(".");

	return brands.find(({ hosts }) =>
		hosts.some((entry) =>
			entry.includes(".")
				? value === entry || value.startsWith(`${entry}.`) || value.endsWith(`.${entry}`)
				: labels.slice(0, -1).includes(entry) || value === entry
		)
	);
};

export const sourceName = (host: string) => findBrand(host)?.name ?? host.replace(/^www\./u, "");

const channelIcons = {
	ai: AiBrain01Icon,
	campaigns: Megaphone01Icon,
	direct: ArrowRight01Icon,
	email: Mail01Icon,
	paid: Tag01Icon,
	referral: Link01Icon,
	search: Search01Icon,
	social: UserGroupIcon,
} as const;

const actionIcons = {
	calls: Call02Icon,
	directions: Location01Icon,
	downloads: FileDownloadIcon,
	emails: Mail01Icon,
	enquiries: Message01Icon,
	links: Link01Icon,
	messages: Message01Icon,
	social: Share08Icon,
	whatsapp: WhatsappIcon,
} as const;

const deviceIcons = { desktop: LaptopIcon, mobile: SmartPhone01Icon, tablet: Tablet01Icon } as const;

const channelKeys = ["ai", "campaigns", "direct", "email", "paid", "referral", "search", "social"] as const;

const actionKeys = [
	"calls",
	"directions",
	"downloads",
	"emails",
	"enquiries",
	"links",
	"messages",
	"social",
	"whatsapp",
] as const;

const deviceKeys = ["desktop", "mobile", "tablet"] as const;

const osIcons = {
	Android: AndroidIcon,
	ChromeOS: ChromeIcon,
	iOS: AppleIcon,
	Linux: ComputerIcon,
	macOS: AppleIcon,
	Windows: WindowsNewIcon,
} as const;

const browserIcons = { Chrome: ChromeIcon, "Mobile Safari": SafariIcon, Safari: SafariIcon } as const;

const iconFrom = <T extends Record<string, IconSvgElement>>(icons: T, key: string) =>
	Object.hasOwn(icons, key) ? icons[key] : undefined;

export const AnalyticsDeviceIcon = ({ device }: { device: string }) => {
	const t = useTranslations("analytics");
	const key = deviceKeys.find((entry) => entry === device);

	return (
		<HugeiconsIcon
			aria-label={key ? t(key) : t("unknown")}
			className='size-4 shrink-0 scale-110 text-muted-foreground'
			icon={key ? deviceIcons[key] : ComputerIcon}
			role='img'
			strokeWidth={1.75}
		/>
	);
};

export const AnalyticsFlag = ({ className, country }: { className?: string; country: string }) => (
	<span
		aria-hidden
		className={cn(
			"inline-flex size-4 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/10",
			className
		)}
	>
		<Suspense fallback={null}>
			<AnalyticsFlagIcon country={country} />
		</Suspense>
	</span>
);

const Favicon = ({ host }: { host: string }) => {
	const [failed, setFailed] = useState(false);

	if (failed) {
		return <HugeiconsIcon aria-hidden className='size-4 shrink-0' icon={Globe02Icon} strokeWidth={1.75} />;
	}

	return (
		<Image
			alt=''
			className='size-4 shrink-0 rounded-sm'
			height={16}
			onError={() => setFailed(true)}
			referrerPolicy='no-referrer'
			src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
			width={16}
		/>
	);
};

export const useCountryName = () => {
	const locale = useLocale();
	const names = new Intl.DisplayNames([locale], { type: "region" });

	return (code: string) => {
		try {
			return names.of(code) ?? code;
		} catch {
			return code;
		}
	};
};

const Icon = ({ icon }: { icon: IconSvgElement }) => (
	<HugeiconsIcon aria-hidden className='size-4 shrink-0 scale-110' icon={icon} strokeWidth={1.75} />
);

const linkSchemes = new Map<string, "calls" | "emails" | "messages">([
	["mailto:", "emails"],
	["sms:", "messages"],
	["tel:", "calls"],
]);

type LabelContext = { countryName: (code: string) => string; t: ReturnType<typeof useTranslations<"analytics">> };

type LabelContent = { icon: ReactNode; label: string; ltr?: boolean };

const pageLabel = (value: string, { t }: LabelContext, dimension: AnalyticsDimension): LabelContent => {
	const icon = { entryPages: Login03Icon, exitPages: Logout03Icon }[
		dimension === "exitPages" ? "exitPages" : "entryPages"
	];

	return {
		icon: <Icon icon={dimension === "pages" ? Door01Icon : icon} />,
		label: value === "/" ? t("homePage") : value || t("unknown"),
		ltr: value !== "/",
	};
};

const channelLabel = (value: string, { t }: LabelContext): LabelContent => {
	const channel = channelKeys.find((key) => key === value);

	return {
		icon: <Icon icon={channel ? channelIcons[channel] : Link01Icon} />,
		label: channel ? t(`channels.${channel}`) : value,
	};
};

const actionLabel = (value: string, { t }: LabelContext): LabelContent => {
	const action = actionKeys.find((key) => key === value);

	return {
		icon: <Icon icon={action ? actionIcons[action] : Link01Icon} />,
		label: action ? t(`actions.${action}`) : value,
	};
};

const sourceLabel = (value: string, { t }: LabelContext): LabelContent => {
	if (!value) {
		return { icon: <Icon icon={ArrowRight01Icon} />, label: t("direct") };
	}

	const brand = findBrand(value);

	return {
		icon: brand ? <Icon icon={brand.icon} /> : <Favicon host={value} />,
		label: brand?.name ?? value.replace(/^www\./u, ""),
	};
};

const countryLabel = (value: string, { countryName, t }: LabelContext): LabelContent => ({
	icon: <AnalyticsFlag country={value} />,
	label: value ? countryName(value) : t("unknown"),
});

const cityLabel = (value: string, { countryName, t }: LabelContext): LabelContent => {
	const [country = "", city = ""] = value.split("|");

	return {
		icon: <AnalyticsFlag country={country} />,
		label: city ? `${city}, ${countryName(country)}` : t("unknown"),
	};
};

const deviceLabel = (value: string, { t }: LabelContext): LabelContent => {
	const device = deviceKeys.find((key) => key === value);

	return {
		icon: <Icon icon={device ? deviceIcons[device] : ComputerIcon} />,
		label: device ? t(device) : t("unknown"),
	};
};

const technologyLabel = (value: string, { t }: LabelContext, dimension: AnalyticsDimension): LabelContent => ({
	icon: <Icon icon={iconFrom(dimension === "os" ? osIcons : browserIcons, value) ?? BrowserIcon} />,
	label: value === "Other" || !value ? t("other") : value,
});

const linkLabel = (value: string, { t }: LabelContext): LabelContent => {
	const kind = linkSchemes.get(value);

	return kind
		? { icon: <Icon icon={actionIcons[kind]} />, label: t(`actions.${kind}`) }
		: { icon: <Icon icon={Link01Icon} />, label: value.replace(/^https?:\/\/(www\.)?/u, ""), ltr: true };
};

const tagLabel = (value: string, { t }: LabelContext): LabelContent => ({
	icon: <Icon icon={Tag01Icon} />,
	label: value || t("none"),
});

const labels = {
	actions: actionLabel,
	aiSources: sourceLabel,
	browsers: technologyLabel,
	campaigns: tagLabel,
	channels: channelLabel,
	cities: cityLabel,
	countries: countryLabel,
	devices: deviceLabel,
	domains: tagLabel,
	entryPages: pageLabel,
	exitPages: pageLabel,
	links: linkLabel,
	locales: tagLabel,
	os: technologyLabel,
	pages: pageLabel,
	sources: sourceLabel,
	utmMediums: tagLabel,
	utmSources: tagLabel,
} satisfies Record<
	AnalyticsDimension,
	(value: string, context: LabelContext, dimension: AnalyticsDimension) => LabelContent
>;

export const AnalyticsLabel = ({ dimension, value }: { dimension: AnalyticsDimension; value: string }) => {
	const t = useTranslations("analytics");
	const countryName = useCountryName();
	const { icon, label, ltr } = labels[dimension](value, { countryName, t }, dimension);

	return (
		<span className='flex min-w-0 items-center gap-2.5'>
			{icon}
			<bdi className='truncate' dir={ltr ? "ltr" : undefined} title={label}>
				{label}
			</bdi>
		</span>
	);
};
