import type { ComponentPropsWithoutRef, ElementType, HTMLAttributes } from "react";

import { z } from "zod";

import type { SiteNode } from "../document/structure-schema";

export type NodeProps<T extends SiteNode["type"]> = Extract<SiteNode, { type: T }>["props"];

export type SiteLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & { href: string };

export type SiteLinkComponent = ElementType<SiteLinkProps>;

export type SiteLinkElementProps = Omit<HTMLAttributes<HTMLElement>, "children">;

const imageDimensionSchema = z.number().int().positive().max(16_384);

const responsiveImageSourceSchema = z.strictObject({
	src: z.string().min(1),
	width: imageDimensionSchema,
});

const resolvedImageAssetSchema = z
	.strictObject({
		decoding: z.enum(["async", "auto", "sync"]).optional(),
		height: imageDimensionSchema.optional(),
		loading: z.enum(["eager", "lazy"]).optional(),
		sizes: z.string().trim().min(1).max(500).optional(),
		sources: z.array(responsiveImageSourceSchema).min(1).max(6).optional(),
		src: z.string().min(1),
		type: z.literal("image").optional(),
		width: imageDimensionSchema.optional(),
	})
	.superRefine((asset, context) => {
		if ((asset.width === undefined) !== (asset.height === undefined)) {
			context.addIssue({
				code: "custom",
				message: "Image width and height must be supplied together",
				path: asset.width === undefined ? ["width"] : ["height"],
			});
		}

		if (asset.sources && asset.width === undefined) {
			context.addIssue({
				code: "custom",
				message: "Responsive image sources require intrinsic width and height",
				path: ["sources"],
			});
		}

		if (asset.sizes && !asset.sources) {
			context.addIssue({
				code: "custom",
				message: "Image sizes requires responsive sources",
				path: ["sizes"],
			});
		}

		if (
			asset.sources?.some((source, index) => {
				const previous = asset.sources?.[index - 1];

				return previous !== undefined && source.width <= previous.width;
			})
		) {
			context.addIssue({
				code: "custom",
				message: "Responsive image source widths must be unique and ascending",
				path: ["sources"],
			});
		}
	});

export const resolvedAssetSchema = z.compile(
	z.union([
		resolvedImageAssetSchema,
		z.strictObject({ poster: z.string().min(1).optional(), src: z.string().min(1), type: z.literal("video") }),
	])
);

export type ResolvedAsset = z.infer<typeof resolvedAssetSchema>;
