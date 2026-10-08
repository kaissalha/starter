import { z } from "zod";

import { sectionReferenceEntrySchema } from "./section-reference-contract";
import generated from "./section-references.generated.json";

export { describeSectionReference, type SectionReferenceEntry } from "./section-reference-contract";

export const sectionReferenceEntries = z.array(sectionReferenceEntrySchema).parse(generated);
