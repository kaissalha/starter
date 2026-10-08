"use client";

import { createContext, use, type ReactNode } from "react";

import { authClient } from "@/lib/auth-client";

export type AuthSession = typeof authClient.$Infer.Session;

const SessionContext = createContext<AuthSession | null | undefined>(undefined);

export const AuthSessionContext = ({
	children,
	initialSession,
}: {
	children: ReactNode;
	initialSession: AuthSession | null;
}) => {
	authClient.hydrateSession(initialSession);

	return <SessionContext value={initialSession}>{children}</SessionContext>;
};

export const useAuthSession = () => {
	const initialSession = use(SessionContext);
	const session = authClient.useSession();
	const isUsingServerSession = initialSession !== undefined && session.isPending && !session.isRefetching;

	return {
		...session,
		data: isUsingServerSession ? initialSession : session.data,
		isPending: isUsingServerSession ? false : session.isPending,
	};
};
