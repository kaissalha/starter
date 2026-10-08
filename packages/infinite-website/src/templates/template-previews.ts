import type { AssetMap } from "../rendering/render-node";
import { entityIdFromSeed } from "../sections/entity-id";
import { templateDefinitions } from "../template-registry";
import { airySpaciousAssets } from "./airy-spacious/assets";
import airySpaciousContent from "./airy-spacious/content.json" with { type: "json" };
import { alpinaVenturesAssets } from "./alpina-ventures/assets";
import alpinaVenturesContent from "./alpina-ventures/content.json" with { type: "json" };
import { artisanCraftAssets } from "./artisan-craft/assets";
import artisanCraftContent from "./artisan-craft/content.json" with { type: "json" };
import { artisticExpressionAssets } from "./artistic-expression/assets";
import artisticExpressionContent from "./artistic-expression/content.json" with { type: "json" };
import { clayCoolAssets } from "./clay-cool/assets";
import clayCoolContent from "./clay-cool/content.json" with { type: "json" };
import { growthEngineAssets } from "./growth-engine/assets";
import growthEngineContent from "./growth-engine/content.json" with { type: "json" };
import { heritageDriveAssets } from "./heritage-drive/assets";
import heritageDriveContent from "./heritage-drive/content.json" with { type: "json" };
import { honestCraftAssets } from "./honest-craft/assets";
import honestCraftContent from "./honest-craft/content.json" with { type: "json" };
import { midnightAuroraAssets } from "./midnight-aurora/assets";
import midnightAuroraContent from "./midnight-aurora/content.json" with { type: "json" };
import { modernFoundationAssets } from "./modern-foundation/assets";
import modernFoundationContent from "./modern-foundation/content.json" with { type: "json" };
import { nordicEdgeAssets } from "./nordic-edge/assets";
import nordicEdgeContent from "./nordic-edge/content.json" with { type: "json" };
import { pawVoyageAssets } from "./paw-voyage/assets";
import pawVoyageContent from "./paw-voyage/content.json" with { type: "json" };
import { professionalStructureAssets } from "./professional-structure/assets";
import professionalStructureContent from "./professional-structure/content.json" with { type: "json" };
import { pureVitalityAssets } from "./pure-vitality/assets";
import pureVitalityContent from "./pure-vitality/content.json" with { type: "json" };
import { reliableCoreAssets } from "./reliable-core/assets";
import reliableCoreContent from "./reliable-core/content.json" with { type: "json" };
import { sereneWellnessAssets } from "./serene-wellness/assets";
import sereneWellnessContent from "./serene-wellness/content.json" with { type: "json" };
import { sharpSignalAssets } from "./sharp-signal/assets";
import sharpSignalContent from "./sharp-signal/content.json" with { type: "json" };
import { sparkleHomeAssets } from "./sparkle-home/assets";
import sparkleHomeContent from "./sparkle-home/content.json" with { type: "json" };
import { steadyAscentAssets } from "./steady-ascent/assets";
import steadyAscentContent from "./steady-ascent/content.json" with { type: "json" };
import { strategicInsightAssets } from "./strategic-insight/assets";
import strategicInsightContent from "./strategic-insight/content.json" with { type: "json" };
import { instantiateTemplate, type TemplateContent } from "./template-definition";
import { trueExposureAssets } from "./true-exposure/assets";
import trueExposureContent from "./true-exposure/content.json" with { type: "json" };
import { urbanEdgeAssets } from "./urban-edge/assets";
import urbanEdgeContent from "./urban-edge/content.json" with { type: "json" };
import { vibrantBloomsAssets } from "./vibrant-blooms/assets";
import vibrantBloomsContent from "./vibrant-blooms/content.json" with { type: "json" };

export { getTemplateBrand } from "./template-brand";

const previewSources = [
	["airy-spacious", airySpaciousAssets, airySpaciousContent],
	["alpina-ventures", alpinaVenturesAssets, alpinaVenturesContent],
	["artisan-craft", artisanCraftAssets, artisanCraftContent],
	["artistic-expression", artisticExpressionAssets, artisticExpressionContent],
	["clay-cool", clayCoolAssets, clayCoolContent],
	["growth-engine", growthEngineAssets, growthEngineContent],
	["heritage-drive", heritageDriveAssets, heritageDriveContent],
	["honest-craft", honestCraftAssets, honestCraftContent],
	["midnight-aurora", midnightAuroraAssets, midnightAuroraContent],
	["modern-foundation", modernFoundationAssets, modernFoundationContent],
	["nordic-edge", nordicEdgeAssets, nordicEdgeContent],
	["paw-voyage", pawVoyageAssets, pawVoyageContent],
	["professional-structure", professionalStructureAssets, professionalStructureContent],
	["pure-vitality", pureVitalityAssets, pureVitalityContent],
	["reliable-core", reliableCoreAssets, reliableCoreContent],
	["serene-wellness", sereneWellnessAssets, sereneWellnessContent],
	["sharp-signal", sharpSignalAssets, sharpSignalContent],
	["sparkle-home", sparkleHomeAssets, sparkleHomeContent],
	["steady-ascent", steadyAscentAssets, steadyAscentContent],
	["strategic-insight", strategicInsightAssets, strategicInsightContent],
	["true-exposure", trueExposureAssets, trueExposureContent],
	["urban-edge", urbanEdgeAssets, urbanEdgeContent],
	["vibrant-blooms", vibrantBloomsAssets, vibrantBloomsContent],
] satisfies Array<readonly [string, AssetMap, TemplateContent]>;

export const templatePreviews = previewSources.map(([id, assets, content]) => {
	const definition = templateDefinitions.find((template) => template.id === id);

	if (!definition) {
		throw new Error(`Template preview definition "${id}" is missing`);
	}

	return {
		assets,
		document: instantiateTemplate({
			content,
			createId: ({ kind, path }) => entityIdFromSeed({ seed: `template-preview:${id}:${kind}:${path}` }),
			definition,
			path: `/template-previews/${id}`,
		}),
		id,
	};
});
