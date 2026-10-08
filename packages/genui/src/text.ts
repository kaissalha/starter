const invisibleContentPattern = /[\s\p{Default_Ignorable_Code_Point}]/gu;

const defaultIgnorablePattern = /\p{Default_Ignorable_Code_Point}/gu;

const hasLoneSurrogate = (value: string) => {
	for (const indexReference = { value: 0 }; indexReference.value < value.length; indexReference.value++) {
		const code = value.charCodeAt(indexReference.value);

		if (code >= 0xd8_00 && code <= 0xdb_ff) {
			const next = value.charCodeAt(indexReference.value + 1);

			if (!(next >= 0xdc_00 && next <= 0xdf_ff)) {
				return true;
			}

			indexReference.value++;
		} else if (code >= 0xdc_00 && code <= 0xdf_ff) {
			return true;
		}
	}

	return false;
};

const isControlCodePoint = (codePoint: number) =>
	(codePoint >= 0 && codePoint <= 0x1f) || (codePoint >= 0x7f && codePoint <= 0x9f);

const isBidiControlCodePoint = (codePoint: number) =>
	codePoint === 0x06_1c ||
	codePoint === 0x20_0e ||
	codePoint === 0x20_0f ||
	(codePoint >= 0x20_2a && codePoint <= 0x20_2e) ||
	(codePoint >= 0x20_66 && codePoint <= 0x20_69);

const hasForbiddenControl = (value: string, allowLineBreaks: boolean) =>
	[...value].some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;

		return (
			isBidiControlCodePoint(codePoint) ||
			(isControlCodePoint(codePoint) && !(allowLineBreaks && codePoint === 0x0a))
		);
	});

const containsVisibleContent = (value: string) => value.replaceAll(invisibleContentPattern, "").length > 0;

export const OPENUI_CHART_MAGNITUDE_LIMIT = 1e100;

export const normalizeOpenUIVisibleText = (value: string) => value.normalize("NFC").trim().replaceAll(/\s+/gu, " ");

export const normalizeOpenUIIdentityText = (value: string) =>
	normalizeOpenUIVisibleText(value).replaceAll(defaultIgnorablePattern, "");

export const hasOpenUIVisibleContent = (value: string) =>
	!hasLoneSurrogate(value) && !hasForbiddenControl(value, false) && containsVisibleContent(value);

export const normalizeOpenUIActionText = (value: string) => {
	if (hasLoneSurrogate(value) || hasForbiddenControl(value, true)) {
		return undefined;
	}

	const normalized = value.normalize("NFC").trim();

	return containsVisibleContent(normalized) ? normalized : undefined;
};
