export const questionFontWeights = {
	medium: "'wght' 450, 'opsz' 15",
	semibold: "'wght' 550, 'opsz' 20",
} as const;

export const autosizeQuestionTextarea = (element: HTMLTextAreaElement) => {
	element.style.height = "0px";
	element.style.height = `${element.scrollHeight}px`;
	const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || 18;

	return element.scrollHeight > lineHeight * 1.5;
};
