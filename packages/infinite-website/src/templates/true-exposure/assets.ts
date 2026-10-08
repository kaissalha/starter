import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const preview = (name: string) => ({ src: `${blob}/websites/preview-media/${name}` });

const logo = (index: number) => ({ src: `${blob}/infinite-design/example-logos/color/logo-${index}.svg` });

export const trueExposureAssets: AssetMap = {
	"03d64828-6bc6-52ee-92ad-dc5c7302d47e": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production/websites/infinite-images/286160b5-f686-4367-b390-c4288279548f-DPkcN68cNW1IPSibMYgWf7PPdmWQQt.png",
	},
	"0480333f-8a92-5cca-aae0-c324fcf049f8": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production/websites/infinite-images/ff3470c2-d75d-4223-99fa-541af50fa3ab-qSXHxV7bMtWDS1Ptt0Wt4IvRi9Z5iA.png",
	},
	"0c71cde9-f877-5a18-b300-abb49ca6f076": preview("1769721406765-ss0dre.png"),
	"156842e8-2fb7-55ae-ab0b-27ec9d3055bd": logo(1),
	"47e5117b-c5b8-5daf-a799-a62c6e41022b": preview("1770159187745-hshybf.png"),
	"4bca24e9-5a6c-5bdf-b7f8-1dae11822c8d": preview("1770155301949-xlpj8y.png"),
	"5f548492-6f27-59da-a33a-7be6bc451fd2": preview("1770158458739-k3j4mu.png"),
	"63d260aa-fb32-5b0b-80f4-6a5df2cf1e1e": preview("1770159396974-tim8xc.png"),
	"6b670018-6b45-5532-b4da-9adee15c4c90": logo(7),
	"7c38ce71-5e02-55f4-a3e5-040bd44348ae": logo(2),
	"83dc0e2c-cc53-5693-b8ab-1016461edfb6": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production/websites/infinite-images/e9b86f98-598c-457e-841d-dc1ec8e62273-eCfadmS5yRxfCi2wF702uPi7Sf2NtM.png",
	},
	"84095c37-d336-59df-ae7b-f2d4f6623100": preview("1770151671167-a7quw4.png"),
	"8589bdb3-39fc-5795-b6aa-cc9fdcfbc7c1": preview("1770157200593-nkkyla.png"),
	"86c7a657-df58-5c0a-b725-ef9d02aa5f4d": preview("1769721319953-oqgv9d.png"),
	"8a41ef86-aac9-584b-9347-31b01e03d2a2": logo(5),
	"8ab2f846-e86e-50b5-82f1-52e40ad07ab4": preview("1770158814259-ugh0g5.png"),
	"a1d21984-d87c-5527-9769-31f92966cbec": preview("1769725152412-4m4ggp.png"),
	"ab98ced5-0a98-51b5-b271-18cae8f8df09": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production/websites/infinite-images/f5a3601d-bafc-4ecb-93f8-4f3966312058-kpgvpfWfTj4NbCLxtcKooWwGfIw2Vc.png",
	},
	"b1a03a7b-aa79-5aee-98ff-7674a0c4b7bf": logo(6),
	"b3d0e48e-394d-5501-bb62-912026d407fc": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production/websites/infinite-images/a3b9ed1a-28ac-4ff4-8556-edcbf6ccdc6e-DwDHcYankHMl83ZUlLQtLLCDKuiGvI.png",
	},
	"ba5f71f1-84b0-546c-82eb-e7f00145d7a5": logo(8),
	"c1d10dee-bf69-52a5-ab4d-5f5c27d41455": {
		src: "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production/websites/infinite-images/9e249425-f75d-41ba-b6f7-1f33aab2d01d-Q1gaIZWIgKAK3gSoSAfjDmhVVsU2KD.png",
	},
	"cce3af2e-d780-5ec9-94c8-70f538c51e19": preview("1770159319831-x3zvdn.png"),
	"ddace705-7a13-580a-b470-7b46de128d02": logo(4),
	"eaded486-2c90-5193-ad00-3adefd5cf218": logo(3),
};
