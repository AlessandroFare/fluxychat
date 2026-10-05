import { useCallback, useState } from "react";

export interface PushRegistrationState {
  token: string | null;
  backend: "expo" | "fcm-v1" | "apns" | null;
  error: string | null;
}

/**
 * Registers a device token with the Worker. Expo Go does not receive remote push
 * from SDK 53 — use a development build. HITL actions must POST a one-time token.
 */
export function usePushRegistration(opts: {
  workerUrl: string;
  token: string;
  backend?: "expo" | "fcm-v1" | "apns";
}) {
  const [state, setState] = useState<PushRegistrationState>({
    token: null,
    backend: opts.backend ?? "expo",
    error: null,
  });

  const register = useCallback(
    async (deviceToken: string) => {
      const backend = opts.backend ?? "expo";
      const res = await fetch(`${opts.workerUrl.replace(/\/$/, "")}/api/device/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: deviceToken,
          pushToken: deviceToken,
          platform: backend === "apns" ? "apns" : "fcm",
          backend,
          pushProvider: backend,
        }),
      });
      if (!res.ok) {
        setState({ token: null, backend, error: `register_failed_${res.status}` });
        return;
      }
      setState({ token: deviceToken, backend, error: null });
    },
    [opts.backend, opts.token, opts.workerUrl],
  );

  return { ...state, register };
}
