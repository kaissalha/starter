import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const preview = (name: string) => ({ src: `${blob}/websites/preview-media/${name}` });

const logo = (index: number) => ({ src: `${blob}/infinite-design/example-logos/color/logo-${index}.svg` });

export const strategicInsightAssets: AssetMap = {
	"156842e8-2fb7-55ae-ab0b-27ec9d3055bd": logo(1),
	"4c0ccd62-1d50-58d2-bdd6-fa2e74df274d": preview("1770152019413-4zyqjg.png"),
	"59bdea2d-7c95-599f-aea4-dd260b3f21ba": preview("1770151001835-xxu484.png"),
	"6b670018-6b45-5532-b4da-9adee15c4c90": logo(7),
	"7014eddd-f58f-5297-a68e-3451d55810d0": preview("1770152187028-66avpq.png"),
	"7189ce04-86f4-5160-9864-f4fd6569983d": preview("1770151533188-g7ldb2.png"),
	"7c38ce71-5e02-55f4-a3e5-040bd44348ae": logo(2),
	"84095c37-d336-59df-ae7b-f2d4f6623100": preview("1769725236492-gf5hw7.png?w=100&h=100&fit=crop"),
	"8a41ef86-aac9-584b-9347-31b01e03d2a2": logo(5),
	"9ca74eec-dbbb-5fe6-b496-a812c51bfd22": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production/websites/preview-media/generated/1773713096457-4f022798-f2f6-4f18-a578-58dedaf04e23.png",
	},
	"a1d21984-d87c-5527-9769-31f92966cbec": preview("1769737578167-9u616f.png?w=100&h=100&fit=crop"),
	"b1a03a7b-aa79-5aee-98ff-7674a0c4b7bf": logo(6),
	"ba5f71f1-84b0-546c-82eb-e7f00145d7a5": logo(8),
	"c68dde34-8ca1-507d-975b-cf533185e203": preview("1769725160376-blk6gn.png?w=100&h=100&fit=crop"),
	"ddace705-7a13-580a-b470-7b46de128d02": logo(4),
	"dff13cec-f982-5bf1-95cf-6c2f07590f75": preview("1770152021687-l6p9hu.png"),
	"e3b0673a-c040-5f96-adff-c1b5c255dfc9": preview("1770150767939-29ikak.png"),
	"e4eb75ab-0b93-5e1f-8f62-19e8e30e672e": preview("1770150550313-xyf9a2.png"),
	"eaded486-2c90-5193-ad00-3adefd5cf218": logo(3),
};
