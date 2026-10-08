export const formatPublishedDate = ({ locale, value }: { locale: string; value?: string | null }) => {
	if (!value) {
		return null;
	}

	const parsedDate = new Date(value);

	return Number.isNaN(parsedDate.getTime())
		? null
		: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(parsedDate);
};
