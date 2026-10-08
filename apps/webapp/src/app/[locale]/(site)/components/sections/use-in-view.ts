"use client";

import { useEffect, useRef, useState } from "react";

export const useInView = <T extends Element>() => {
	const ref = useRef<T>(null);
	const [inView, setInView] = useState(true);

	useEffect(() => {
		if (!ref.current) {
			return;
		}

		const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), {
			rootMargin: "25% 0px",
		});

		observer.observe(ref.current);

		return () => observer.disconnect();
	}, []);

	return { inView, ref };
};
