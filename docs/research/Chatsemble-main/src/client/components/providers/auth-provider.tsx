import { authClient } from "@client/lib/auth-client";
import { createContext, useContext } from "react";

type SessionContextType = ReturnType<typeof authClient.useSession>["data"];

const SessionContext = createContext<SessionContextType>(null);

export function useAuthSession() {
	const session = useContext(SessionContext);

	if (!session) {
		throw new Error("useSession must be used within an AuthProvider");
	}

	return session;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const { data: session } = authClient.useSession();

	return (
		<SessionContext.Provider value={session}>
			{children}
		</SessionContext.Provider>
	);
}
