"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "./ui";
import {
  acknowledgeConsent,
  getConsentStatus,
  type ConsentStatus,
} from "@/lib/consent-dpa-client";
import { messageFromUnknown } from "@/lib/error-message";

export interface EuConsentBannerProps {
  token: string;
  roomId: string;
}

export function EuConsentBanner({ token, roomId }: EuConsentBannerProps) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedRoomId = roomId.trim();
  const trimmedToken = token.trim();

  const load = useCallback(async () => {
    if (!trimmedToken || !trimmedRoomId) {
      setStatus(null);
      return;
    }
    try {
      const res = await getConsentStatus(trimmedToken, trimmedRoomId);
      setStatus(res);
      setError(null);
    } catch {
      setStatus(null);
    }
  }, [trimmedToken, trimmedRoomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(eventType: "accepted" | "declined") {
    if (!trimmedToken) return;
    setBusy(true);
    setError(null);
    try {
      await acknowledgeConsent(trimmedToken, {
        roomId: status?.settings?.requireRoomConsent ? trimmedRoomId : undefined,
        eventType,
        dpaVersion: status?.settings?.dpaVersion,
      });
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Could not record consent"));
    } finally {
      setBusy(false);
    }
  }

  if (!status?.needsBanner || !status.settings) return null;

  const { bannerTitle, bannerBody, dpaDocumentUrl } = status.settings;

  return (
    <div
      role="dialog"
      aria-label="Data processing consent"
      className="mb-3 rounded-lg border border-amber-500/40 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-50"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{bannerTitle}</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">{bannerBody}</p>
          {dpaDocumentUrl ? (
            <p className="mt-2">
              <Link
                href={dpaDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-2 hover:underline"
              >
                Read Data Processing Agreement
              </Link>
            </p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void handleAction("accepted")}>
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Accept DPA
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void handleAction("declined")}>
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
