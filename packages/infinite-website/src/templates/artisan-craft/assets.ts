import type { AssetMap } from "../../rendering/render-node";

const blob = "https://rjdavx8ozyznxeyh.public.blob.vercel-storage.com/production";

const generated = (name: string) => ({ src: `${blob}/websites/preview-media/generated/${name}.png` });

const logo = (index: number) => ({ src: `${blob}/infinite-design/example-logos/color/logo-${index}.svg` });

const image = (name: string) => ({ src: `${blob}/websites/infinite-images/${name}.png` });

export const artisanCraftAssets: AssetMap = {
	"0666b532-1e31-5af7-b221-12412dd1e473": image(
		"298be0bd-9b81-4b61-837d-d461ff045a7d-U4yNs5Z01EPaaGeMGNAmQN3QnQpQVZ"
	),
	"156842e8-2fb7-55ae-ab0b-27ec9d3055bd": logo(1),
	"1753e090-bec2-5cd9-a42e-726f7d46b52d": image(
		"e49cf4ab-da50-4bc4-9745-6298feba507e-i5fx9Ut9rjw7iwpnpfwFZ1i4v8MHMz"
	),
	"1ee7edb1-3db2-5496-9e72-bd448aaf368a": generated("1776126943736-28c08791-f55a-484a-a9d7-1cdd6c324f13"),
	"200f770c-080e-5ad3-99a3-164d06942567": generated("1776127469210-6a6a76c4-67c5-48fa-8d2f-c79e71ab3dd7"),
	"579db33c-0b00-57cf-86fa-f899d33ac693": generated("1776127706680-cb3427b1-94fd-436a-90d4-217dccd25c0b"),
	"6054a92c-74c3-5551-be4d-2943274d0c0d": logo(7),
	"77723c02-b4c8-551b-92c3-a2393056bb07": logo(5),
	"7c38ce71-5e02-55f4-a3e5-040bd44348ae": logo(2),
	"9d25b352-6e3d-52cb-8b62-e0cd0f07f37f": image(
		"bc7076a7-2791-4fc5-9ae4-9a694b98cf16-MOmj1NRtWvzgYPUT0mrG7Z4ARZSKP9"
	),
	"a2e6f210-1c16-59c7-9a29-51b63462d429": {
		src: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80",
	},
	"a3376636-4e07-5974-b11b-7b17a1d9bf4a": {
		src: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
	},
	"b75849e7-5460-5a26-801c-7d78f070ad22": logo(6),
	"c1480554-e263-58f5-83b0-0ffba6e55be1": image(
		"51c182ec-cd5a-40d6-8848-fad7f7802429-TZQza7aqstaINoGcwocnJVJ4pxcST5"
	),
	"ce974b79-e0ad-5360-9669-1466c9e0a1ec": image(
		"a102a055-5a60-4b62-962e-8ff2706b099d-ecEXCeIYtZKhETVDlzKeSN0Rn9K1wU"
	),
	"da01c101-518e-52fc-afe5-b5ca18fca4c0": logo(8),
	"ddace705-7a13-580a-b470-7b46de128d02": logo(4),
	"dde1e884-f830-51f1-bb20-45636d443055": image(
		"08682e80-9b18-4289-ad3d-bfddbe004baf-6Hj8hIfecfEyAJq7wVdR5BfvtE3Uol"
	),
	"eaded486-2c90-5193-ad00-3adefd5cf218": logo(3),
	"eb21fcb0-239d-5f31-9022-82e764e1af65": image(
		"85afed51-e15c-4a18-9d95-205b3ff2961f-TUtNK4oRki5eW0RN6He79sJZCSoRv9"
	),
	"eb6ab42a-c54c-523b-8de2-de6578fa9cb7": image(
		"59a33b7c-0abd-4894-889e-e91e5f967b84-uh46Aamo260IbL0pr2VydW1nbpAdGW"
	),
	"eb9f274f-ef34-5ee6-9437-03ad740bd13b": {
		src: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80",
	},
};
