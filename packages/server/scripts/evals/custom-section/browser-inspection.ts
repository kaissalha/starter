/* oxlint-disable anti-slop/no-let, anti-slop/no-runtime-typeof, complexity, max-depth */
export type ViewportReport = {
	broken: Array<string>;
	contrast: {
		na: number;
		tested: number;
		violations: Array<{ bg: string; fg: string; ratio: number; required: number; text: string }>;
	};
	emptyCollections: number;
	overflow: Array<string>;
	pageOverflow: boolean;
	sectionHeight: number;
	sectionTextLength: number;
	tapTargets: { total: number; under24: number; under44: number };
	textOverflow: Array<string>;
};

export const inspectSection = (sectionId: string): ViewportReport => {
	const section = document.getElementById(sectionId);

	if (!section) {
		throw new Error("Composed section not found in rendered page");
	}

	const vw = window.innerWidth;
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext("2d", { willReadFrequently: true });

	if (!context) {
		throw new Error("Canvas unavailable");
	}

	const parse = (css: string): [number, number, number, number] => {
		context.clearRect(0, 0, 1, 1);
		context.fillStyle = "#000000";
		context.fillStyle = css;
		context.fillRect(0, 0, 1, 1);
		const data = context.getImageData(0, 0, 1, 1).data;

		return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, (data[3] ?? 0) / 255];
	};

	const luminance = ([r, g, b]: [number, number, number, number]) => {
		const channel = (value: number) => {
			const unit = value / 255;

			return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
		};

		return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
	};

	const blend = (
		top: [number, number, number, number],
		base: [number, number, number, number]
	): [number, number, number, number] => [
		top[0] * top[3] + base[0] * (1 - top[3]),
		top[1] * top[3] + base[1] * (1 - top[3]),
		top[2] * top[3] + base[2] * (1 - top[3]),
		1,
	];

	const hex = (color: [number, number, number, number]) =>
		`#${color
			.slice(0, 3)
			.map((value) => Math.round(value).toString(16).padStart(2, "0"))
			.join("")}`;

	const intersects = (a: DOMRect, b: DOMRect) =>
		a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

	const label = (element: Element) =>
		`${element.tagName.toLowerCase()}${typeof element.className === "string" && element.className ? `.${element.className.split(/\s+/u)[0]}` : ""}`;

	const visible = (element: Element) => {
		const style = getComputedStyle(element);
		const rect = element.getBoundingClientRect();

		return style.display !== "none" && style.visibility !== "hidden" && rect.width >= 2 && rect.height >= 2;
	};

	const clippedBy = (element: Element) => {
		for (
			let parent = element.parentElement;
			parent && parent !== section.parentElement;
			parent = parent.parentElement
		) {
			const style = getComputedStyle(parent);

			if (/hidden|clip|auto|scroll/u.test(style.overflowX)) {
				return parent;
			}
		}

		return null;
	};

	const hasOwnText = (element: Element) =>
		[...element.childNodes].some(
			(node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0
		);

	const elements = [section, ...section.querySelectorAll("*")];
	const images = [...section.querySelectorAll("img")];

	for (const image of images) {
		image.loading = "eager";
	}

	const contrast: ViewportReport["contrast"] = { na: 0, tested: 0, violations: [] };

	for (const element of elements) {
		if (!hasOwnText(element) || !visible(element)) {
			continue;
		}

		const style = getComputedStyle(element);
		const rect = element.getBoundingClientRect();
		let opacity = 1;
		let imageBacked = false;
		let background: [number, number, number, number] = [255, 255, 255, 1];
		const layers: Array<[number, number, number, number]> = [];

		for (let node: Element | null = element; node; node = node.parentElement) {
			const nodeStyle = getComputedStyle(node);
			opacity *= Number(nodeStyle.opacity);

			if (nodeStyle.backgroundImage !== "none") {
				imageBacked = true;
			}

			const color = parse(nodeStyle.backgroundColor);

			if (color[3] > 0) {
				layers.push(color);

				if (color[3] >= 0.99) {
					break;
				}
			}

			if (node !== element && node !== section && section.contains(node)) {
				for (const sibling of node.children) {
					const siblingStyle = getComputedStyle(sibling);

					const media =
						/^(IMG|VIDEO|PICTURE|CANVAS)$/u.test(sibling.tagName) ||
						sibling.querySelector("img,video") !== null;

					if (
						media &&
						!sibling.contains(element) &&
						/absolute|fixed/u.test(siblingStyle.position) &&
						intersects(sibling.getBoundingClientRect(), rect)
					) {
						imageBacked = true;
					}
				}
			}
		}

		for (const layer of layers.toReversed()) {
			background = blend(layer, background);
		}

		if (imageBacked) {
			contrast.na += 1;
			continue;
		}

		const foreground = parse(style.color);
		foreground[3] *= opacity;
		const text = blend(foreground, background);
		const lighter = Math.max(luminance(text), luminance(background));
		const darker = Math.min(luminance(text), luminance(background));
		const ratio = (lighter + 0.05) / (darker + 0.05);
		const size = Number.parseFloat(style.fontSize);
		const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
		const required = large ? 3 : 4.5;
		contrast.tested += 1;

		if (ratio < required) {
			contrast.violations.push({
				bg: hex(background),
				fg: hex(text),
				ratio: Math.round(ratio * 100) / 100,
				required,
				text: (element.textContent ?? "").trim().slice(0, 40),
			});
		}
	}

	const overflow: Array<string> = [];

	for (const element of elements) {
		if (!visible(element) || getComputedStyle(element).position === "fixed") {
			continue;
		}

		const rect = element.getBoundingClientRect();

		if ((rect.right > vw + 1 || rect.left < -1) && !clippedBy(element)) {
			overflow.push(`${label(element)} ${Math.round(rect.left)}..${Math.round(rect.right)}`);
		}
	}

	const textOverflow: Array<string> = [];

	for (const element of elements) {
		if (!hasOwnText(element) || !visible(element)) {
			continue;
		}

		const style = getComputedStyle(element);
		const clamped = style.webkitLineClamp !== "none" && style.webkitLineClamp !== "";
		const clipsX = /hidden|clip/u.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;

		const clipsY =
			/hidden|clip/u.test(style.overflowY) && !clamped && element.scrollHeight > element.clientHeight + 1;

		const clipper = clippedBy(element);
		const rect = element.getBoundingClientRect();

		const outside =
			clipper !== null &&
			!/auto|scroll/u.test(getComputedStyle(clipper).overflowX) &&
			(rect.right > clipper.getBoundingClientRect().right + 1 ||
				rect.left < clipper.getBoundingClientRect().left - 1);

		if (clipsX || clipsY || outside) {
			textOverflow.push(`${label(element)} "${(element.textContent ?? "").trim().slice(0, 30)}"`);
		}
	}

	const interactive = [
		...section.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button]"),
	].filter((element) => visible(element) && getComputedStyle(element).display !== "inline");

	const sizes = interactive.map((element) => {
		const rect = element.getBoundingClientRect();

		return Math.min(rect.width, rect.height);
	});

	const emptyCollections = elements.filter((element) => {
		const display = getComputedStyle(element).display;

		return (
			element !== section &&
			/grid|flex/u.test(display) &&
			element.children.length === 0 &&
			(element.textContent ?? "").trim() === "" &&
			element.getBoundingClientRect().height > 0
		);
	}).length;

	return {
		broken: images.flatMap((image) =>
			!image.getAttribute("src") || (image.complete && image.naturalWidth === 0)
				? [image.getAttribute("src")?.slice(0, 60) ?? "(no src)"]
				: []
		),
		contrast,
		emptyCollections,
		overflow: overflow.slice(0, 8),
		pageOverflow: document.documentElement.scrollWidth > vw + 1,
		sectionHeight: Math.round(section.getBoundingClientRect().height),
		sectionTextLength: (section.textContent ?? "").trim().length,
		tapTargets: {
			total: sizes.length,
			under24: sizes.filter((size) => size < 24).length,
			under44: sizes.filter((size) => size < 44).length,
		},
		textOverflow: textOverflow.slice(0, 8),
	};
};
