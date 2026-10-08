import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

const mountedRoots: Array<Root> = [];

export const render = async (element: ReactElement) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	mountedRoots.push(root);
	await act(async () => root.render(element));

	return container;
};

export const cleanup = async () => {
	await act(async () => {
		for (const root of mountedRoots) {
			root.unmount();
		}
	});
	mountedRoots.length = 0;
	document.body.replaceChildren();
};

export const rerender = (element: ReactElement) => mountedRoots[0]?.render(element);
