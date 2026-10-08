"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";

export const ChatActivityOrb = ({ state = "composing" }: { state?: OrbState }) => (
	<ThinkingOrb
		aria-hidden
		className='shrink-0'
		data-thinking-orb-state={state}
		role='presentation'
		size={20}
		state={state}
	/>
);

ChatActivityOrb.displayName = "ChatActivityOrb";
