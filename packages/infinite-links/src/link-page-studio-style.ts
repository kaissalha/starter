import {
	linkPageStudioLayouts,
	type LinkPageAppearance,
	type LinkPageButtonAppearance,
	type LinkPageLink,
	type LinkPageProfile,
	type LinkPageStudioLayout,
} from "./contracts";

export const isLinkPageStudioLayout = (layout: LinkPageProfile["layout"]): layout is LinkPageStudioLayout =>
	linkPageStudioLayouts.some((candidate) => candidate === layout);

export const linkPageFontScales = new Map(
	Object.entries({
		alegreya: 1.2,
		"alegreya-sans": 1.2,
		arvo: 0.95,
		cardo: 1.1,
		"crimson-text": 1.1,
		"libre-baskerville": 0.95,
		merriweather: 0.95,
		neuton: 1.1,
		"open-sans": 0.98,
		"proza-libre": 0.95,
		"space-mono": 0.95,
		spectral: 1.1,
	})
);

const channels = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

const shiftHex = (hex: string, amount: number) =>
	`#${channels(hex)
		.map((channel) =>
			Math.round(Math.min(Math.max(0, channel + channel * amount), 255))
				.toString(16)
				.padStart(2, "0")
		)
		.join("")}`;

const lightness = (hex: string) => {
	const values = channels(hex).map((channel) => channel / 255);

	return ((Math.max(...values) + Math.min(...values)) / 2) * 100;
};

const rgba = (hex: string, alpha: number) => `rgba(${channels(hex).join(", ")}, ${alpha})`;

export const linkPageSolidShadow = ({ color, strength }: { color: string; strength: number }) =>
	`${0.9 * 7 * strength}px ${7 * strength}px 0 0 ${color}`;

const resolveButtonShadow = (buttons: LinkPageButtonAppearance) => {
	const strength = buttons.shadowStrength ?? 0;

	if (buttons.shadow === "none" || strength <= 0) {
		return "none";
	}

	if (buttons.shadow === "hard") {
		return linkPageSolidShadow({ color: buttons.colors.shadow ?? "#000000", strength });
	}

	return `0 10px 30px 0 rgba(0, 0, 0, ${0.3 * strength})`;
};

const neumorphicShadow = ({ base, inset }: { base: string; inset: boolean }) => {
	const dark = lightness(base) < 30;
	const light = inset ? "rgba(0,0,0,0.04)" : shiftHex(base, 0.11 + (dark ? 0.05 : 0));
	const shade = inset ? "rgba(0,0,0,0.15)" : shiftHex(base, -0.16 - (dark ? 0.05 : 0));
	const lightShadow = `-5px -5px 13px ${light}`;
	const shadeShadow = `5px 5px 13px ${shade}`;

	return inset ? `inset ${lightShadow}, inset ${shadeShadow}` : `${lightShadow}, ${shadeShadow}`;
};

const resolveEffect = ({ base, effect }: { base: string; effect: LinkPageButtonAppearance["effect"] }) => {
	if (!effect || effect === "none") {
		return null;
	}

	if (effect === "frosted") {
		const dark = lightness(base) < 45;

		const [from, to] = dark
			? ["rgba(255,255,255,0.18)", "rgba(255,255,255,0.08)"]
			: ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.38)"];

		return {
			backdrop: "blur(16px) saturate(180%)",
			background: `linear-gradient(135deg, ${from}, ${to})`,
			border: dark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.7)",
			borderWidth: 1,
			shadow: `inset 0 1px 1px ${dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.75)"}, 0 6px 24px rgba(0,0,0,0.12)`,
		};
	}

	if (effect === "inset") {
		return {
			backdrop: "none",
			background: base,
			border: shiftHex(base, 0.02),
			borderWidth: 1,
			shadow: neumorphicShadow({ base, inset: true }),
		};
	}

	const [start, end] =
		effect === "flat"
			? [base, base]
			: [shiftHex(base, effect === "convex" ? 0.1 : -0.07), shiftHex(base, effect === "convex" ? -0.07 : 0.1)];

	return {
		backdrop: "none",
		background: `linear-gradient(145deg, ${start}, ${end})`,
		border: shiftHex(base, 0.02),
		borderWidth: 0,
		shadow: neumorphicShadow({ base, inset: false }),
	};
};

export const hasLinkPageStudioButtons = (buttons: LinkPageButtonAppearance) => buttons.radius !== undefined;

export const linkPageStudioButtonVariables = ({
	buttons,
	surface,
}: {
	buttons: LinkPageButtonAppearance;
	surface: string;
}) => {
	const effect = resolveEffect({ base: surface, effect: buttons.effect });
	const borderWidth = Math.round(10 * (buttons.borderWidth ?? 0));

	const variables = {
		"--lp-button-backdrop": effect?.backdrop ?? "none",
		"--lp-button-border-color": effect?.border ?? buttons.colors.border ?? "transparent",
		"--lp-button-border-width": `${effect?.borderWidth ?? borderWidth}px`,
		"--lp-button-radius": `${28 * (buttons.radius ?? 0)}px`,
		"--lp-button-shadow-value": effect?.shadow ?? resolveButtonShadow(buttons),
	};

	return effect ? { ...variables, "--lp-button-fill": effect.background } : variables;
};

export const linkPageStudioButtonClassName =
	"rounded-[var(--lp-button-radius)] border-solid border-[length:var(--lp-button-border-width)] border-[var(--lp-button-border-color)] [background:var(--lp-button-fill)] text-[var(--lp-button-text)] shadow-[var(--lp-button-shadow-value)] [backdrop-filter:var(--lp-button-backdrop)]";

const resolveButtonTextColor = ({ button, buttons }: { button: string; buttons: LinkPageButtonAppearance }) => {
	if (buttons.colors.text) {
		return buttons.colors.text;
	}

	if (buttons.style === "glass") {
		return "var(--foreground-primary)";
	}

	if (buttons.style !== "solid" && buttons.style !== "soft") {
		return button;
	}

	return buttons.colors.button ? "var(--surface-canvas)" : "var(--action-foreground)";
};

export const linkPageButtonVariables = ({
	buttons,
	surface,
}: {
	buttons: LinkPageButtonAppearance;
	surface: string;
}) => {
	const button = buttons.colors.button ?? "var(--action-primary)";

	const variables = {
		"--lp-button": button,
		"--lp-button-fill": `color-mix(in srgb, ${button} ${buttons.opacity ?? 100}%, transparent)`,
		"--lp-button-shadow": buttons.colors.shadow ?? "var(--foreground-primary)",
		"--lp-button-text": resolveButtonTextColor({ button, buttons }),
		"--lp-cta": buttons.colors.cta ?? "#1b97f5",
		"--lp-cta-text": buttons.colors.ctaText ?? "#ffffff",
		"--lp-label": buttons.colors.label ?? "#1b97f5",
		"--lp-label-text": buttons.colors.labelText ?? "#ffffff",
	};

	return hasLinkPageStudioButtons(buttons)
		? { ...variables, ...linkPageStudioButtonVariables({ buttons, surface }) }
		: variables;
};

export const linkPageLinkStyleVariables = ({
	buttons,
	style,
	surface,
}: {
	buttons: LinkPageButtonAppearance;
	style: NonNullable<LinkPageLink["style"]>;
	surface: string;
}) =>
	linkPageButtonVariables({
		buttons: {
			...buttons,
			borderWidth: style.borderWidth ?? buttons.borderWidth,
			colors: {
				...buttons.colors,
				border: style.border ?? buttons.colors.border,
				button: style.button ?? buttons.colors.button,
				cta: style.cta ?? buttons.colors.cta,
				ctaText: style.ctaText ?? buttons.colors.ctaText,
				label: style.label ?? buttons.colors.label,
				labelText: style.labelText ?? buttons.colors.labelText,
				text: style.text ?? buttons.colors.text,
			},
			radius: style.radius ?? buttons.radius,
			shadowStrength: style.shadowStrength ?? buttons.shadowStrength,
		},
		surface,
	});

export const linkPageStudioGap = (buttons: LinkPageButtonAppearance) =>
	buttons.spacing === undefined ? undefined : `${11 + 33 * buttons.spacing}px`;

export const linkPageSheetFade = (color: string) =>
	`linear-gradient(to bottom, ${(
		[
			[0, 0],
			[8.1, 0.013],
			[15.5, 0.049],
			[22.5, 0.104],
			[29, 0.175],
			[35.3, 0.259],
			[41.2, 0.352],
			[47.1, 0.45],
			[52.9, 0.55],
			[58.8, 0.648],
			[64.7, 0.741],
			[71, 0.825],
			[77.5, 0.896],
			[84.5, 0.951],
			[91.9, 0.987],
			[100, 1],
		] as const
	)
		.map(([position, alpha]) => `${rgba(color, alpha)} ${position}%`)
		.join(", ")})`;

const resolveAvatarShadow = ({ hard, strength }: { hard: boolean; strength: number }) => {
	if (strength <= 0) {
		return "none";
	}

	return hard ? linkPageSolidShadow({ color: "#000000", strength }) : `0 4px 20px 0 rgba(0, 0, 0, ${0.4 * strength})`;
};

export const linkPageStudioAvatar = ({
	appearance,
	layout,
}: {
	appearance: LinkPageAppearance;
	layout: LinkPageStudioLayout;
}) => {
	const image = appearance.profileImage;
	const size = (layout === "business" ? 56 : 110) * (0.5 + (image?.size ?? 0.5));
	const ring = 16 * (image?.border ?? 0);

	return {
		ring,
		ringColor: image?.borderColor ?? "transparent",
		shadow: resolveAvatarShadow({ hard: appearance.buttons.shadow === "hard", strength: image?.shadow ?? 0 }),
		size,
	};
};

export const linkPageHeadshotScale = (appearance: LinkPageAppearance) => 0.5 + (appearance.profileImage?.size ?? 0.5);

export const linkPageStudioSurface = ({
	appearance,
	background,
	layout,
}: {
	appearance: LinkPageAppearance;
	background: string;
	layout: LinkPageStudioLayout | null;
}) => {
	if (layout === null) {
		return background;
	}

	return appearance.wallpaper.style === "fill" ? (appearance.wallpaper.color ?? background) : "#ffffff";
};

const lerp = ({ from, ratio, to }: { from: number; ratio: number; to: number }) =>
	Math.round(from + (to - from) * ratio);

export const linkPageDividerVariables = (divider: LinkPageAppearance["divider"]) => {
	if (!divider) {
		return {};
	}

	const ruleWidth = Math.max(lerp({ from: 1, ratio: divider.ruleWidth, to: 6 }), divider.rule === "double" ? 3 : 1);

	return {
		"--lp-divider-above": `${Math.max(0, lerp({ from: 0, ratio: divider.spaceAbove, to: 48 }) - 12)}px`,
		"--lp-divider-below": `${Math.max(0, lerp({ from: 0, ratio: divider.spaceBelow, to: 48 }) - 12)}px`,
		"--lp-divider-rule": divider.rule === "none" ? "none" : `${ruleWidth}px ${divider.rule} currentColor`,
		"--lp-divider-rule-gap": divider.rule === "none" ? "0px" : "8px",
		"--lp-divider-size": `${lerp({ from: 14, ratio: divider.size, to: 34 })}px`,
	};
};
