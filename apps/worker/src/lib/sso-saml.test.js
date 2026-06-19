import { describe, it, expect, vi } from "vitest";
import { webcrypto, generateKeyPairSync } from "node:crypto";

function mockDB(rows = []) {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue(rows[0] || null),
    all: vi.fn().mockResolvedValue({ results: rows }),
  };
  return chain;
}

const env = {};

describe("sso-saml", () => {
  it("creates SAML configuration", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createConfiguration } = await import("../lib/sso-saml.js");
    const result = await createConfiguration(env, {
      projectId: "p1", name: "Okta SSO",
      idpEntityId: "http://okta.com", idpSsoUrl: "https://okta.com/sso",
      idpCertificate: "MIIC...", spEntityId: "fluxychat", spAcsUrl: "https://app.com/saml/acs",
    });
    expect(result.id).toMatch(/^sc_/);
  });

  it("creates SAML session", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { createSession } = await import("../lib/sso-saml.js");
    const result = await createSession(env, { projectId: "p1", configurationId: "sc_1", userId: "u1", nameId: "user@okta.com" });
    expect(result.id).toMatch(/^ss_/);
  });

  it("invalidates user sessions", async () => {
    const db = mockDB();
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { invalidateUserSessions } = await import("../lib/sso-saml.js");
    const result = await invalidateUserSessions(env, { projectId: "p1", userId: "u1" });
    expect(result.invalidated).toBeGreaterThanOrEqual(0);
  });

  it("provisions JIT user", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { provisionUser } = await import("../lib/sso-saml.js");
    const result = await provisionUser(env, { projectId: "p1", configurationId: "sc_1", userId: "u1", nameId: "user@okta.com", email: "user@okta.com" });
    expect(result.id).toMatch(/^sj_/);
  });

  it("logs audit event", async () => {
    const db = mockDB([]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { logAuditEvent } = await import("../lib/sso-saml.js");
    const result = await logAuditEvent(env, { projectId: "p1", eventType: "login_success", userId: "u1" });
    expect(result.id).toMatch(/^sa_/);
  });

  it("gets SSO stats", async () => {
    const db = mockDB([{ status: "active", count: 2 }]);
    env.DB = { prepare: vi.fn().mockReturnValue(db) };
    const { getSSOStats } = await import("../lib/sso-saml.js");
    const result = await getSSOStats(env, { projectId: "p1" });
    expect(result).toHaveProperty("configurations");
    expect(result).toHaveProperty("activeSessions");
    expect(result).toHaveProperty("recentLogins");
  });

  it("parseSamlAssertion fails closed without a real verifier (audit S-21)", async () => {
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");
    const fakeResponse = "<samlp:Response>...garbage...</samlp:Response>";
    // empty input
    const r0 = await parseSamlAssertion("", { idpEntityId: "http://idp" });
    expect(r0.isValid).toBe(false);
    // null config
    const r1 = await parseSamlAssertion(fakeResponse, null);
    expect(r1.isValid).toBe(false);
    // missing cert
    const r2 = await parseSamlAssertion(fakeResponse, { idpEntityId: "http://idp" });
    expect(r2.isValid).toBe(false);
    // cert present but signature is not actually verifiable
    const r3 = await parseSamlAssertion(fakeResponse, { idpEntityId: "http://idp", idpCertificate: "MIIC..." });
    expect(r3.isValid).toBe(false);
    // Critical: the parser must never return a hard-coded user@example.com
    expect(r3.nameId).toBeUndefined();
  });

  it("parseSamlAssertion verifies a real SignedInfo against the IdP cert", async () => {
    // Generate an RSA-2048 keypair at test time and pass the SPKI PEM
    // directly as the "cert"  production code calls
    // `importKey("spki", derBytes, ...)` after stripping PEM armor,
    // so the cert envelope is irrelevant for the verifier.
    const { publicKey, privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    expect(publicKey).toBeTruthy();
    expect(privateKey).toBeTruthy();
    expect(pemCert).toMatch(/-----BEGIN PUBLIC KEY-----/);

    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    // Build a signed SAML response. A real IdP would canonicalize
    // SignedInfo with exclusive C14N before signing the canonical
    // bytes. We mirror that here so the verifier can apply the same
    // transformation and reproduce the bytes the IdP signed.
    const idpEntityId = "http://idp.example.com";
    const assertionId = "_assertion-1234";
    const nameId = "alice@example.com";

    const signedInfo =
      `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `<ds:Reference URI="#${assertionId}">` +
      `<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<ds:DigestValue>fake</ds:DigestValue>` +
      `</ds:Reference>` +
      `</ds:SignedInfo>`;

    // Sign the canonical form (this is what a real IdP does).
    const canonicalSignedInfo = await canonicalizeForTest(signedInfo);
    const sigBytes = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      new TextEncoder().encode(canonicalSignedInfo),
    );
    const sigB64 = bytesToBase64(new Uint8Array(sigBytes));

    const xml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
      `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
      `xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
      `<saml:Assertion ID="${assertionId}">` +
      `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
      `<saml:Subject><saml:NameID>${nameId}</saml:NameID></saml:Subject>` +
      `<saml:Conditions NotBefore="2024-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>` +
      `</saml:Assertion>` +
      `<ds:Signature>` +
      signedInfo +
      `<ds:SignatureValue>${sigB64}</ds:SignatureValue>` +
      `</ds:Signature>` +
      `</samlp:Response>`;

    const result = await parseSamlAssertion(xml, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    // Audit CRITICAL #6: per-element digest verification is now implemented.
    // The test's <ds:DigestValue> is the literal "fake", so verification must
    // reject it with a digest mismatch (fail closed against XML Sig Wrapping).
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("reference_digest_digest_mismatch");

    // Same response, but with want_assertions_signed=false. The
    // SignedInfo verifies, the issuer matches, nameId is extracted.
    const result2 = await parseSamlAssertion(xml, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: false,
      wantResponseSigned: false,
    });
    expect(result2.isValid).toBe(true);
    expect(result2.issuer).toBe(idpEntityId);
    expect(result2.nameId).toBe(nameId);
  });

  it("parseSamlAssertion rejects a tampered SignedInfo (signature invalid)", async () => {
    const { publicKey, privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const nameId = "bob@example.com";

    const signedInfo =
      `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `<ds:Reference URI="#x"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>z</ds:DigestValue></ds:Reference>` +
      `</ds:SignedInfo>`;

    // Sign the canonicalized form of the ORIGINAL SignedInfo.
    const canonicalOriginal = await canonicalizeForTest(signedInfo);
    const sigBytes = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      privateKey,
      new TextEncoder().encode(canonicalOriginal),
    );
    const sigB64 = bytesToBase64(new Uint8Array(sigBytes));

    // Tamper: replace the SignedInfo content after signing. The
    // canonical form will differ from the canonicalized original, so
    // the RSA verify must fail.
    const tamperedSignedInfo =
      `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `<ds:Reference URI="#x"><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>TAMPERED</ds:DigestValue></ds:Reference>` +
      `</ds:SignedInfo>`;

    const xml =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
      `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
      `xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
      `<saml:Assertion ID="x">` +
      `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
      `<saml:Subject><saml:NameID>${nameId}</saml:NameID></saml:Subject>` +
      `</saml:Assertion>` +
      `<ds:Signature>` +
      tamperedSignedInfo +
      `<ds:SignatureValue>${sigB64}</ds:SignatureValue>` +
      `</ds:Signature>` +
      `</samlp:Response>`;

    const result = await parseSamlAssertion(xml, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: false,
      wantResponseSigned: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("signature_invalid");
  });

  it("parseSamlAssertion rejects when cert is missing", async () => {
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");
    const result = await parseSamlAssertion(
      "<samlp:Response><ds:Signature/></samlp:Response>",
      { idpEntityId: "http://idp" },
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("idp_certificate_missing");
  });
});

// --- test helpers ---

/**
 * Mirror what a real IdP does at signing time: parse the SignedInfo
 * fragment as XML, run exclusive C14N, return the canonical bytes.
 * The verifier applies the same transformation before checking the
 * signature, so this is the contract the tests now exercise.
 */
async function canonicalizeForTest(signedInfoFragment) {
  const { DOMParser } = await import("@xmldom/xmldom");
  const { default: C14nFactory } = await import("xml-c14n");
  const wrapped = `<root xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfoFragment}</root>`;
  const doc = new DOMParser().parseFromString(wrapped, "application/xml");
  const node = doc.getElementsByTagName("ds:SignedInfo")[0];
  const factory = new C14nFactory();
  return new Promise((resolve, reject) => {
    factory
      .createCanonicaliser("http://www.w3.org/2001/10/xml-exc-c14n#")
      .canonicalise(node, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

async function generateTestRsaKeyPairAndCert() {
  // Generate RSA-2048 key pair
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Import the public key as a SubtleCrypto key for signing
  const subtle = webcrypto.subtle;
  const privDer = pemToDer(privateKey);
  const privKey = await subtle.importKey(
    "pkcs8",
    privDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const pubDer = pemToDer(publicKey);
  const pubKey = await subtle.importKey(
    "spki",
    pubDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  // Pass the SPKI PEM directly as the "cert"  production code
  // calls importKey("spki", derBytes, ...) after stripping PEM armor,
  // so the cert envelope is irrelevant for the verifier.
  return { publicKey: pubKey, privateKey: privKey, pemCert: publicKey };
}

function pemToDer(pem) {
  const stripped = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(stripped, "base64"));
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

