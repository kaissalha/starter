import { entityIdFromSeed } from "../sections/entity-id";
import type { CreateEntityId } from "../sections/section-definition";

export const createStoryEntityId =
	({ scope }: { scope: string }): CreateEntityId =>
	({ kind, path }: Parameters<CreateEntityId>[0]) =>
		entityIdFromSeed({ seed: `storybook:${scope}:${kind}:${path}` });
