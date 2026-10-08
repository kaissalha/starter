export const localizedPath = <TLocale extends string>({
	defaultLocale,
	locale,
	pathname,
}: {
	defaultLocale: TLocale;
	locale: TLocale;
	pathname: string;
}) => {
	const normalizedPathReference = { value: pathname };

	if (pathname === "/") {
		normalizedPathReference.value = "";
	} else if (!pathname.startsWith("/")) {
		normalizedPathReference.value = `/${pathname}`;
	}

	return `${locale === defaultLocale ? "" : `/${locale}`}${normalizedPathReference.value}` || "/";
};
