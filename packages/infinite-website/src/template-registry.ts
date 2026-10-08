import { airySpaciousTemplate } from "./templates/airy-spacious";
import { alpinaVenturesTemplate } from "./templates/alpina-ventures";
import { artisanCraftTemplate } from "./templates/artisan-craft";
import { artisticExpressionTemplate } from "./templates/artistic-expression";
import { clayCoolTemplate } from "./templates/clay-cool";
import { growthEngineTemplate } from "./templates/growth-engine";
import { heritageDriveTemplate } from "./templates/heritage-drive";
import { honestCraftTemplate } from "./templates/honest-craft";
import { midnightAuroraTemplate } from "./templates/midnight-aurora";
import { modernFoundationTemplate } from "./templates/modern-foundation";
import { nordicEdgeTemplate } from "./templates/nordic-edge";
import { pawVoyageTemplate } from "./templates/paw-voyage";
import { professionalStructureTemplate } from "./templates/professional-structure";
import { pureVitalityTemplate } from "./templates/pure-vitality";
import { reliableCoreTemplate } from "./templates/reliable-core";
import { sereneWellnessTemplate } from "./templates/serene-wellness";
import { sharpSignalTemplate } from "./templates/sharp-signal";
import { sparkleHomeTemplate } from "./templates/sparkle-home";
import { steadyAscentTemplate } from "./templates/steady-ascent";
import { strategicInsightTemplate } from "./templates/strategic-insight";
import type { TemplateDefinition } from "./templates/template-definition";
import { trueExposureTemplate } from "./templates/true-exposure";
import { urbanEdgeTemplate } from "./templates/urban-edge";
import { vibrantBloomsTemplate } from "./templates/vibrant-blooms";

export const templateDefinitions = [
	airySpaciousTemplate,
	alpinaVenturesTemplate,
	artisanCraftTemplate,
	artisticExpressionTemplate,
	clayCoolTemplate,
	growthEngineTemplate,
	heritageDriveTemplate,
	honestCraftTemplate,
	midnightAuroraTemplate,
	modernFoundationTemplate,
	nordicEdgeTemplate,
	pawVoyageTemplate,
	professionalStructureTemplate,
	pureVitalityTemplate,
	reliableCoreTemplate,
	sereneWellnessTemplate,
	sharpSignalTemplate,
	sparkleHomeTemplate,
	steadyAscentTemplate,
	strategicInsightTemplate,
	trueExposureTemplate,
	urbanEdgeTemplate,
	vibrantBloomsTemplate,
] satisfies Array<TemplateDefinition>;

export type TemplateId = (typeof templateDefinitions)[number]["id"];
