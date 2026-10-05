import { useEffect, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";

const workerUrl = import.meta.env.VITE_FLUXYCHAT_WORKER_URL?.trim();
const memberJwt = import.meta.env.VITE_FLUXYCHAT_MEMBER_JWT?.trim();
const publicRoomId = import.meta.env.VITE_FLUXYCHAT_PUBLIC_ROOM_ID?.trim();
const configuredRoomId = import.meta.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "demo";

export type DealSeat = "buyer" | "counsel";

export interface FluxySession {
  workerUrl: string;
  token: string;
  userId: string;
  roomId: string;
  mode: "member" | "guest";
}

function guestKeyForSeat(seat: DealSeat): string {
  const storageKey = `fluxy.negotiationSeat.${seat}`;
  let existing = sessionStorage.getItem(storageKey);
  if (!existing || !/^[A-Za-z0-9_-]{16,128}$/.test(existing)) {
    existing =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8)
        : `${Date.now()}${Math.random().toString(36).slice(2, 18)}`;
    sessionStorage.setItem(storageKey, existing);
  }
  return existing;
}

export function readDealSeat(): DealSeat {
  if (typeof window === "undefined") return "buyer";
  return new URLSearchParams(window.location.search).get("seat") === "counsel" ? "counsel" : "buyer";
}

export function useFluxySession(seat: DealSeat): {
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
        displayName: seat,
        guestKey: guestKeyForSeat(seat),
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
  }, [seat]);

  return { session, loading, error };
}

export { workerUrl };
