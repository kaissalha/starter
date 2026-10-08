const rtlScripts = new Set(["Adlm", "Arab", "Hebr", "Mand", "Nkoo", "Rohg", "Samr", "Syrc", "Thaa"]);

export const getDirection = (value: string) => {
	try {
		const script = new Intl.Locale(value).maximize().script;

		return script && rtlScripts.has(script) ? "rtl" : "ltr";
	} catch {
		return "ltr";
	}
};
