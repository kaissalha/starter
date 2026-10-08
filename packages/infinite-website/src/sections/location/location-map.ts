import { googleMapSettingsSchema } from "../../document/structure-schema";
import { mapEmbed, sectionRoot } from "../contact/_shared/blocks";
import { defineSection } from "../section-definition";

export const locationMapSection = defineSection({
	category: "location",
	pattern: "location-map",
	root: sectionRoot({
		children: [mapEmbed({ layout: { aspectRatio: { height: 9, width: 21 }, inlineSize: "full" } })],
	}),
	settings: googleMapSettingsSchema,
});
