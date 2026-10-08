import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const preview = (name: string) => ({ src: `${blob}/websites/preview-media/${name}` });

const logo = (index: number) => ({ src: `${blob}/infinite-design/example-logos/color/logo-${index}.svg` });

export const urbanEdgeAssets: AssetMap = {
	"00a58176-1743-54e3-ba49-cd8dd4b5ad5f": preview("woman-deadlifting-gym.png?w=800"),
	"156842e8-2fb7-55ae-ab0b-27ec9d3055bd": logo(1),
	"24b80e4b-4f2f-50e5-8df8-6f5be63464b3": preview("boxer-wrapping-gloves-gym.png?w=800&q=80"),
	"26f0c008-552c-5132-9f5a-2ca01d2c128b": preview("woman-deadlifting-gym.png?w=1920&h=1080&fit=crop"),
	"475dd812-e820-5ef7-9932-d274d13ebc84": {
		src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
	},
	"49dbc06d-ece2-5d2c-8481-81e4edc1a7ca": preview("strength-conditioning-gym-turf-area.png?w=800&q=80"),
	"61001eb9-9a57-5294-a51c-69325c3d5a61": preview("personal-trainer-portrait-gym.png?w=400&h=400&fit=crop"),
	"6398fb74-ee22-56aa-8184-cecb653630f4": {
		src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
	},
	"6cd26007-eb21-5416-8e0f-286475f9f3fc": preview("free-weights-dumbbells-gym-interior.png?w=800"),
	"7c38ce71-5e02-55f4-a3e5-040bd44348ae": logo(2),
	"7c4f40f0-f8a3-56c2-8dda-92a4f8d3d661": preview("woman-leg-press-gym.png?w=100&h=100&fit=crop"),
	"826e026e-9302-5333-bb9f-fc42128c11dd": {
		src: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&q=80",
	},
	"84095c37-d336-59df-ae7b-f2d4f6623100": preview("man-seated-cable-row-gym.png?w=100&h=100&fit=crop"),
	"8a913557-b238-50d9-ad0d-1a9ce034a4f9": preview("deadlift-barbell-grip-closeup.png?w=800&q=80"),
	"96f86dc8-3913-5897-b586-aff66b5c64a3": preview("man-barbell-bicep-curl-gym.png?w=100&h=100&fit=crop"),
	"9b9c1bd1-f21f-53df-8006-531803a4c69c": preview("fitness-trainer-headshot-gym.png?w=400&h=400&fit=crop"),
	"ddace705-7a13-580a-b470-7b46de128d02": logo(4),
	"de0aab5b-9f68-535b-a16f-92337d5ccaa7": preview("woman-dumbbell-row-gym.png?w=100&h=100&fit=crop"),
	"dee17b28-95b2-52f1-8a65-b70103e3dc34": preview("woman-fitness-portrait-gym.png?w=400&h=400&fit=crop"),
	"eaded486-2c90-5193-ad00-3adefd5cf218": logo(3),
	"eb2424a8-5d3e-53ca-9ddd-0a1900acc243": preview("modern-gym-interior-equipment.png?w=800&q=80"),
	"f462ab49-733c-54d0-93d1-bf5abf38a431": preview("personal-trainer-assisting-cable-row.png?w=1920&h=1080&fit=crop"),
};
