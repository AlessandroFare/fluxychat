"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Star } from "lucide-react";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  listSavedMessages,
  type SavedMessageItem,
} from "@/lib/saved-messages-client";

export default function SavedMessagesPage() {
  const router = useRouter();
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SavedMessageItem[]>([]);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await listSavedMessages(token, 100));
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load saved messages"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Saved"
        description="Messages you saved for later. Hover a message in chat and use Save."
      />

      {!token ? (
        <EmptyState
          icon={Star}
          title="Connect a session"
          description="Mint a JWT in Quickstart to list your saved messages."
          action={{
            label: "Open quickstart",
            onClick: () => router.push("/onboarding"),
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "mr-1.5 size-3.5 animate-spin" : "mr-1.5 size-3.5"} />
              Refresh
            </Button>
          </div>

          {error ? (
            <Banner variant="error" className="mb-4">
              {error}
            </Banner>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Star}
              title="Nothing saved yet"
              description="Messages you save show up here with a link back to their room."
              action={{
                label: "Open rooms",
                onClick: () => router.push("/rooms"),
              }}
            />
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={`${item.roomId}:${item.messageId}`}>
                  <Panel className="p-4">
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {item.preview || "(empty message)"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.authorId} · room{" "}
                      <Link
                        href={`/rooms?room=${encodeURIComponent(item.roomId)}&messageId=${item.messageId}`}
                        className="text-brand underline underline-offset-2"
                      >
                        {item.roomName || item.roomId}
                      </Link>{" "}
                      · saved {formatDateTime(item.savedAt)}
                    </p>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </ConsoleShell>
  );
}
