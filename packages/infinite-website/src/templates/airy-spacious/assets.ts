import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const generated = (name: string) => ({ src: `${blob}/websites/preview-media/generated/${name}.png` });

export const airySpaciousAssets: AssetMap = {
	"03d64828-6bc6-52ee-92ad-dc5c7302d47e": generated("1783576139501-0ab54869-e4f9-4ba4-8334-6e8bcc8eee9f"),
	"0480333f-8a92-5cca-aae0-c324fcf049f8": generated("1783574759133-d0cdabdb-ac55-45fc-bbf4-162b65c7bddd"),
	"5f548492-6f27-59da-a33a-7be6bc451fd2": generated("1783574689101-4d0ea623-1072-41f2-ada6-af892f3ee7b6"),
	"83dc0e2c-cc53-5693-b8ab-1016461edfb6": generated("1783575139050-e27be407-e043-47a6-88f7-ec8606fbd538"),
	"87dabc8d-23bd-55ff-a537-88f782c975a3": generated("1783574876994-43e2e9a3-b7ee-4223-b13c-a0431597dc32"),
	"9b3b247f-b541-5b60-b36f-1d71fd79d791": generated("1783575121393-f0d39c88-adc7-4458-bef3-75b9692490e8"),
	"9ca74eec-dbbb-5fe6-b496-a812c51bfd22": generated("1783576148895-b6a41f03-416e-4f97-a4ff-d99d50a5fb57"),
	"ab98ced5-0a98-51b5-b271-18cae8f8df09": generated("1783574692725-1670b560-e544-4659-8ce9-5b71bf615c13"),
	"b3d0e48e-394d-5501-bb62-912026d407fc": generated("1783575251893-a854eeef-d3f6-4af6-bf9a-c1ece2971e12"),
	"c1d10dee-bf69-52a5-ab4d-5f5c27d41455": generated("1783575370805-31f94070-7f8f-4e0b-b31b-dc4f9714e5e0"),
	"ef263e03-6329-5fea-bb99-3e5259310d01": generated("1783575134029-a68a13e2-9992-4a65-94c8-73143bc57234"),
	"ff06ea48-c669-5e07-a425-5de21a69067c": generated("1783575252821-b0843c6f-743b-4fbf-aefd-6efcad88ec00"),
};
