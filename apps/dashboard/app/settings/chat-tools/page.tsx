"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Smile, Users, Bell } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { Banner, Button, Panel, Section, SkeletonCard } from "../../components/ui";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  addNotificationKeyword,
  createCustomEmoji,
  createUserGroup,
  deleteCustomEmoji,
  deleteUserGroup,
  listCustomEmojis,
  listNotificationKeywords,
  listUserGroups,
  removeNotificationKeyword,
  type CustomEmojiItem,
  type NotificationKeywordItem,
  type UserGroupItem,
} from "@/lib/chat-tools-client";

export default function ChatToolsSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [keywords, setKeywords] = useState<NotificationKeywordItem[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [groups, setGroups] = useState<UserGroupItem[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState("");
  const [emojis, setEmojis] = useState<CustomEmojiItem[]>([]);
  const [emojiName, setEmojiName] = useState("");
  const [emojiUrl, setEmojiUrl] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextKeywords, nextGroups, nextEmojis] = await Promise.all([
        listNotificationKeywords(token),
        listUserGroups(token),
        listCustomEmojis(token),
      ]);
      setKeywords(nextKeywords);
      setGroups(nextGroups);
      setEmojis(nextEmojis);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load chat tools"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, done: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Chat tools"
        description="Keyword alerts, mentionable user groups, and project custom emoji."
      />

      {!token ? (
        <Banner variant="error">
          Admin JWT required: keyword alerts are per-user, while groups and custom emoji are admin
          writes.
        </Banner>
      ) : null}
      {error ? <Banner variant="error" className="mb-4">{error}</Banner> : null}
      {notice ? <Banner variant="success" className="mb-4">{notice}</Banner> : null}
      {loading ? <SkeletonCard /> : null}

      {token && !loading ? (
        <>
          <Section title="Keyword alerts" className="mb-6">
            <Panel className="p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bell className="size-3.5" />
                Messages containing one of your keywords notify you, on top of mentions.
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {keywords.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No keywords yet.</span>
                ) : null}
                {keywords.map((keyword) => (
                  <span
                    key={keyword.word}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
                  >
                    {keyword.word}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove keyword ${keyword.word}`}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => removeNotificationKeyword(token, keyword.word),
                          `Removed “${keyword.word}”.`,
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  placeholder="deploy"
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  data-testid="keyword-input"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !keywordDraft.trim()}
                  onClick={() =>
                    void run(async () => {
                      await addNotificationKeyword(token, keywordDraft.trim());
                      setKeywordDraft("");
                    }, "Keyword added.")
                  }
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Add keyword
                </Button>
              </div>
            </Panel>
          </Section>

          <Section title="User groups" className="mb-6">
            <Panel className="p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                Mention a group with <code className="rounded bg-muted px-1">@group:name</code>;
                only members in the room are notified.
              </p>
              <ul className="mb-3 space-y-1">
                {groups.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No groups yet.</li>
                ) : null}
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">@group:{group.name}</span>
                    <span className="text-muted-foreground">
                      {group.memberIds.length} member{group.memberIds.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete group ${group.name}`}
                      disabled={busy}
                      onClick={() =>
                        void run(() => deleteUserGroup(token, group.id), `Deleted @group:${group.name}.`)
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  placeholder="design"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  data-testid="group-name-input"
                />
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  placeholder="user ids, comma separated"
                  value={groupMembers}
                  onChange={(e) => setGroupMembers(e.target.value)}
                  data-testid="group-members-input"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !groupName.trim()}
                  onClick={() =>
                    void run(async () => {
                      const memberIds = groupMembers
                        .split(",")
                        .map((id) => id.trim())
                        .filter(Boolean);
                      await createUserGroup(token, { name: groupName.trim(), memberIds });
                      setGroupName("");
                      setGroupMembers("");
                    }, "Group created.")
                  }
                >
                  Create group
                </Button>
              </div>
            </Panel>
          </Section>

          <Section title="Custom emoji">
            <Panel className="p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Smile className="size-3.5" />
                Render <code className="rounded bg-muted px-1">:name:</code> in messages and react
                with custom emoji. Images must be https URLs.
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                {emojis.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No custom emoji yet.</span>
                ) : null}
                {emojis.map((emoji) => (
                  <span
                    key={emoji.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs"
                  >
                    <img src={emoji.imageUrl} alt={`:${emoji.name}:`} className="size-4" />
                    :{emoji.name}:
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete emoji ${emoji.name}`}
                      disabled={busy}
                      onClick={() =>
                        void run(() => deleteCustomEmoji(token, emoji.id), `Deleted :${emoji.name}:.`)
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  placeholder="parrot"
                  value={emojiName}
                  onChange={(e) => setEmojiName(e.target.value)}
                  data-testid="emoji-name-input"
                />
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  placeholder="https://cdn.example/parrot.png"
                  value={emojiUrl}
                  onChange={(e) => setEmojiUrl(e.target.value)}
                  data-testid="emoji-url-input"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !emojiName.trim() || !emojiUrl.trim()}
                  onClick={() =>
                    void run(async () => {
                      await createCustomEmoji(token, {
                        name: emojiName.trim(),
                        imageUrl: emojiUrl.trim(),
                      });
                      setEmojiName("");
                      setEmojiUrl("");
                    }, "Custom emoji added.")
                  }
                >
                  Add emoji
                </Button>
              </div>
            </Panel>
          </Section>
        </>
      ) : null}
    </ConsoleShell>
  );
}
