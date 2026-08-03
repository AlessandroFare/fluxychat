"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Download, Loader2, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section, Textarea } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import { formatDateTime } from "@/lib/format-datetime";
import {
  createScimToken,
  deleteScimToken,
  deletePasskeyCredential,
  fetchSamlMetadata,
  finishPasskeyRegistration,
  getSamlConfig,
  listPasskeyCredentials,
  listScimTokens,
  saveSamlConfig,
  scimGroupsEndpoint,
  scimUsersEndpoint,
  startPasskeyRegistration,
  type PasskeyCredentialRow,
  type ScimTokenRow,
} from "@/lib/identity-client";
import { startRegistration } from "@simplewebauthn/browser";

export default function IdentitySettingsPage() {
  const { adminJwt, activeProject } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [idpEntityId, setIdpEntityId] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [idpCertificate, setIdpCertificate] = useState("");
  const [spEntityId, setSpEntityId] = useState("");
  const [spAcsUrl, setSpAcsUrl] = useState("");
  const [emailAttr, setEmailAttr] = useState("email");
  const [nameAttr, setNameAttr] = useState("displayName");
  const [samlConfigured, setSamlConfigured] = useState(false);

  const [scimTokens, setScimTokens] = useState<ScimTokenRow[]>([]);
  const [newTokenDesc, setNewTokenDesc] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);

  const [passkeys, setPasskeys] = useState<PasskeyCredentialRow[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const projectId = activeProject?.id ?? "";
  const scimUsersUrl = useMemo(() => (projectId ? scimUsersEndpoint(projectId) : ""), [projectId]);
  const scimGroupsUrl = useMemo(() => (projectId ? scimGroupsEndpoint(projectId) : ""), [projectId]);

  const loadAll = useCallback(async () => {
    if (!token) {
      setError("Sign in and select a project with an admin JWT from Projects or Onboarding.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [saml, scim, passkeyList] = await Promise.all([
        getSamlConfig(token),
        listScimTokens(token),
        listPasskeyCredentials(token).catch(() => ({ credentials: [] as PasskeyCredentialRow[] })),
      ]);
      setSamlConfigured(saml.configured);
      if (saml.configured) {
        setIdpEntityId(saml.idp_entity_id ?? "");
        setIdpSsoUrl(saml.idp_sso_url ?? "");
        setSpEntityId(saml.sp_entity_id ?? "");
        setSpAcsUrl(saml.sp_acs_url ?? "");
        setEmailAttr(saml.attribute_mapping?.email ?? "email");
        setNameAttr(saml.attribute_mapping?.name ?? "displayName");
      } else if (projectId) {
        setSpEntityId(`fluxychat-${projectId}`);
      }
      setScimTokens(scim.tokens ?? []);
      setPasskeys(passkeyList.credentials ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load identity settings"));
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleSaveSaml() {
    if (!token) return;
    if (!idpEntityId.trim() || !idpSsoUrl.trim() || !idpCertificate.trim() || !spAcsUrl.trim()) {
      setError("IdP entity ID, SSO URL, certificate, and SP ACS URL are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveSamlConfig(token, {
        idp_entity_id: idpEntityId.trim(),
        idp_sso_url: idpSsoUrl.trim(),
        idp_certificate: idpCertificate.trim(),
        sp_entity_id: spEntityId.trim() || undefined,
        sp_acs_url: spAcsUrl.trim(),
        attribute_mapping: { email: emailAttr.trim() || "email", name: nameAttr.trim() || "displayName" },
      });
      setSamlConfigured(true);
      setNotice("SAML configuration saved.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save SAML config"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadMetadata() {
    if (!token) return;
    setError(null);
    try {
      const xml = await fetchSamlMetadata(token);
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fluxychat-sp-metadata.xml";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(messageFromUnknown(err, "Save SAML config before downloading SP metadata"));
    }
  }

  async function handleCreateScimToken() {
    if (!token) return;
    setCreatingToken(true);
    setError(null);
    setCreatedToken(null);
    try {
      const result = await createScimToken(token, newTokenDesc.trim() || "SCIM provisioner");
      setCreatedToken(result.token);
      setNewTokenDesc("");
      await loadAll();
      setNotice("SCIM token created — copy it now; it will not be shown again.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create SCIM token"));
    } finally {
      setCreatingToken(false);
    }
  }

  async function handleDeleteScimToken(id: string) {
    if (!token || !confirm("Revoke this SCIM token? IdP provisioning with it will stop working.")) return;
    setError(null);
    try {
      await deleteScimToken(token, id);
      setNotice("SCIM token revoked.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to revoke SCIM token"));
    }
  }

  async function handleRegisterPasskey() {
    if (!token) return;
    setPasskeyBusy(true);
    setError(null);
    setNotice(null);
    try {
      const options = await startPasskeyRegistration(token);
      const attestation = await startRegistration({ optionsJSON: options });
      await finishPasskeyRegistration(token, attestation);
      setNotice("Passkey registered for this admin user.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Passkey registration failed"));
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function handleDeletePasskey(id: number) {
    if (!token || !confirm("Remove this passkey? You will need another sign-in method.")) return;
    setError(null);
    try {
      await deletePasskeyCredential(token, id);
      setNotice("Passkey removed.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to remove passkey"));
    }
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value);
    setNotice("Copied to clipboard.");
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Identity & access"
        description="Configure SAML SSO for your IdP and SCIM tokens for user provisioning."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/settings" className="font-medium underline-offset-4 hover:underline">
          ← Back to settings
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Open{" "}
          <Link href="/projects" className="font-medium underline-offset-2 hover:underline">
            Projects
          </Link>{" "}
          to paste an admin JWT, then return here.
        </Panel>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="SAML SSO">
            <p className="mb-4 text-sm text-muted-foreground">
              Map your identity provider to FluxyChat. After saving, download SP metadata for Okta, Azure AD, or Google Workspace.
            </p>
            {samlConfigured ? (
              <Badge variant="secondary" className="mb-4">Configured</Badge>
            ) : (
              <Badge variant="outline" className="mb-4">Not configured</Badge>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">IdP entity ID</span>
                <Input value={idpEntityId} onChange={(e) => setIdpEntityId(e.target.value)} placeholder="https://idp.example.com/entity" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">IdP SSO URL</span>
                <Input value={idpSsoUrl} onChange={(e) => setIdpSsoUrl(e.target.value)} placeholder="https://idp.example.com/sso" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">SP entity ID</span>
                <Input value={spEntityId} onChange={(e) => setSpEntityId(e.target.value)} placeholder={`fluxychat-${projectId || "project"}`} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">SP ACS URL</span>
                <Input value={spAcsUrl} onChange={(e) => setSpAcsUrl(e.target.value)} placeholder="https://your-worker/saml/acs" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Email attribute</span>
                <Input value={emailAttr} onChange={(e) => setEmailAttr(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Display name attribute</span>
                <Input value={nameAttr} onChange={(e) => setNameAttr(e.target.value)} />
              </label>
            </div>

            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">IdP X.509 certificate (PEM)</span>
              <Textarea
                value={idpCertificate}
                onChange={(e) => setIdpCertificate(e.target.value)}
                rows={6}
                placeholder="-----BEGIN CERTIFICATE-----"
                className="font-mono text-xs"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Required on every save. The certificate is not returned by the API after storage.
              </span>
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveSaml()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save SAML config
              </Button>
              <Button variant="outline" onClick={() => void handleDownloadMetadata()} disabled={!samlConfigured}>
                <Download className="mr-2 h-4 w-4" /> SP metadata
              </Button>
            </div>
          </Section>

          <Section title="SCIM provisioning">
            <p className="mb-4 text-sm text-muted-foreground">
              Create bearer tokens for your IdP SCIM app. Use the endpoints below with{" "}
              <code className="rounded bg-muted px-1 text-xs">Authorization: Bearer &lt;token&gt;</code>.
            </p>

            {projectId ? (
              <div className="mb-4 space-y-2 rounded-lg border border-black/[0.06] bg-white/80 p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">Users endpoint</p>
                    <code className="break-all text-xs text-muted-foreground">{scimUsersUrl}</code>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyText(scimUsersUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">Groups endpoint</p>
                    <code className="break-all text-xs text-muted-foreground">{scimGroupsUrl}</code>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyText(scimGroupsUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mb-4 text-sm text-amber-700">Select an active project to see SCIM endpoint URLs.</p>
            )}

            <div className="mb-4 flex flex-wrap items-end gap-2">
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium">Token description</span>
                <Input
                  value={newTokenDesc}
                  onChange={(e) => setNewTokenDesc(e.target.value)}
                  placeholder="Okta SCIM — production"
                />
              </label>
              <Button onClick={() => void handleCreateScimToken()} disabled={creatingToken}>
                {creatingToken ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create token
              </Button>
            </div>

            {createdToken ? (
              <Panel className="mb-4 border-amber-200 bg-amber-50/80 p-4">
                <p className="text-sm font-medium text-amber-900">New token (copy now)</p>
                <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs">{createdToken}</code>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => copyText(createdToken)}>
                  <Copy className="mr-2 h-3 w-3" /> Copy
                </Button>
              </Panel>
            ) : null}

            {scimTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">No SCIM tokens yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border border-black/[0.06] bg-white/90">
                {scimTokens.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.description || "SCIM token"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.scopes} · created {formatDateTime(row.created_at)}
                        {row.last_used_at ? ` · last used ${formatDateTime(row.last_used_at)}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-700" onClick={() => void handleDeleteScimToken(row.id)}>
                      <Trash2 className="mr-1 h-3 w-3" /> Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Passkeys (WebAuthn)">
            <p className="mb-4 text-sm text-muted-foreground">
              Register a passkey for the current admin JWT user. Sign-in with passkey uses{" "}
              <code className="rounded bg-muted px-1 text-xs">POST /webauthn/login/*</code> and your project API key.
              Set <code className="text-xs">WEBAUTHN_RP_ID</code> and <code className="text-xs">WEBAUTHN_ORIGIN</code> on the Worker for production.
            </p>
            <Button onClick={() => void handleRegisterPasskey()} disabled={passkeyBusy}>
              {passkeyBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add passkey
            </Button>
            {passkeys.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No passkeys registered for this user.</p>
            ) : (
              <ul className="mt-4 divide-y rounded-lg border border-black/[0.06] bg-white/90">
                {passkeys.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.deviceType || "Passkey"}</p>
                      <p className="text-xs text-muted-foreground">
                        Added {formatDateTime(row.createdAt)}
                        {row.lastUsedAt ? ` · last used ${formatDateTime(row.lastUsedAt)}` : ""}
                        {row.backedUp ? " · synced" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700"
                      onClick={() => void handleDeletePasskey(row.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
