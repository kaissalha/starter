import en from "./src/i18n/messages/en.json";
import { routing } from "./src/i18n/routing";

type Messages = typeof en;

declare global {
	interface IntlMessages extends Messages {}
}

declare module "next-intl" {
	interface AppConfig {
		Messages: Messages;
		Locale: (typeof routing.locales)[number];
	}
}
