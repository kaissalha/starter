import { create, useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

type AuthLoginFlowState = {
	beginOtp: ({ email }: { email: string }) => void;
	email: string;
	isOtpSent: boolean;
	otpSentAt: Date | null;
	reset: () => void;
};

const authLoginFlowStore = create<AuthLoginFlowState>((set) => ({
	beginOtp: ({ email }) => set({ email, isOtpSent: true, otpSentAt: new Date() }),
	email: "",
	isOtpSent: false,
	otpSentAt: null,
	reset: () => set({ email: "", isOtpSent: false, otpSentAt: null }),
}));

export const useAuthLoginFlowStore = <T>(selector: (state: AuthLoginFlowState) => T): T => {
	return useStore(authLoginFlowStore, useShallow(selector));
};
