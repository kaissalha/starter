import type { ComponentType } from "react";

import { cn } from "cn";

import { ContactForm } from "../contact/contact-form";
import type { ContactFormProps } from "../contact/contact-form-contracts";
import type { Layout } from "../document/structure-schema";
import { appearance } from "./appearance";
import { layoutStyle } from "./layout";
import type { NodeProps } from "./shared";

type EmbedProps = NodeProps<"embed">;

type MapProps = Extract<EmbedProps, { provider: "google-map" }>;

type ContactFormEmbedProps = Extract<EmbedProps, { provider: "contact-form" }>;

export type ContactFormContext = {
	component?: ComponentType<ContactFormProps>;
	preview?: boolean;
	sectionId: string;
};

const generateMapUrl = ({ address, coordinates, mapType = "roadmap", zoom = 15 }: MapProps["config"]) => {
	const query = coordinates ? `${coordinates.lat},${coordinates.lng}` : address.trim();

	if (!query) {
		return null;
	}

	const clampedZoom = Math.min(21, Math.max(1, zoom));
	const mapTypeParam = mapType === "satellite" ? "k" : "m";

	return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${clampedZoom}&t=${mapTypeParam}&output=embed`;
};

const MapEmbed = ({
	background,
	border,
	config,
	effect,
	fill,
	fillOpacity,
	foreground,
	label,
	layout,
	opacity,
	radius,
}: MapProps & { layout?: Layout }) => {
	const visual = appearance({ background, border, fill, fillOpacity, foreground, opacity, radius });
	const src = generateMapUrl(config);
	const effectOpacity = effect?.kind === "tint" ? effect.intensity : 0;

	return (
		<div
			className={cn("iw-layout iw-box relative", visual.className)}
			style={{ ...layoutStyle({ ...layout, overflow: "hidden" }), ...visual.style }}
		>
			{src && (
				<iframe
					allowFullScreen
					className='h-full w-full border-0'
					loading='lazy'
					referrerPolicy='no-referrer-when-downgrade'
					sandbox='allow-popups allow-scripts'
					src={src}
					style={
						effect ? { filter: "grayscale(45%) contrast(1.06) brightness(0.98) saturate(0.9)" } : undefined
					}
					title={label}
				/>
			)}
			{!src && <span className='font-body text-sm text-foreground-muted'>{label}</span>}
			{effect && (
				<div
					aria-hidden
					className='pointer-events-none absolute inset-0 bg-accent-primary mix-blend-color'
					style={{ opacity: effectOpacity }}
				/>
			)}
		</div>
	);
};

const ContactFormEmbed = ({
	background,
	border,
	config,
	contactForm = { preview: true, sectionId: "" },
	fill,
	fillOpacity,
	foreground,
	label,
	layout,
	opacity,
	radius,
}: ContactFormEmbedProps & { contactForm?: ContactFormContext; layout?: Layout }) => {
	const visual = appearance({ background, border, fill, fillOpacity, foreground, opacity, radius });
	const Form = contactForm.component ?? ContactForm;

	return (
		<div className={cn("iw-layout iw-box", visual.className)} style={{ ...layoutStyle(layout), ...visual.style }}>
			<Form
				columns={config.columns}
				copy={{ ...config.labels, heading: label }}
				preview={contactForm.preview}
				sectionId={contactForm.sectionId}
				submitWidth={config.submitWidth}
			/>
		</div>
	);
};

export const Embed = ({ contactForm, ...props }: EmbedProps & { contactForm?: ContactFormContext; layout?: Layout }) =>
	props.provider === "contact-form" ? (
		<ContactFormEmbed {...props} contactForm={contactForm} />
	) : (
		<MapEmbed {...props} />
	);
