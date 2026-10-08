import * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "@starter/ui/lib/utils";

import { useIsMobile } from "../hooks/use-is-mobile";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import {
	Drawer,
	DrawerClose,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerOverlay,
	DrawerPanel,
	DrawerPopup,
	DrawerTitle,
	DrawerTrigger,
} from "./drawer";

const credenzaBodyVariants = cva("", { variants: { isMobile: { false: "px-0", true: "px-4" } } });

const credenzaContentVariants = cva("", { variants: { padding: { default: null, none: "p-0" } } });

type BaseProps = {
	children?: React.ReactNode;
	className?: string;
};

type CredenzaCloseProps = BaseProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

type RootCredenzaProps = {
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	side?: "top" | "bottom" | "left" | "right";
	type?: "dialog" | "drawer";
} & BaseProps;

type CredenzaProps = BaseProps & {
	"aria-label"?: string;
	autoFocus?: boolean;
	closeLabel?: string;
	handleClassName?: string;
	noOverlay?: boolean;
	padding?: "default" | "none";
	showClose?: boolean;
	side?: "top" | "bottom" | "left" | "right";
	stackable?: boolean;
};

type CredenzaContextValue = {
	isMobile: boolean;
	resolved: "drawer" | "dialog";
};

const CredenzaContext = React.createContext<CredenzaContextValue>({
	isMobile: false,
	resolved: "dialog",
});

const useCredenzaContext = () => React.useContext(CredenzaContext);

const Credenza = ({ children, side = "right", type = "dialog", ...props }: RootCredenzaProps) => {
	const isMobile = useIsMobile();
	const useDrawer = isMobile || type === "drawer";

	if (useDrawer) {
		const position = isMobile ? "bottom" : side;

		return (
			<CredenzaContext.Provider value={{ isMobile, resolved: "drawer" }}>
				<Drawer position={position} {...props}>
					{children}
				</Drawer>
			</CredenzaContext.Provider>
		);
	}

	return (
		<CredenzaContext.Provider value={{ isMobile, resolved: "dialog" }}>
			<Dialog {...props}>{children}</Dialog>
		</CredenzaContext.Provider>
	);
};

const CredenzaTrigger = ({ children, className, ...props }: BaseProps) => {
	const { resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerTrigger className={className} {...props}>
				{children}
			</DrawerTrigger>
		);
	}

	return (
		<DialogTrigger className={className} {...props}>
			{children}
		</DialogTrigger>
	);
};

const CredenzaClose = ({ children, className, ...props }: CredenzaCloseProps) => {
	const { resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerClose className={className} {...props}>
				{children}
			</DrawerClose>
		);
	}

	return (
		<DialogClose className={className} {...props}>
			{children}
		</DialogClose>
	);
};

const CredenzaContent = ({
	"aria-label": ariaLabel,
	children,
	className,
	closeLabel,
	padding = "default",
	stackable = true,
	...props
}: Omit<CredenzaProps, "aria-label"> & { "aria-label": string }) => {
	const { isMobile, resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerPopup
				aria-label={ariaLabel}
				className={cn(credenzaContentVariants({ padding }), className)}
				closeLabel={closeLabel}
				data-stackable={stackable}
				showBar={isMobile}
				showCloseButton={isMobile && closeLabel !== undefined}
				variant={isMobile ? "default" : "inset"}
				{...props}
			>
				{children}
			</DrawerPopup>
		);
	}

	return (
		<DialogContent
			aria-label={ariaLabel}
			className={className}
			closeLabel={closeLabel}
			data-stackable={stackable}
			padding={padding}
			{...props}
		>
			{children}
		</DialogContent>
	);
};

const CredenzaDescription = ({ children, className, ...props }: BaseProps) => {
	const { resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerDescription className={className} {...props}>
				{children}
			</DrawerDescription>
		);
	}

	return (
		<DialogDescription className={className} {...props}>
			{children}
		</DialogDescription>
	);
};

const CredenzaHeader = ({ children, className, ...props }: BaseProps) => {
	const { resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerHeader className={className} {...props}>
				{children}
			</DrawerHeader>
		);
	}

	return (
		<DialogHeader className={className} {...props}>
			{children}
		</DialogHeader>
	);
};

const CredenzaTitle = ({ children, className, ...props }: BaseProps) => {
	const { resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerTitle className={className} {...props}>
				{children}
			</DrawerTitle>
		);
	}

	return (
		<DialogTitle className={className} {...props}>
			{children}
		</DialogTitle>
	);
};

const CredenzaOverlay = ({ className }: { className?: string }) => {
	const { resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return <DrawerOverlay className={className} />;
	}

	return <DialogOverlay className={className} />;
};

const CredenzaBody = ({ children, className, scrollable, ...props }: BaseProps & { scrollable?: boolean }) => {
	const { isMobile, resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerPanel
				className={cn(credenzaBodyVariants({ isMobile }), className)}
				scrollable={scrollable ?? true}
				{...props}
			>
				{children}
			</DrawerPanel>
		);
	}

	return (
		<div className={cn(credenzaBodyVariants({ isMobile }), className)} {...props}>
			{children}
		</div>
	);
};

const CredenzaFooter = ({ children, className, ...props }: BaseProps) => {
	const { resolved } = useCredenzaContext();

	if (resolved === "drawer") {
		return (
			<DrawerFooter className={className} {...props}>
				{children}
			</DrawerFooter>
		);
	}

	return (
		<DialogFooter className={className} {...props}>
			{children}
		</DialogFooter>
	);
};

const CredenzaPortal = ({ children }: BaseProps) => <>{children}</>;

export {
	Credenza,
	CredenzaPortal,
	CredenzaTrigger,
	CredenzaClose,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaBody,
	CredenzaFooter,
	CredenzaOverlay,
};
