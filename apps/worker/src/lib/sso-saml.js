import { sealSecretAtRest } from "./secrets-crypto.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// XMLDSig canonicalization. We support exclusive C14N 1.0 (the SAML
// 2.0 default). The algorithm is delegated to the `xml-c14n` library
// (no transitive deps, ~7KB). The XML parser is the runtime's built-
// in DOMParser  Cloudflare Workers, modern Node 18+, jsdom all
// expose one.
//
// Inclusive C14N (http://www.w3.org/TR/2001/REC-xml-c14n-20010315) is
// NOT implemented by xml-c14n@0.0.6  the library only ships the two
// exclusive variants. No major SAML 2.0 IdP (Okta, Azure AD, Auth0,
// OneLogin, Google Workspace, ADFS, PingFederate) emits inclusive
// C14N by default, so this gap is cosmetic for production traffic.
// If a custom IdP ever requires inclusive C14N, either:
//   (a) configure the IdP to emit exclusive C14N (recommended), or
//   (b) write an InclusiveC14n extension and register it via
//       c14nFactory.registerAlgorithm(uri, factoryFn)  see
//       https://github.com/deoxxa/xml-c14n#canonicalisationfactoryregisteralgorithm
// Track xml-c14n releases for native inclusive support.
import C14nFactory from "xml-c14n";

const c14nFactory = new C14nFactory();

function parseXmlDocument(xml) {
  if (typeof DOMParser === "function") {
    const parser = new DOMParser();
    return parser.parseFromString(xml, "application/xml");
  }
  // Node fallback: vitest runs under Node which has no DOMParser.
  // We lazy-require @xmldom/xmldom to avoid pulling it into the
  // production Worker bundle.
  // eslint-disable-next-line global-require
  const { DOMParser: NodeDOMParser } = require("@xmldom/xmldom");
  return new NodeDOMParser().parseFromString(xml, "application/xml");
}

function findSignedInfoNode(doc) {
  // Try with and without the ds: prefix.
  let el = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "SignedInfo")[0];
  if (el) return el;
  el = doc.getElementsByTagName("SignedInfo")[0];
  return el || null;
}

function canonicalizeSignedInfo(doc) {
  const node = findSignedInfoNode(doc);
  if (!node) return { ok: false, reason: "signedinfo_missing" };
  return new Promise((resolve) => {
    try {
      c14nFactory.createCanonicaliser(
        "http://www.w3.org/2001/10/xml-exc-c14n#",
      ).canonicalise(node, (err, result) => {
        if (err) return resolve({ ok: false, reason: "c14n_failed" });
        resolve({ ok: true, canonical: result, node });
      });
    } catch (err) {
      resolve({ ok: false, reason: "c14n_threw" });
    }
  });
}

// --- SAML Configurations ---

export async function createConfiguration(env, { projectId, name, idpEntityId, idpSsoUrl, idpSloUrl, idpCertificate, idpMetadataUrl, spEntityId, spAcsUrl, spSloUrl, spPrivateKey, spCertificate, nameIdFormat, signRequests, wantAssertionsSigned, wantResponseSigned, attributeMapping, enforceSso, defaultRole }) {
  const id = `sc_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_configurations (id, project_id, name, idp_entity_id, idp_sso_url, idp_slo_url, idp_certificate, idp_metadata_url, sp_entity_id, sp_acs_url, sp_slo_url, sp_private_key, sp_certificate, name_id_format, sign_requests, want_assertions_signed, want_response_signed, attribute_mapping, status, enforce_sso, default_role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  ).bind(id, projectId, name, idpEntityId, idpSsoUrl, idpSloUrl || null, idpCertificate, idpMetadataUrl || null, spEntityId, spAcsUrl, spSloUrl || null, spPrivateKey || null, spCertificate || null, nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", signRequests !== undefined ? (signRequests ? 1 : 0) : 1, wantAssertionsSigned !== undefined ? (wantAssertionsSigned ? 1 : 0) : 1, wantResponseSigned !== undefined ? (wantResponseSigned ? 1 : 0) : 1, JSON.stringify(attributeMapping || {}), enforceSso ? 1 : 0, defaultRole || "member", now, now).run();
  return { id };
}

export async function updateConfiguration(env, { configId, projectId, name, idpEntityId, idpSsoUrl, idpSloUrl, idpCertificate, idpMetadataUrl, spEntityId, spAcsUrl, spSloUrl, signRequests, wantAssertionsSigned, wantResponseSigned, attributeMapping, status, enforceSso, defaultRole }) {
  // Audit F-38: the project scope is mandatory — a caller that forgets it must
  // not be able to update another tenant's trust anchor (was optional).
  if (!configId || !projectId) return { updated: false, error: "project_required" };
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (name) { sets.push("name = ?"); params.push(name); }
  if (idpEntityId) { sets.push("idp_entity_id = ?"); params.push(idpEntityId); }
  if (idpSsoUrl) { sets.push("idp_sso_url = ?"); params.push(idpSsoUrl); }
  if (idpSloUrl !== undefined) { sets.push("idp_slo_url = ?"); params.push(idpSloUrl); }
  if (idpCertificate) { sets.push("idp_certificate = ?"); params.push(idpCertificate); }
  if (idpMetadataUrl !== undefined) { sets.push("idp_metadata_url = ?"); params.push(idpMetadataUrl); }
  if (spEntityId) { sets.push("sp_entity_id = ?"); params.push(spEntityId); }
  if (spAcsUrl) { sets.push("sp_acs_url = ?"); params.push(spAcsUrl); }
  if (spSloUrl !== undefined) { sets.push("sp_slo_url = ?"); params.push(spSloUrl); }
  if (signRequests !== undefined) { sets.push("sign_requests = ?"); params.push(signRequests ? 1 : 0); }
  if (wantAssertionsSigned !== undefined) { sets.push("want_assertions_signed = ?"); params.push(wantAssertionsSigned ? 1 : 0); }
  if (wantResponseSigned !== undefined) { sets.push("want_response_signed = ?"); params.push(wantResponseSigned ? 1 : 0); }
  if (attributeMapping) { sets.push("attribute_mapping = ?"); params.push(JSON.stringify(attributeMapping)); }
  if (status) { sets.push("status = ?"); params.push(status); }
  if (enforceSso !== undefined) { sets.push("enforce_sso = ?"); params.push(enforceSso ? 1 : 0); }
  if (defaultRole) { sets.push("default_role = ?"); params.push(defaultRole); }
  params.push(configId);
  params.push(projectId);
  const where = "WHERE id = ? AND project_id = ?";
  await env.DB.prepare(`UPDATE saml_configurations SET ${sets.join(", ")} ${where}`).bind(...params).run();
  return { updated: true };
}

export async function getConfiguration(env, { configId, projectId }) {
  // Audit F-38: mandatory project scope.
  if (!projectId) return null;
  const sql = "SELECT * FROM saml_configurations WHERE id = ? AND project_id = ?";
  const row = await env.DB.prepare(sql).bind(configId, projectId).first();
  return row ? mapConfigRow(row) : null;
}

export async function listConfigurations(env, { projectId, status }) {
  let sql = "SELECT * FROM saml_configurations WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY name";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapConfigRow);
}

export async function deleteConfiguration(env, { configId, projectId }) {
  // Audit F-38: mandatory project scope.
  if (!configId || !projectId) return { deleted: 0, error: "project_required" };
  const result = await env.DB.prepare(
    "DELETE FROM saml_configurations WHERE id = ? AND project_id = ?",
  ).bind(configId, projectId).run();
  return { deleted: result.meta?.changes || 0 };
}

// --- Sessions ---

export async function createSession(env, { projectId, configurationId, userId, nameId, nameIdFormat, sessionIndex, attributes, ipAddress, userAgent, expiresAt }) {
  const id = `ss_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_sessions (id, project_id, configuration_id, user_id, name_id, name_id_format, session_index, attributes, ip_address, user_agent, created_at, expires_at, last_accessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, configurationId, userId, nameId, nameIdFormat || null, sessionIndex || null, attributes ? JSON.stringify(attributes) : null, ipAddress || null, userAgent || null, now, expiresAt || null, now).run();
  return { id };
}

export async function getSession(env, { sessionId, projectId }) {
  let sql = "SELECT * FROM saml_sessions WHERE id = ?";
  const params = [sessionId];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  const row = await env.DB.prepare(sql).bind(...params).first();
  return row ? mapSessionRow(row) : null;
}

export async function touchSession(env, { sessionId, projectId }) {
  const now = new Date().toISOString();
  let sql = "UPDATE saml_sessions SET last_accessed_at = ? WHERE id = ?";
  const params = [now, sessionId];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  await env.DB.prepare(sql).bind(...params).run();
  return { touched: true };
}

export async function invalidateSession(env, { sessionId, projectId }) {
  let sql = "DELETE FROM saml_sessions WHERE id = ?";
  const params = [sessionId];
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  const result = await env.DB.prepare(sql).bind(...params).run();
  return { invalidated: result.meta?.changes || 0 };
}

export async function invalidateUserSessions(env, { projectId, userId }) {
  const result = await env.DB.prepare("DELETE FROM saml_sessions WHERE project_id = ? AND user_id = ?").bind(projectId, userId).run();
  return { invalidated: result.meta?.changes || 0 };
}

export async function listSessions(env, { projectId, userId, limit = 25 }) {
  let sql = "SELECT * FROM saml_sessions WHERE project_id = ?";
  const params = [projectId];
  if (userId) { sql += " AND user_id = ?"; params.push(userId); }
  sql += " ORDER BY last_accessed_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapSessionRow);
}

// --- JIT Provisioning ---

export async function provisionUser(env, { projectId, configurationId, userId, nameId, email, name, attributes }) {
  const id = `sj_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_jit_provisioning (id, project_id, configuration_id, user_id, name_id, email, name, attributes, provisioned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, configurationId, userId, nameId, email || null, name || null, attributes ? JSON.stringify(attributes) : null, now).run();
  return { id };
}

export async function listProvisionedUsers(env, { projectId, limit = 50 }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM saml_jit_provisioning WHERE project_id = ? ORDER BY provisioned_at DESC LIMIT ?"
  ).bind(projectId, limit).all();
  return (rows.results || []).map(mapJITRow);
}

// --- Audit ---

export async function logAuditEvent(env, { projectId, configurationId, eventType, userId, nameId, ipAddress, userAgent, details }) {
  const id = `sa_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO saml_audit_log (id, project_id, configuration_id, event_type, user_id, name_id, ip_address, user_agent, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, configurationId || null, eventType, userId || null, nameId || null, ipAddress || null, userAgent || null, details ? JSON.stringify(details) : null, now).run();
  return { id };
}

export async function listAuditLog(env, { projectId, eventType, userId, limit = 50 }) {
  let sql = "SELECT * FROM saml_audit_log WHERE project_id = ?";
  const params = [projectId];
  if (eventType) { sql += " AND event_type = ?"; params.push(eventType); }
  if (userId) { sql += " AND user_id = ?"; params.push(userId); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAuditRow);
}

// --- Stats ---

export async function getSSOStats(env, { projectId }) {
  const configs = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM saml_configurations WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const sessions = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM saml_sessions WHERE project_id = ? AND (expires_at IS NULL OR expires_at > ?)"
  ).bind(projectId, new Date().toISOString()).first();

  const recentLogins = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM saml_audit_log WHERE project_id = ? AND event_type = 'login_success' AND created_at >= ?"
  ).bind(projectId, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).first();

  return {
    configurations: (configs.results || []).map((c) => ({ status: c.status, count: c.count })),
    activeSessions: sessions?.count || 0,
    recentLogins: recentLogins?.count || 0,
  };
}

// --- Helpers ---

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Epoch seconds. Accepts the epoch-seconds numbers older callers pass and the
 * ISO strings `parseSamlAssertion` extracts from the XML. */
function toEpochSeconds(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

/** Validate SAML assertion NotBefore / NotOnOrAfter with clock skew (seconds). */
export function validateSamlTiming(assertion, clockSkewSec = 300) {
  const now = Math.floor(Date.now() / 1000);
  if (assertion.notBefore != null) {
    const notBefore = toEpochSeconds(assertion.notBefore);
    // Audit fix A2a: epoch-vs-ISO comparison was always false (NaN), so
    // expired/not-yet-valid assertions passed. Fail closed on garbage too.
    if (notBefore == null) return { valid: false, reason: "assertion notBefore invalid" };
    if (now + clockSkewSec < notBefore) {
      return { valid: false, reason: "assertion not yet valid" };
    }
  }
  if (assertion.notOnOrAfter != null) {
    const notOnOrAfter = toEpochSeconds(assertion.notOnOrAfter);
    if (notOnOrAfter == null) return { valid: false, reason: "assertion notOnOrAfter invalid" };
    if (now - clockSkewSec > notOnOrAfter) {
      return { valid: false, reason: "assertion expired" };
    }
  }
  return { valid: true };
}

/**
 * Audit #16 + F-28: validate the assertion's AudienceRestriction against the SP
 * entityID and the SubjectConfirmationData Recipient against the configured ACS
 * URL. Prevents a validly-signed assertion minted for a different SP from being
 * replayed here (audience confusion / token reuse).
 *
 * Fail-closed (audit F-28): when the SP configures an audience/ACS, a response
 * WITHOUT them is rejected too — a missing claim is a mismatch, not a pass.
 */
export function validateSamlAudience(assertion, config) {
  const expectedAudience = config?.spEntityId;
  if (expectedAudience) {
    const audiences =
      assertion.audience == null
        ? []
        : Array.isArray(assertion.audience)
          ? assertion.audience
          : [assertion.audience];
    if (!audiences.includes(expectedAudience)) {
      return { valid: false, reason: "audience_mismatch" };
    }
  }
  if (config?.spAcsUrl && assertion.recipient !== config.spAcsUrl) {
    return { valid: false, reason: "recipient_mismatch" };
  }
  return { valid: true };
}

/** Generate SAML SP metadata XML for IdP configuration. */
export function generateSpMetadata(entityId, acsUrl) {
  const eid = escapeXml(entityId);
  const acs = escapeXml(acsUrl);
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${eid}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

// --- XMLDSig verification helpers (S-21 follow-up) ---
//
// SAML 2.0 responses are signed with XMLDSig. To verify, we:
//   1. Parse the response with the runtime's built-in DOMParser
//      (Cloudflare Workers, modern Node 18+, jsdom).
//   2. Locate the <ds:SignedInfo> node.
//   3. Apply the canonicalization algorithm declared in
//      <ds:CanonicalizationMethod Algorithm="…">  currently
//      exclusive C14N (http://www.w3.org/2001/10/xml-exc-c14n#).
//   4. SHA-256 the canonical bytes and verify the IdP's RSA signature.
//   5. Optionally: hash the referenced element per the <ds:Reference>
//      and compare to <ds:DigestValue>.
//
// The byte-range-hash shortcut (pre-c14n-library) is gone. We now
// honour whatever c14n the IdP declares, so operators don't have to
// choose an IdP that emits inclusive C14N  exclusive C14N with
// arbitrary whitespace is verified correctly.
//
// The c14n algorithm itself comes from `xml-c14n` (7KB unpacked, no
// dependencies, MIT-compatible). The XML parser is provided by the
// runtime  we do not bundle one to keep the Workers script budget
// well under 1MB.

/**
 * Decode a SAML response body. HTTP-POST transports the response as
 * base64-encoded XML; some clients also send the raw XML directly.
 */
function decodeSamlResponse(encodedResponse) {
  // Try base64 first if the string looks like base64 (no angle brackets)
  if (encodedResponse.indexOf("<") === -1) {
    try {
      // atob is available in Workers; for tests run under Node 18+ it's
      // also available globally. Use Buffer as a Node fallback.
      const decoded = typeof atob === "function"
        ? atob(encodedResponse)
        : Buffer.from(encodedResponse, "base64").toString("utf8");
      return decoded;
    } catch {
      return null;
    }
  }
  return encodedResponse;
}

/**
 * Strip PEM armour and return raw DER bytes. Works for both
 * "-----BEGIN CERTIFICATE-----" and bare base64.
 */
function pemToDerBytes(pem) {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (typeof atob === "function") {
    const bin = atob(stripped);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(stripped, "base64"));
}

/**
 * Extract the byte range of the FIRST <ds:Signature> element AND the
 * byte range of its inner <ds:SignedInfo> element from the raw XML
 * string. Returns null if not found.
 */
function findSignatureByteRanges(xml) {
  const sigStart = xml.indexOf("<ds:Signature");
  if (sigStart === -1) {
    // try without namespace prefix
    const alt = xml.indexOf("<Signature");
    if (alt === -1) return null;
    return findSignatureByteRangesFrom(xml, alt);
  }
  return findSignatureByteRangesFrom(xml, sigStart);
}

function findSignatureByteRangesFrom(xml, startIdx) {
  // The element ends at the matching </ds:Signature> (or </Signature>)
  // We deliberately do NOT handle nested <Signature> elements because
  // that is not a valid SAML 2.0 response shape.
  const tagEnd = xml.indexOf(">", startIdx);
  if (tagEnd === -1) return null;
  const tagName = xml.slice(startIdx + 1, tagEnd).split(/\s/)[0];
  const closeTag = `</${tagName}>`;
  const sigEnd = xml.indexOf(closeTag, tagEnd);
  if (sigEnd === -1) return null;
  const sigEndIdx = sigEnd + closeTag.length;

  // Within the Signature element, find SignedInfo
  const sigBody = xml.slice(tagEnd + 1, sigEnd);
  const siStart = sigBody.indexOf("<ds:SignedInfo");
  const siStartAlt = sigBody.indexOf("<SignedInfo");
  const useSiStart = siStart !== -1 ? siStart : siStartAlt;
  if (useSiStart === -1) return null;
  const siTagName = siStart !== -1 ? "ds:SignedInfo" : "SignedInfo";
  const siOpenEnd = sigBody.indexOf(">", useSiStart);
  if (siOpenEnd === -1) return null;
  const siCloseTag = `</${siTagName}>`;
  const siCloseStart = sigBody.indexOf(siCloseTag, siOpenEnd);
  if (siCloseStart === -1) return null;
  const siEnd = siCloseStart + siCloseTag.length;

  // Translate SignedInfo indexes back to the original xml coordinate
  // system.
  const siGlobalStart = tagEnd + 1 + useSiStart;
  const siGlobalEnd = tagEnd + 1 + siEnd;

  return {
    signatureStart: startIdx,
    signatureEnd: sigEndIdx,
    signedInfoStart: siGlobalStart,
    signedInfoEnd: siGlobalEnd,
  };
}

function extractCanonicalizationMethod(xml) {
  const m = xml.match(/<ds:CanonicalizationMethod[^>]*Algorithm="([^"]+)"/);
  if (m) return m[1];
  const m2 = xml.match(/<CanonicalizationMethod[^>]*Algorithm="([^"]+)"/);
  return m2 ? m2[1] : null;
}

function extractSignatureMethod(xml) {
  const m = xml.match(/<ds:SignatureMethod[^>]*Algorithm="([^"]+)"/);
  if (m) return m[1];
  const m2 = xml.match(/<SignatureMethod[^>]*Algorithm="([^"]+)"/);
  return m2 ? m2[1] : null;
}

// --- DOM claim extraction (audit S-21 residual) ---
//
// Identity claims are read ONLY from the digest-verified DOM node: DOM queries
// cannot see comments, CDATA sections or processing instructions, which the
// digest canonicalization drops — a regex over the raw markup could (XML
// Signature Wrapping via injected comments/CDATA).

function localNameOf(el) {
  const name = String(el?.nodeName || "");
  const i = name.indexOf(":");
  return i === -1 ? name : name.slice(i + 1);
}

function collectDescendantsByLocalName(node, name) {
  const out = [];
  if (!node?.getElementsByTagName) return out;
  const all = node.getElementsByTagName("*");
  for (let i = 0; i < all.length; i += 1) {
    if (localNameOf(all[i]) === name) out.push(all[i]);
  }
  return out;
}

function firstDescendantByLocalName(node, name) {
  const found = collectDescendantsByLocalName(node, name);
  return found.length ? found[0] : null;
}

// Audit F-38: claims are read by structure (direct children along the SAML
// schema path), not "first descendant with this name" — wrappers such as
// <Advice> or <Extensions> sit inside the signed element for some IdPs, and a
// descendant scan can latch onto a decoy nested there.
function directChildrenByLocalName(node, name) {
  const out = [];
  const children = node?.childNodes || [];
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.nodeType === 1 && localNameOf(child) === name) out.push(child);
  }
  return out;
}

function firstDirectChildByLocalName(node, name) {
  const found = directChildrenByLocalName(node, name);
  return found.length ? found[0] : null;
}

/**
 * Resolve the <Assertion> the digest-verified node is about: the node itself,
 * or the single direct-child Assertion of a <Response>. Zero or several
 * assertions make the response ambiguous — fail closed.
 */
function assertionNodeFor(node) {
  if (!node) return null;
  if (localNameOf(node) === "Assertion") return node;
  const direct = directChildrenByLocalName(node, "Assertion");
  return direct.length === 1 ? direct[0] : null;
}

function extractIssuerAndNameIdFromNode(assertionNode) {
  const issuerEl = firstDirectChildByLocalName(assertionNode, "Issuer");
  const subjectEl = firstDirectChildByLocalName(assertionNode, "Subject");
  const nameIdEl = subjectEl ? firstDirectChildByLocalName(subjectEl, "NameID") : null;
  const conditionsEl = firstDirectChildByLocalName(assertionNode, "Conditions");
  let notBefore = null;
  let notOnOrAfter = null;
  if (conditionsEl?.getAttribute) {
    notBefore = conditionsEl.getAttribute("NotBefore") || null;
    notOnOrAfter = conditionsEl.getAttribute("NotOnOrAfter") || null;
  }
  return {
    issuer: issuerEl?.textContent ? issuerEl.textContent.trim() : null,
    nameId: nameIdEl?.textContent ? nameIdEl.textContent.trim() : null,
    notBefore,
    notOnOrAfter,
  };
}

function extractAudienceAndRecipientFromNode(assertionNode) {
  const conditionsEl = firstDirectChildByLocalName(assertionNode, "Conditions");
  const audienceRestriction = conditionsEl
    ? firstDirectChildByLocalName(conditionsEl, "AudienceRestriction")
    : null;
  const audiences = audienceRestriction
    ? directChildrenByLocalName(audienceRestriction, "Audience")
        .map((el) => String(el.textContent || "").trim())
        .filter(Boolean)
    : [];
  const subjectEl = firstDirectChildByLocalName(assertionNode, "Subject");
  const subjectConfirmation = subjectEl
    ? firstDirectChildByLocalName(subjectEl, "SubjectConfirmation")
    : null;
  const confirmationData = subjectConfirmation
    ? firstDirectChildByLocalName(subjectConfirmation, "SubjectConfirmationData")
    : null;
  const recipient = confirmationData?.getAttribute
    ? confirmationData.getAttribute("Recipient")
    : null;
  return {
    audience: audiences.length ? (audiences.length === 1 ? audiences[0] : audiences) : null,
    recipient: recipient || null,
  };
}

function extractAttributesFromNode(assertionNode) {
  const attrs = {};
  for (const statement of directChildrenByLocalName(assertionNode, "AttributeStatement")) {
    for (const el of directChildrenByLocalName(statement, "Attribute")) {
      const name = el.getAttribute
        ? el.getAttribute("Name") || el.getAttribute("NameFormat")
        : null;
      if (!name) continue;
      const values = directChildrenByLocalName(el, "AttributeValue").map(
        (v) => String(v.textContent ?? ""),
      );
      attrs[name] = values.length === 1 ? values[0] : values;
    }
  }
  return attrs;
}

/** Walk up from the SignedInfo node to its containing <ds:Signature> element. */
function signatureElementForSignedInfo(signedInfoNode) {
  let el = signedInfoNode?.parentNode || null;
  while (el && localNameOf(el) !== "Signature") el = el.parentNode || null;
  return el;
}

/**
 * Audit F-21: Reference URI/DigestValue/Transforms MUST come from the
 * SignedInfo DOM node whose signature was verified — regexing the raw XML
 * lets an attacker prepend a decoy <Reference> and have the digest check
 * pass over attacker-chosen content (XML Signature Wrapping).
 */
function extractReferenceFromSignedInfo(signedInfoNode) {
  const refEl = firstDescendantByLocalName(signedInfoNode, "Reference");
  if (!refEl) return null;
  const digestEl = firstDescendantByLocalName(refEl, "DigestValue");
  const digest = digestEl ? String(digestEl.textContent || "").replace(/\s+/g, "") : null;
  const transforms = collectDescendantsByLocalName(refEl, "Transform")
    .map((t) => (t.getAttribute ? t.getAttribute("Algorithm") || "" : ""))
    .filter(Boolean);
  const uri = refEl.getAttribute ? refEl.getAttribute("URI") : null;
  return { uri, digest, transforms };
}

function canonicalizeNodeExclusive(node) {
  return new Promise((resolve) => {
    try {
      c14nFactory
        .createCanonicaliser("http://www.w3.org/2001/10/xml-exc-c14n#")
        .canonicalise(node, (err, result) => resolve(err ? null : result));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Audit CRITICAL #6 + S-21 residual (XML Signature Wrapping): verify that the
 * <ds:Reference DigestValue> equals the SHA-256 of the referenced element as
 * the IdP digested it — applying the declared enveloped-signature transform
 * (strip the embedded <ds:Signature>) before exclusive C14N. Returns
 * {ok, reason, node} where `node` is the digest-verified DOM element; claims
 * MUST be read from that node via DOM queries only (comments/CDATA are not
 * part of the digested node and must never reach claim extraction).
 */
async function verifyReferenceDigest(parsedDoc, refId, declaredDigestB64, transforms = []) {
  if (!declaredDigestB64) return { ok: false, reason: "digest_value_missing" };
  // Locate the element whose Id/ID/wsu:Id == refId. A document may legally
  // carry the attribute on several element kinds, but the id must be unique:
  // duplicate ids are the classic XML Signature Wrapping setup and make the
  // reference ambiguous, so fail closed instead of guessing.
  let node = null;
  let matches = 0;
  const all = parsedDoc.getElementsByTagName("*");
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i];
    const idAttr =
      (el.getAttribute && (el.getAttribute("ID") || el.getAttribute("Id") || el.getAttribute("wsu:Id")));
    if (idAttr && idAttr === refId) {
      if (!node) node = el;
      matches += 1;
    }
  }
  if (!node) return { ok: false, reason: "referenced_element_not_found" };
  if (matches > 1) return { ok: false, reason: "reference_id_ambiguous" };

  let digestNode = node;
  if (transforms.some((a) => /xmldsig#enveloped-signature$/i.test(a))) {
    // The IdP excluded the signature element from the digest (the common
    // assertion-signed layout): rebuild that view before canonicalizing.
    digestNode = node.cloneNode(true);
    const descendants = digestNode.getElementsByTagName("*");
    const signatures = [];
    for (let i = 0; i < descendants.length; i += 1) {
      if (localNameOf(descendants[i]) === "Signature") signatures.push(descendants[i]);
    }
    for (const sig of signatures) sig.parentNode?.removeChild(sig);
  }

  const canonical = await canonicalizeNodeExclusive(digestNode);
  if (canonical == null) return { ok: false, reason: "reference_c14n_failed" };

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const computedB64 = (typeof btoa === "function")
    ? btoa(String.fromCharCode(...new Uint8Array(digest)))
    : Buffer.from(new Uint8Array(digest)).toString("base64");
  if (computedB64 !== declaredDigestB64) return { ok: false, reason: "digest_mismatch" };
  return { ok: true, node };
}

/**
 * Verify a SAML 2.0 response's XMLDSig signature using the configured
 * IdP certificate. Returns `{ isValid, reason, issuer, nameId,
 * notBefore, notOnOrAfter, attributes }`.
 *
 * `encodedResponse` may be the base64-encoded XML (HTTP-POST) or the
 * raw XML. `config` is the row from `saml_configurations` mapped
 * through `mapConfigRow`.
 */
export async function parseSamlAssertion(encodedResponse, config) {
  if (!encodedResponse || typeof encodedResponse !== "string") {
    return { isValid: false, reason: "missing_saml_response", issuer: null };
  }
  if (!config || !config.idpEntityId) {
    return { isValid: false, reason: "saml_not_configured", issuer: null };
  }
  if (!config.idpCertificate || typeof config.idpCertificate !== "string") {
    return { isValid: false, reason: "idp_certificate_missing", issuer: config.idpEntityId };
  }

  const xml = decodeSamlResponse(encodedResponse);
  if (!xml || xml.indexOf("<") === -1) {
    return { isValid: false, reason: "saml_response_not_xml", issuer: config.idpEntityId };
  }

  // Locate the signature and SignedInfo byte ranges
  const ranges = findSignatureByteRanges(xml);
  if (!ranges) {
    return { isValid: false, reason: "signature_missing", issuer: config.idpEntityId };
  }
  const sigAlg = extractSignatureMethod(xml);
  const c14nAlg = extractCanonicalizationMethod(xml);
  // We currently support RSA-SHA256 only (the SAML 2.0 default). Other
  // algorithms are rejected with a clear reason so operators know
  // exactly what to configure.
  if (sigAlg && !/rsa-sha(1|256|384|512)$/i.test(sigAlg) && !/^http:\/\/www\.w3\.org\/2001\/04\/xmldsig-more#rsa-(sha1|sha256|sha384|sha512)$/i.test(sigAlg)) {
    return { isValid: false, reason: `unsupported_signature_method:${sigAlg}`, issuer: config.idpEntityId };
  }
  // Document the c14n we hashed against so operators can correlate
  // false negatives with IdP settings.
  if (c14nAlg && !/c14n/i.test(c14nAlg)) {
    return { isValid: false, reason: `unsupported_canonicalization:${c14nAlg}`, issuer: config.idpEntityId };
  }

  // Parse the response with a DOM parser and canonicalize SignedInfo
  // per the algorithm declared in the response. This is the proper
  // XMLDSig verification path  see the top-of-file comment.
  let parsedDoc;
  try {
    parsedDoc = parseXmlDocument(xml);
  } catch (err) {
    return { isValid: false, reason: "xml_parse_failed", issuer: config.idpEntityId };
  }
  const c14nResult = await canonicalizeSignedInfo(parsedDoc);
  if (!c14nResult.ok) {
    return { isValid: false, reason: c14nResult.reason, issuer: config.idpEntityId };
  }
  // Audit F-21: bind the SignatureValue to the SAME <ds:Signature> element that
  // contains the SignedInfo being verified (DOM, not raw-XML first match), so
  // the signature we check and the Reference we digest can never diverge.
  const sigElement = signatureElementForSignedInfo(c14nResult.node);
  if (!sigElement) {
    return { isValid: false, reason: "signature_missing", issuer: config.idpEntityId };
  }
  const sigValueEl = firstDescendantByLocalName(sigElement, "SignatureValue");
  const sigValueB64 = sigValueEl
    ? String(sigValueEl.textContent || "").replace(/\s+/g, "")
    : null;
  if (!sigValueB64) {
    return { isValid: false, reason: "signature_value_missing", issuer: config.idpEntityId };
  }
  const signedInfoBytes = new TextEncoder().encode(c14nResult.canonical);

  // Import the IdP public key
  let publicKey;
  try {
    const derBytes = pemToDerBytes(config.idpCertificate);
    publicKey = await crypto.subtle.importKey(
      "spki",
      derBytes,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch (err) {
    return {
      isValid: false,
      reason: "idp_certificate_import_failed",
      issuer: config.idpEntityId,
    };
  }

  // Decode the SignatureValue base64
  let sigBytes;
  try {
    const bin = typeof atob === "function"
      ? atob(sigValueB64)
      : Buffer.from(sigValueB64, "base64").toString("binary");
    sigBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) sigBytes[i] = bin.charCodeAt(i);
  } catch {
    return { isValid: false, reason: "signature_value_decode_failed", issuer: config.idpEntityId };
  }

  // Verify the canonicalized SignedInfo signature
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      publicKey,
      sigBytes,
      signedInfoBytes,
    );
  } catch {
    ok = false;
  }
  if (!ok) {
    return {
      isValid: false,
      reason: "signature_invalid",
      issuer: config.idpEntityId,
      _c14n: c14nAlg,
      _sigAlg: sigAlg,
    };
  }

  // Audit CRITICAL #6 + S-21 residual: enforce want_assertions_signed by
  // independently verifying the Reference digest over the referenced element.
  // SignedInfo being valid only proves the IdP signed *something*; without
  // checking the digest of the referenced node an attacker can wrap a signed
  // assertion and inject an unsigned one (XML Signature Wrapping). Identity
  // claims are read ONLY from the digest-verified DOM node, via DOM queries:
  // text regexes would also see comments/CDATA the digest never covered.
  const refInfo = extractReferenceFromSignedInfo(c14nResult.node);
  const refUri = refInfo?.uri || null;
  if (!refUri || !refUri.startsWith("#")) {
    return {
      isValid: false,
      reason: "assertion_reference_missing",
      issuer: config.idpEntityId,
    };
  }
  const refId = refUri.slice(1);
  const declaredDigest = refInfo.digest;
  const digestResult = await verifyReferenceDigest(
    parsedDoc,
    refId,
    declaredDigest,
    refInfo.transforms,
  );
  if (!digestResult.ok) {
    return {
      isValid: false,
      reason: `reference_digest_${digestResult.reason}`,
      issuer: config.idpEntityId,
    };
  }
  const signedNode = digestResult.node;

  // Audit F-38: bind claims to the (single) Assertion — a response-signed
  // layout otherwise lets claims resolve from Response-level wrappers.
  const assertionNode = assertionNodeFor(signedNode);
  if (!assertionNode) {
    return {
      isValid: false,
      reason: "assertion_not_found",
      issuer: config.idpEntityId,
    };
  }

  // Audit F-27: this SP never emits an AuthnRequest (IdP-initiated only), so a
  // Response carrying InResponseTo answers a request we did not send — reject.
  const inResponseTo =
    parsedDoc?.documentElement?.getAttribute?.("InResponseTo") || null;
  if (inResponseTo) {
    return {
      isValid: false,
      reason: "in_response_to_mismatch",
      issuer: config.idpEntityId,
    };
  }

  // Extract identity claims from the digest-verified Assertion (DOM only).
  const claims = extractIssuerAndNameIdFromNode(assertionNode);
  const audienceInfo = extractAudienceAndRecipientFromNode(assertionNode);
  if (claims.issuer !== config.idpEntityId) {
    return {
      isValid: false,
      reason: "issuer_mismatch",
      issuer: claims.issuer,
    };
  }
  if (!claims.nameId) {
    return { isValid: false, reason: "name_id_missing", issuer: claims.issuer };
  }
  const attributes = extractAttributesFromNode(assertionNode);

  return {
    isValid: true,
    reason: null,
    issuer: claims.issuer,
    nameId: claims.nameId,
    // Audit F-27: assertion ID is the replay-protection key (must be unique).
    assertionId:
      assertionNode?.getAttribute?.("ID") || assertionNode?.getAttribute?.("Id") || null,
    inResponseTo,
    notBefore: claims.notBefore,
    notOnOrAfter: claims.notOnOrAfter,
    audience: audienceInfo.audience,
    recipient: audienceInfo.recipient,
    attributes,
    _c14n: c14nAlg,
    _sigAlg: sigAlg,
  };
}

/**
 * Audit F-27: one-time consumption of a verified SAML assertion. Returns
 * { ok: false, reason: "assertion_replayed" } when the same assertion ID was
 * already used for this project (or is missing).
 */
export async function recordSamlAssertionUse(env, { projectId, assertionId, notOnOrAfter }) {
  if (!assertionId) return { ok: false, reason: "assertion_id_missing" };
  const expiryMs = notOnOrAfter ? Date.parse(notOnOrAfter) : NaN;
  // Keep the row until the assertion itself expires (+ clock skew already
  // applied by the timing check); fall back to a bounded window.
  const expiresAt = new Date(
    (Number.isNaN(expiryMs) ? Date.now() + 8 * 3600 * 1000 : expiryMs + 5 * 60 * 1000),
  ).toISOString();
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO saml_used_assertions (id, project_id, assertion_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      `${projectId}|${assertionId}`,
      projectId,
      assertionId,
      expiresAt,
      new Date().toISOString(),
    )
    .run();
  return result.meta?.changes ? { ok: true } : { ok: false, reason: "assertion_replayed" };
}

// Keep the legacy sync export shape for any caller that did not
// `await` the function. SAML validation is now async; this wrapper
// returns a "fail closed" result for any caller that forgot the await.
export function parseSamlAssertionSync(encodedResponse, config) {
  return {
    isValid: false,
    reason: "parseSamlAssertion_is_async_use_await",
    issuer: config?.idpEntityId || null,
  };
}

/** Identity-access HTTP adapter — first active SAML row for a project (snake_case). */
export async function getSamlConfig(env, projectId) {
  const row = await env.DB.prepare(
    "SELECT * FROM saml_configurations WHERE project_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
  )
    .bind(projectId)
    .first();
  if (!row) return null;
  return { ...row, enabled: row.status === "active" ? 1 : 0 };
}

/** Create or update the project's primary SAML configuration. */
export async function upsertSamlConfig(env, projectId, body) {
  const existing = await getSamlConfig(env, projectId);
  if (existing?.id) {
    await updateConfiguration(env, {
      configId: existing.id,
      projectId,
      idpEntityId: body.idp_entity_id,
      idpSsoUrl: body.idp_sso_url,
      idpCertificate: body.idp_certificate,
      spEntityId: body.sp_entity_id,
      spAcsUrl: body.sp_acs_url,
      nameIdFormat: body.name_id_format,
      attributeMapping: body.attribute_mapping,
    });
    return { id: existing.id };
  }
  return createConfiguration(env, {
    projectId,
    name: body.name || "Default",
    idpEntityId: body.idp_entity_id,
    idpSsoUrl: body.idp_sso_url,
    idpCertificate: body.idp_certificate,
    spEntityId: body.sp_entity_id || `fluxychat-${projectId}`,
    spAcsUrl: body.sp_acs_url,
    nameIdFormat: body.name_id_format,
    attributeMapping: body.attribute_mapping,
  });
}

/** SSO session row used by /saml/acs (separate from saml_sessions audit table). */
export async function createSsoSession(env, projectId, configurationId, assertion, jwtToken) {
  const id = `sso_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  // Audit F-37: the session's JWT was stored in clear text.
  const sealed = await sealSecretAtRest(env, jwtToken);
  await env.DB.prepare(
    `INSERT INTO sso_sessions (id, project_id, configuration_id, name_id, jwt_token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, configurationId, assertion?.nameId || "unknown", sealed, expiresAt, now)
    .run();
  return { id };
}

function mapConfigRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    idpEntityId: row.idp_entity_id, idpSsoUrl: row.idp_sso_url,
    idpSloUrl: row.idp_slo_url, idpCertificate: row.idp_certificate,
    idpMetadataUrl: row.idp_metadata_url, spEntityId: row.sp_entity_id,
    spAcsUrl: row.sp_acs_url, spSloUrl: row.sp_slo_url,
    signRequests: row.sign_requests === 1, wantAssertionsSigned: row.want_assertions_signed === 1,
    wantResponseSigned: row.want_response_signed === 1,
    attributeMapping: JSON.parse(row.attribute_mapping || "{}"),
    status: row.status, enforceSso: row.enforce_sso === 1, defaultRole: row.default_role,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapSessionRow(row) {
  return {
    id: row.id, projectId: row.project_id, configurationId: row.configuration_id,
    userId: row.user_id, nameId: row.name_id, nameIdFormat: row.name_id_format,
    sessionIndex: row.session_index,
    attributes: row.attributes ? JSON.parse(row.attributes) : null,
    ipAddress: row.ip_address, userAgent: row.user_agent,
    createdAt: row.created_at, expiresAt: row.expires_at, lastAccessedAt: row.last_accessed_at,
  };
}

function mapJITRow(row) {
  return {
    id: row.id, projectId: row.project_id, configurationId: row.configuration_id,
    userId: row.user_id, nameId: row.name_id, email: row.email, name: row.name,
    attributes: row.attributes ? JSON.parse(row.attributes) : null, provisionedAt: row.provisioned_at,
  };
}

function mapAuditRow(row) {
  return {
    id: row.id, projectId: row.project_id, configurationId: row.configuration_id,
    eventType: row.event_type, userId: row.user_id, nameId: row.name_id,
    ipAddress: row.ip_address, userAgent: row.user_agent,
    details: row.details ? JSON.parse(row.details) : null, createdAt: row.created_at,
  };
}

