import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const generated = (name: string) => ({ src: `${blob}/websites/preview-media/generated/${name}.png` });

const logo = (index: number) => ({ src: `${blob}/infinite-design/example-logos/color/logo-${index}.svg` });

export const artisticExpressionAssets: AssetMap = {
	"06e63fef-51eb-5802-9c6f-18b05502680e": logo(5),
	"09253f94-72a8-5e6d-961e-78db8272a079": logo(4),
	"1de8a71b-1f20-5b84-ac05-30b2567ef570": generated("1784135900402-a84005a6-215a-42e6-8e3e-59ff77426b0d"),
	"25f6dcd7-49e2-53a0-b493-b9d295757ca4": generated("1784135965477-1fc51df5-4ab3-44e6-81aa-32f7f15bc188"),
	"2fc49c1a-ead8-582d-a3da-ed8f35ffc811": generated("1784135899140-67ae8635-9b44-4be5-85c2-47e2ed74c67a"),
	"4a752cb3-7f87-52ec-8a5e-6afe814003f0": generated("1784135887354-8b7f6ba4-2973-453a-ae65-653da9f1f78c"),
	"5ee6a566-739c-5813-9755-3195f33d43d7": logo(2),
	"5fc802aa-91d1-55e7-aced-88112b81be83": logo(6),
	"6fb6b03f-b177-5bb8-a7fc-3032b53cf564": generated("1784135890934-b8854d30-1bb4-404a-b255-04873f86e586"),
	"707f92b8-bca8-5423-bf00-e76588ac75bf": generated("1784135889366-91801cc6-65c6-4778-b8e6-415ecf1fe729"),
	"7e9d134c-d419-5427-868b-a4490eea2f5b": generated("1784136869527-b6819617-82c0-4fc8-bbbf-14f096d2ca19"),
	"961b9c91-f83e-5248-b699-ee2af2b3bb9c": logo(3),
	"a5a81384-9752-527f-907e-76418b2de6fb": generated("1784136259610-9384cbfa-ad2b-4612-9e75-98aae7507346"),
	"bf4c8d5b-b610-5e5e-9ff7-2b14b2fe9db2": logo(1),
	"e59ae5e0-ee81-52ff-b490-2185b2fa49d3": generated("1784135894071-dd16bf0f-bad5-4738-8dc1-e5f96526dd7c"),
	"e617cd25-6853-527a-9b1f-c9d4aede200e": generated("1784135961681-122145bf-bb5c-471b-8387-7f0580e83265"),
	"f49726c8-f07b-5cc7-a921-84ad873d9323": generated("1784137443801-2adc1d6e-33b9-4bc1-951d-0eb75201bf2f"),
	"fda43acd-2793-523a-9057-742885b1629e": generated("1784135957359-218e356f-54c7-4515-9543-9d64d936d803"),
};
