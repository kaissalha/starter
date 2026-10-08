import { useMedia } from "use-media";

export const screens = {
	"2xl": 1536,
	"3xl": 1920,
	lg: 1024,
	md: 768,
	sm: 640,
	xl: 1280,
	xs: 480,
};

export const useBreakpoint = (breakpoint: keyof typeof screens) => {
	return useMedia({ minWidth: `${screens[breakpoint]}px` });
};
