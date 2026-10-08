import { Suspense, type ComponentProps } from "react";

import { NavbarContinueButton, NavbarContinueButtonFallback } from "./navbar-continue-button";
import { NavbarMenu } from "./navbar-menu";

export const Navbar = (props: ComponentProps<"header">) => {
	return (
		<NavbarMenu
			{...props}
			desktopContinueButton={
				<Suspense fallback={<NavbarContinueButtonFallback size='sm' />}>
					<NavbarContinueButton size='sm' />
				</Suspense>
			}
			mobileContinueButton={
				<Suspense fallback={<NavbarContinueButtonFallback size='lg' />}>
					<NavbarContinueButton size='lg' />
				</Suspense>
			}
		/>
	);
};
