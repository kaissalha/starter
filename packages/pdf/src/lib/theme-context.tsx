import { defaultTheme, type PdfxTheme } from "./theme";

export const usePdfxTheme = (): PdfxTheme => defaultTheme;

export const useSafeMemo = <T,>(factory: () => T, _deps: Array<unknown>): T => factory();
