import "zod/compile";

if (
	process.env.NEXT_PUBLIC_ENABLE_OPENUI_DEVTOOLS !== "1" &&
	process.env.NEXT_PUBLIC_ENABLE_OPENUI_DEVTOOLS !== "true"
) {
	Object.assign(globalThis, { [Symbol.for("openui.devtools.autoMount")]: true });
}
