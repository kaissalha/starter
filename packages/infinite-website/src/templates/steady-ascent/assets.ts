import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const preview = (name: string) => ({ src: `${blob}/websites/preview-media/${name}` });

const logo = (index: number) => ({ src: `${blob}/infinite-design/example-logos/color/logo-${index}.svg` });

export const steadyAscentAssets: AssetMap = {
	"0480333f-8a92-5cca-aae0-c324fcf049f8": preview("1770152019980-6npbvl.png"),
	"0c71cde9-f877-5a18-b300-abb49ca6f076": preview("1769737578167-9u616f.png?w=100&h=100&fit=crop"),
	"156842e8-2fb7-55ae-ab0b-27ec9d3055bd": logo(1),
	"204e355a-f55b-5f5c-ad50-e8a3951898c7": preview("1770152021687-l6p9hu.png"),
	"5af09811-c10f-5eec-85d8-e782a1f374db": preview("1770151671167-a7quw4.png"),
	"6b670018-6b45-5532-b4da-9adee15c4c90": logo(7),
	"7014eddd-f58f-5297-a68e-3451d55810d0": preview("1770152187028-66avpq.png"),
	"7c38ce71-5e02-55f4-a3e5-040bd44348ae": logo(2),
	"84095c37-d336-59df-ae7b-f2d4f6623100": preview("1769725236492-gf5hw7.png?w=100&h=100&fit=crop"),
	"8a41ef86-aac9-584b-9347-31b01e03d2a2": logo(5),
	"96535418-6158-5319-87fe-f51c836f32b5": preview("1770151001835-xxu484.png"),
	"9ca74eec-dbbb-5fe6-b496-a812c51bfd22": preview("1770150222812-ottpys.png"),
	"a1d21984-d87c-5527-9769-31f92966cbec": preview("1770074373284-uaacsb.png?w=100&h=100&fit=crop"),
	"ab98ced5-0a98-51b5-b271-18cae8f8df09": preview("1770152070129-tv6ou1.png"),
	"b1a03a7b-aa79-5aee-98ff-7674a0c4b7bf": logo(6),
	"b3d0e48e-394d-5501-bb62-912026d407fc": preview("1770152019413-4zyqjg.png"),
	"b9775490-e482-5f1d-a1a9-d269b2e10031": preview("1770151533188-g7ldb2.png"),
	"ba5f71f1-84b0-546c-82eb-e7f00145d7a5": logo(8),
	"c19e9246-f2db-5d7e-a2cc-f65d206b37cd": preview("1770150767939-29ikak.png"),
	"c1d10dee-bf69-52a5-ab4d-5f5c27d41455": preview("1770152026847-myzbcr.png"),
	"c68dde34-8ca1-507d-975b-cf533185e203": preview("1769725160376-blk6gn.png?w=100&h=100&fit=crop"),
	"cf1be094-499c-5fdd-8ae8-7b931afc0436": preview("1770150550313-xyf9a2.png"),
	"dcfc3476-ec22-51b1-8d11-d624370ea750": preview("1770075103972-jzfmpg.png?w=100&h=100&fit=crop"),
	"ddace705-7a13-580a-b470-7b46de128d02": logo(4),
	"eaded486-2c90-5193-ad00-3adefd5cf218": logo(3),
};
