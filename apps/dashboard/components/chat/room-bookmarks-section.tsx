"use client";

import * as React from "react";
import { Bookmark, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createRoomBookmark,
  deleteRoomBookmark,
  listRoomBookmarks,
  type RoomBookmarkItem,
} from "@/lib/room-bookmarks-client";

export function RoomBookmarksSection({
  roomId,
  token,
}: {
  roomId: string;
  token: string;
}) {
  const [bookmarks, setBookmarks] = React.useState<RoomBookmarkItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [url, setUrl] = React.useState("");

  const load = React.useCallback(async () => {
    if (!token.trim() || !roomId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setBookmarks(await listRoomBookmarks(token, roomId));
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load bookmarks"));
      setBookmarks([]);
    } finally {
      setLoading(false);
    }
  }, [token, roomId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!label.trim() || !url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createRoomBookmark(token, roomId, { label: label.trim(), url: url.trim() });
      setLabel("");
      setUrl("");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to add bookmark"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(bookmarkId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteRoomBookmark(token, roomId, bookmarkId);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to delete bookmark"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="room-bookmarks-section">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Bookmark className="size-3.5" />
        Bookmarks
      </h4>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!loading && bookmarks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No bookmarks yet.</p>
      ) : null}
      <ul className="space-y-1">
        {bookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs"
          >
            <a
              href={bookmark.url}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium hover:underline"
              title={bookmark.url}
            >
              {bookmark.label}
            </a>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Delete bookmark ${bookmark.label}`}
              onClick={() => void remove(bookmark.id)}
              disabled={busy}
            >
              <Trash2 className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col gap-1.5">
        <input
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          data-testid="bookmark-label-input"
        />
        <input
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring/30"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          data-testid="bookmark-url-input"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          disabled={busy || !label.trim() || !url.trim()}
          onClick={() => void add()}
        >
          <Plus className="size-3.5" />
          Add bookmark
        </Button>
      </div>
    </section>
  );
}
