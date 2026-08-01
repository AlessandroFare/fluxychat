"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useClerkUser } from "@/lib/clerk-user";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, Panel } from "../components/ui";
import { Input } from "~/components/ui/input";
import { UserStatusBadge } from "~/components/ui/user-status";
import { CustomStatusDialog } from "~/components/ui/custom-status-dialog";
import {
  Smile, Layout, MessagesSquare, Pencil, ArrowUpDown, Eye, EyeOff,
  Languages, Plus, Trash2, Globe, ArrowRightLeft, CheckCircle2, RotateCcw,
  Settings2,
} from "lucide-react";
import { getProfile, updateProfile } from "@/lib/user-profile-client";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createComposableUIKit,
  createTranslationService,
  type ComposerConfig, type ChannelListConfig,
  type ThreadViewConfig, type MessageListConfig,
} from "@fluxy-chat/sdk";

export default function SettingsPage() {
  const { user, isSignedIn } = useClerkUser();
  const { activeProject } = useDashboardSession();

  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const { user: clerkUser } = useClerkUser();
  const memberUserId = clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : null;

  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!token || !memberUserId) return;
    try {
      const profile = await getProfile(token, memberUserId);
      setStatusEmoji(profile.status_emoji);
      setStatusText(profile.status_text);
    } catch {}
  }, [token, memberUserId]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const handleSaveStatus = async (emoji: string | null, text: string | null) => {
    if (!token || !memberUserId) return;
    try {
      await updateProfile(token, memberUserId, {
        statusEmoji: emoji,
        statusText: text,
        statusExpiration: text ? Math.floor(Date.now() / 1000) + 86400 : null,
      });
      setStatusEmoji(emoji);
      setStatusText(text);
      setStatusError(null);
    } catch (err) {
      setStatusError(messageFromUnknown(err, "Failed to update status"));
    }
  };

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Settings"
        description="Account, project, notification preferences, UI Kit, and translation settings."
      />

      {!isSignedIn ? (
        <Banner variant="info">
          <Link href="/sign-in" className="font-medium underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to manage your account.
        </Banner>
      ) : null}

      {statusError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{statusError}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsCard
          title="Profile"
          description="Name, email, password, and connected accounts are managed by Clerk."
          cta={{ label: "Open profile →", href: "/profile" }}
        >
          {user ? (
            <p className="text-sm text-muted-foreground">
              Signed in as <strong>{user.fullName || user.username || user.id}</strong>
              {user.primaryEmailAddress ? <> · {user.primaryEmailAddress.emailAddress}</> : null}
            </p>
          ) : null}
        </SettingsCard>

        <SettingsCard
          title="Custom Status"
          description="Set an emoji and message to let others know what you're up to."
          cta={{ label: "", href: "" }}
        >
          <div className="flex items-center gap-3">
            <UserStatusBadge emoji={statusEmoji} text={statusText} className="text-xs px-2 py-1" />
            {!statusEmoji && !statusText && (
              <span className="text-xs text-muted-foreground">No status set</span>
            )}
            <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>
              <Smile className="h-3 w-3 mr-1" /> {statusEmoji || statusText ? "Update" : "Set status"}
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          title="API keys &amp; project"
          description={
            activeProject
              ? `Active project: ${activeProject.name}. Rotate or copy your API key here.`
              : "Create or pick a project to manage its API key and plan."
          }
          cta={{ label: "Open projects →", href: "/projects" }}
        />

        <SettingsCard
          title="Notifications"
          description="Per-room and per-event preferences. Mentions, DMs, quiet hours."
          cta={{ label: "Open notifications →", href: "/notifications" }}
        />

        <SettingsCard
          title="Identity &amp; access"
          description="SAML SSO for your IdP and SCIM tokens for automated user provisioning."
          cta={{ label: "Configure SAML / SCIM →", href: "/settings/identity" }}
        />

        <SettingsCard
          title="Retention &amp; legal hold"
          description="Message retention policies, legal holds, and chain-of-custody export snapshots."
          cta={{ label: "Open retention →", href: "/settings/retention" }}
        />

        <SettingsCard
          title="E-discovery"
          description="Legal cases, custodians, preservation orders, and evidence chain-of-custody."
          cta={{ label: "Open e-discovery →", href: "/ediscovery" }}
        />

        <SettingsCard
          title="DLP &amp; encryption keys"
          description="Custom DLP rules, PHI/PCI scan, policy versioning, and customer-managed keys."
          cta={{ label: "Configure DLP →", href: "/settings/dlp" }}
        />

        <SettingsCard
          title="HIPAA &amp; BAA"
          description="Business Associate Agreement tracking, readiness checklist, and PHI metrics."
          cta={{ label: "Open HIPAA →", href: "/settings/hipaa" }}
        />

        <SettingsCard
          title="SOC 2 evidence"
          description="Control dashboard, DLP smoke tests, audit log and evidence JSON export."
          cta={{ label: "Open SOC 2 →", href: "/soc2" }}
        />

        <SettingsCard
          title="MCP identity"
          description="MCP server registry, tool provenance, and tool-call audit log."
          cta={{ label: "Open MCP settings →", href: "/settings/mcp" }}
        />

        <SettingsCard
          title="Automation (Activepieces)"
          description="Embed no-code flows — FluxyChat webhooks as triggers, CRM connectors via Activepieces."
          cta={{ label: "Open integrations →", href: "/settings/integrations" }}
        />

        <SettingsCard
          title="CRM &amp; helpdesk"
          description="Salesforce, Zendesk, HubSpot, Intercom — sync contacts, tickets, and agent handoff."
          cta={{ label: "Configure CRM →", href: "/settings/crm" }}
        />

        <SettingsCard
          title="Danger zone"
          description="Delete a project, revoke API keys, force-expire sessions. These actions are irreversible."
          cta={{ label: "Open admin →", href: "/admin" }}
          danger
        />
      </div>

      {/* UI Kit Configurator */}
      <h2 className="mt-10 text-sm font-semibold">Composable UI Kit</h2>
      <p className="text-xs text-muted-foreground mb-4">Configure ChannelList, ThreadView, MessageList, and Composer defaults.</p>
      <UiKitConfigurator />

      {/* Translation Preferences */}
      <h2 className="mt-10 text-sm font-semibold">Translation Preferences</h2>
      <p className="text-xs text-muted-foreground mb-4">Set source/target language, auto-detect, and glossary terms for real-time translation.</p>
      <TranslationPreferences />

      <p className="mt-8 text-xs text-muted-foreground">
        Looking for something else? Check the{" "}
        <Link href="/docs" className="font-medium text-foreground underline-offset-4 hover:underline">
          docs
        </Link>{" "}
        or open the command palette with <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>.
      </p>

      <CustomStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        currentEmoji={statusEmoji}
        currentText={statusText}
        onSave={handleSaveStatus}
      />
    </ConsoleShell>
  );
}

/* ─── Settings Card ─── */

function SettingsCard(props: {
  title: string;
  description: string;
  cta: { label: string; href: string };
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={
        "rounded-2xl border bg-white/90 p-5 shadow-[var(--shadow-subtle-2)] " +
        (props.danger ? "border-red-200" : "border-black/[0.06]")
      }
    >
      <h2
        className={
          "font-heading text-base font-semibold " +
          (props.danger ? "text-red-700" : "text-slate-900")
        }
      >
        {props.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
      {props.children ? <div className="mt-3">{props.children}</div> : null}
      <Link
        href={props.cta.href}
        className={
          "mt-4 inline-flex text-sm font-medium underline-offset-4 hover:underline " +
          (props.danger ? "text-red-700" : "text-primary")
        }
      >
        {props.cta.label}
      </Link>
    </div>
  );
}

/* ─── UI Kit Configurator ─── */

function UiKitConfigurator() {
  const ui = useMemo(() => createComposableUIKit(), []);
  const [channelList, setChannelList] = useState<ChannelListConfig>(ui.getChannelListConfig());
  const [threadView, setThreadView] = useState<ThreadViewConfig>(ui.getThreadViewConfig());
  const [messageList, setMessageList] = useState<MessageListConfig>(ui.getMessageListConfig());
  const [composer, setComposer] = useState<ComposerConfig>(ui.getComposerConfig());
  const [saved, setSaved] = useState(false);

  function applyAll() {
    ui.setChannelListConfig(channelList);
    ui.setThreadViewConfig(threadView);
    ui.setMessageListConfig(messageList);
    ui.setComposerConfig(composer);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function resetAll() {
    const fresh = createComposableUIKit();
    setChannelList(fresh.getChannelListConfig());
    setThreadView(fresh.getThreadViewConfig());
    setMessageList(fresh.getMessageListConfig());
    setComposer(fresh.getComposerConfig());
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* ChannelList */}
      <Panel className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium"><Layout className="h-4 w-4 text-blue-500" /> ChannelList</h4>
        <div className="mt-3 space-y-2">
          <ToggleRow icon={Eye} label="Show unread" checked={channelList.showUnread} onChange={(v) => setChannelList((p) => ({ ...p, showUnread: v }))} />
          <ToggleRow icon={Eye} label="Show avatars" checked={channelList.showAvatars} onChange={(v) => setChannelList((p) => ({ ...p, showAvatars: v }))} />
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <select className="rounded-md border border-border bg-background px-2 py-1 text-xs" value={channelList.sortBy}
              onChange={(e) => setChannelList((p) => ({ ...p, sortBy: e.target.value as any }))}>
              <option value="name">Name</option>
              <option value="lastMessage">Last message</option>
              <option value="unread">Unread</option>
            </select>
          </div>
        </div>
      </Panel>

      {/* ThreadView */}
      <Panel className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium"><MessagesSquare className="h-4 w-4 text-emerald-500" /> ThreadView</h4>
        <div className="mt-3 space-y-2">
          <ToggleRow icon={Eye} label="Show replies" checked={threadView.showReplies} onChange={(v) => setThreadView((p) => ({ ...p, showReplies: v }))} />
          <ToggleRow icon={Eye} label="Show reactions" checked={threadView.showReactions} onChange={(v) => setThreadView((p) => ({ ...p, showReactions: v }))} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Reply order:</span>
            <select className="rounded-md border border-border bg-background px-2 py-1 text-xs" value={threadView.sortReplies}
              onChange={(e) => setThreadView((p) => ({ ...p, sortReplies: e.target.value as any }))}>
              <option value="asc">Oldest first</option>
              <option value="desc">Newest first</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Max depth:</span>
            <input type="number" className="w-16 rounded-md border border-border bg-background px-2 py-0.5 text-xs" value={threadView.maxThreadDepth}
              onChange={(e) => setThreadView((p) => ({ ...p, maxThreadDepth: parseInt(e.target.value) || 1 }))} />
          </div>
        </div>
      </Panel>

      {/* MessageList */}
      <Panel className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium"><MessagesSquare className="h-4 w-4 text-purple-500" /> MessageList</h4>
        <div className="mt-3 space-y-2">
          <ToggleRow icon={Eye} label="Show timestamps" checked={messageList.showTimestamps} onChange={(v) => setMessageList((p) => ({ ...p, showTimestamps: v }))} />
          <ToggleRow icon={Eye} label="Show avatars" checked={messageList.showAvatars} onChange={(v) => setMessageList((p) => ({ ...p, showAvatars: v }))} />
          <ToggleRow icon={Eye} label="Show reactions" checked={messageList.showReactions} onChange={(v) => setMessageList((p) => ({ ...p, showReactions: v }))} />
          <ToggleRow icon={Eye} label="Inline replies" checked={messageList.enableInlineReplies} onChange={(v) => setMessageList((p) => ({ ...p, enableInlineReplies: v }))} />
          <ToggleRow icon={Eye} label="Group by date" checked={messageList.groupByDate} onChange={(v) => setMessageList((p) => ({ ...p, groupByDate: v }))} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Max visible:</span>
            <input type="number" className="w-16 rounded-md border border-border bg-background px-2 py-0.5 text-xs" value={messageList.maxVisible}
              onChange={(e) => setMessageList((p) => ({ ...p, maxVisible: parseInt(e.target.value) || 1 }))} />
          </div>
        </div>
      </Panel>

      {/* Composer */}
      <Panel className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium"><Pencil className="h-4 w-4 text-amber-500" /> Composer</h4>
        <div className="mt-3 space-y-2">
          <ToggleRow icon={Eye} label="Enable mentions" checked={composer.enableMentions} onChange={(v) => setComposer((p) => ({ ...p, enableMentions: v }))} />
          <ToggleRow icon={Eye} label="Enable emoji" checked={composer.enableEmoji} onChange={(v) => setComposer((p) => ({ ...p, enableEmoji: v }))} />
          <ToggleRow icon={Eye} label="Enable attachments" checked={composer.enableAttachments} onChange={(v) => setComposer((p) => ({ ...p, enableAttachments: v }))} />
          <ToggleRow icon={Eye} label="Enable markdown" checked={composer.enableMarkdown} onChange={(v) => setComposer((p) => ({ ...p, enableMarkdown: v }))} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Max length:</span>
            <input type="number" className="w-20 rounded-md border border-border bg-background px-2 py-0.5 text-xs" value={composer.maxLength}
              onChange={(e) => setComposer((p) => ({ ...p, maxLength: parseInt(e.target.value) || 1 }))} />
          </div>
          <Input className="text-xs" value={composer.placeholder} onChange={(e) => setComposer((p) => ({ ...p, placeholder: e.target.value }))} placeholder="Placeholder text" />
        </div>
      </Panel>

      <div className="sm:col-span-2 flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={resetAll}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset defaults</Button>
        <Button size="sm" onClick={applyAll}>
          {saved ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Saved</> : <><Settings2 className="h-3.5 w-3.5 mr-1" /> Apply all</>}
        </Button>
      </div>

      <div className="sm:col-span-2 rounded-md border border-border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">
          <strong>8 registered components:</strong>{" "}
          {ui.getRegisteredComponents().map((c) => c.name).join(", ")}
        </p>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }: { icon: typeof Eye; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-0.5">
      <span className="flex items-center gap-1.5 text-xs">
        <Icon className={`h-3.5 w-3.5 ${checked ? "text-foreground" : "text-muted-foreground/50"}`} />
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

/* ─── Translation Preferences ─── */

function TranslationPreferences() {
  const ts = useMemo(() => createTranslationService(), []);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("it");
  const [autoDetect, setAutoDetect] = useState(true);
  const [glossarySource, setGlossarySource] = useState("");
  const [glossaryTarget, setGlossaryTarget] = useState("");
  const [glossary, setGlossary] = useState<Array<{ source: string; target: string }>>([]);
  const [saved, setSaved] = useState(false);

  const LANGUAGES = { en: "English", it: "Italian", fr: "French", de: "German", es: "Spanish", zh: "Chinese", ja: "Japanese", ar: "Arabic", ru: "Russian" };

  function savePreferences() {
    ts.setPreference({
      userId: "default-user",
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      autoDetect,
      glossaryTerms: glossary.map((g) => ({ source: g.source, target: g.target })),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium"><Globe className="h-4 w-4 text-blue-500" /> Language</h4>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Source:</span>
            <select className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20">Target:</span>
            <select className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs">Auto-detect language</span>
            <button
              role="switch"
              aria-checked={autoDetect}
              onClick={() => setAutoDetect(!autoDetect)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${autoDetect ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${autoDetect ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </Panel>

      <Panel className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium"><Languages className="h-4 w-4 text-amber-500" /> Glossary</h4>
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Source term" className="flex-1" value={glossarySource} onChange={(e) => setGlossarySource(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") {
                if (!glossarySource.trim() || !glossaryTarget.trim()) return;
                setGlossary((p) => [...p, { source: glossarySource.trim(), target: glossaryTarget.trim() }]);
                setGlossarySource(""); setGlossaryTarget("");
              }}} />
            <Input placeholder="Target term" className="flex-1" value={glossaryTarget} onChange={(e) => setGlossaryTarget(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") {
                if (!glossarySource.trim() || !glossaryTarget.trim()) return;
                setGlossary((p) => [...p, { source: glossarySource.trim(), target: glossaryTarget.trim() }]);
                setGlossarySource(""); setGlossaryTarget("");
              }}} />
          </div>
          <Button size="sm" variant="outline" className="w-full" onClick={() => {
            if (!glossarySource.trim() || !glossaryTarget.trim()) return;
            setGlossary((p) => [...p, { source: glossarySource.trim(), target: glossaryTarget.trim() }]);
            setGlossarySource(""); setGlossaryTarget("");
          }}><Plus className="h-3 w-3 mr-1" /> Add term</Button>

          {glossary.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {glossary.map((g, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2 py-1 text-xs">
                  <span>{g.source} <ArrowRightLeft className="h-3 w-3 inline text-muted-foreground" /> {g.target}</span>
                  <button onClick={() => setGlossary((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div className="sm:col-span-2 flex justify-end">
        <Button size="sm" onClick={savePreferences}>
          {saved ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Preferences saved</> : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
