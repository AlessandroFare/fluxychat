import { useEffect, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim();
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim();
const publicRoomId = import.meta.env.VITE_FLUXYCHAT_PUBLIC_ROOM_ID?.trim();
const configuredRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "demo";

export interface FluxySession {
  workerUrl: string;
  token: string;
  userId: string;
  roomId: string;
  mode: "member" | "guest";
}

export function useFluxySession(): {
  session: FluxySession | null;
  loading: boolean;
  error: string | null;
} {
  const [session, setSession] = useState<FluxySession | null>(null);
  const [loading, setLoading] = useState(Boolean(workerUrl));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workerUrl) {
      setLoading(false);
      return;
    }
    if (memberJwt) {
      setSession({
        workerUrl,
        token: memberJwt,
        userId: "demo-user",
        roomId: configuredRoomId,
        mode: "member",
      });
      setLoading(false);
      return;
    }
    if (publicRoomId) {
      let cancelled = false;
      void FluxyChatClient.joinPublicRoomAsGuest(workerUrl, publicRoomId, {
        displayName: "Guest",
      })
        .then((guest) => {
          if (cancelled) return;
          setSession({
            workerUrl,
            token: guest.token,
            userId: guest.userId,
            roomId: guest.roomId,
            mode: "guest",
          });
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Guest session failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    setLoading(false);
  }, []);

  return { session, loading, error };
}

export { workerUrl };
