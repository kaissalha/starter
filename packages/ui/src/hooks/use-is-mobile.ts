import { useBreakpoint } from "./use-breakpoint";

export const useIsMobile = () => {
	return !useBreakpoint("md");
};
