import type { ReactNode } from "react";

import { View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

export type PageBreakProps = {
	children?: never;
	style?: Style;
};

export const PageBreak = ({ style }: PageBreakProps) => <View break style={style} />;

export type KeepTogetherProps = {
	children?: ReactNode;
	minPresenceAhead?: number;
	style?: Style;
};

export const KeepTogether = ({ children, minPresenceAhead, style }: KeepTogetherProps) => (
	<View minPresenceAhead={minPresenceAhead} style={style} wrap={false}>
		{children}
	</View>
);
