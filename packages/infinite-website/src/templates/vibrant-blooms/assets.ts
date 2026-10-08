import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const preview = (name: string) => ({ src: `${blob}/websites/preview-media/${name}` });

const logo = (index: number) => ({ src: `${blob}/infinite-design/example-logos/color/logo-${index}.svg` });

export const vibrantBloomsAssets: AssetMap = {
	"03d64828-6bc6-52ee-92ad-dc5c7302d47e": preview("1770078253004-9g6ni6.png?w=800&q=80"),
	"0480333f-8a92-5cca-aae0-c324fcf049f8": preview("1770078019014-d1u620.png?w=800&q=80"),
	"0b034438-9567-5688-bb7b-ad4261315d40": preview("1770072206783-u06icw.png?w=400&h=400&fit=crop"),
	"0c71cde9-f877-5a18-b300-abb49ca6f076": {
		src: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop",
	},
	"156842e8-2fb7-55ae-ab0b-27ec9d3055bd": logo(1),
	"1f94fe9e-1109-5ddb-8da6-10ed3675aeaf": {
		src: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1600&q=80",
	},
	"28089d5d-3547-5556-b06f-a9b8b46806ba": {
		src: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
	},
	"298fda26-e2ef-5ac1-a834-d18d1a9903a1": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/development/website-builder-v2/florora-logo.svg",
	},
	"44b67823-a545-5ff8-84d1-3be249ff0c54": {
		src: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=1600&q=80",
	},
	"499fa051-dd27-564e-baa1-a954a993a1a8": {
		src: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=1920&h=1080&fit=crop",
	},
	"4e22aa1b-0656-5c24-84c1-7e21eb6fdd67": preview("1770074829389-ej3i6m.png?w=400&h=400&fit=crop"),
	"54106edb-df9f-5a3b-9ea7-270facc342b3": preview("1770076902666-1iqwf1.png?w=800&q=80"),
	"638114b8-5df0-552d-a04b-46ccbb32abe2": preview("1770074543573-i8eh83.png?w=400&h=400&fit=crop"),
	"63d260aa-fb32-5b0b-80f4-6a5df2cf1e1e": {
		src: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1920",
	},
	"6b670018-6b45-5532-b4da-9adee15c4c90": logo(7),
	"735edd9a-8c2c-5dd7-aa40-50b8d3c4c378": preview("1770074373284-uaacsb.png?w=400&h=400&fit=crop"),
	"7c38ce71-5e02-55f4-a3e5-040bd44348ae": logo(2),
	"86c7a657-df58-5c0a-b725-ef9d02aa5f4d": {
		src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
	},
	"8a41ef86-aac9-584b-9347-31b01e03d2a2": logo(5),
	"8f6c6c8e-7566-53fb-b4a0-1751d5f379de": preview("1770076933831-789tv5.png?w=800"),
	"9b3b247f-b541-5b60-b36f-1d71fd79d791": preview("1770074981627-bomu7g.png?w=400&h=400&fit=crop"),
	"9ca74eec-dbbb-5fe6-b496-a812c51bfd22": preview("1770075103972-jzfmpg.png?w=1920"),
	"a0424212-96b3-5c45-a5c4-1c877d7d9ab1": {
		src: "https://images.unsplash.com/photo-1592595896551-12b371d546d5?w=800&q=80",
	},
	"a1d21984-d87c-5527-9769-31f92966cbec": {
		src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
	},
	"a6734e9c-41b8-50fe-ae91-31817aebec4d": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/development/website-builder-v2/florora-logo-inverted.svg",
	},
	"ab98ced5-0a98-51b5-b271-18cae8f8df09": preview("1770078065389-q1jdu4.png?w=800&q=80"),
	"aea7b32a-6b80-5278-866e-55be03d9ece5": preview("1770072490592-fclt9d.png?w=400&h=400&fit=crop"),
	"b1a03a7b-aa79-5aee-98ff-7674a0c4b7bf": logo(6),
	"b3d0e48e-394d-5501-bb62-912026d407fc": preview("1770077002456-rpo7tx.png?w=800"),
	"b3f4b705-6692-5c6b-b2e1-51676e8fe812": {
		src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
	},
	"ba5f71f1-84b0-546c-82eb-e7f00145d7a5": logo(8),
	"c1d10dee-bf69-52a5-ab4d-5f5c27d41455": preview("1770078076143-7jhouf.png?w=800&q=80"),
	"ddace705-7a13-580a-b470-7b46de128d02": logo(4),
	"eaded486-2c90-5193-ad00-3adefd5cf218": logo(3),
	"f86adafa-67a9-5775-b08c-30572cf795b9": { src: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800" },
	"f86ce7e7-a173-5426-8165-69400000dfd2": {
		src: "https://images.unsplash.com/photo-1592595896551-12b371d546d5?w=1600&q=80",
	},
};
