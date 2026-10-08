import type { ComponentProps } from "react";

import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@starter/ui/lib/utils";

const Spinner = ({ className, ...props }: Omit<ComponentProps<typeof HugeiconsIcon>, "icon">) => {
	return (
		<HugeiconsIcon
			aria-label='Loading'
			className={cn("scale-110", "size-4 animate-spin", className)}
			icon={Loading03Icon}
			role='status'
			strokeWidth={1.75}
			{...props}
		/>
	);
};

export { Spinner };
