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
  it("validateSamlAudience fails closed on missing audience/recipient (audit F-28)", async () => {
    const { validateSamlAudience } = await import("../lib/sso-saml.js");
    const config = { spEntityId: "fluxychat", spAcsUrl: "https://app.com/saml/acs" };
    expect(validateSamlAudience({ audience: "fluxychat", recipient: config.spAcsUrl }, config)).toEqual({ valid: true });
    expect(validateSamlAudience({ audience: null, recipient: config.spAcsUrl }, config)).toEqual({
      valid: false,
      reason: "audience_mismatch",
    });
    expect(validateSamlAudience({ audience: "app.com", recipient: config.spAcsUrl }, config)).toEqual({
      valid: false,
      reason: "audience_mismatch",
    });
    expect(validateSamlAudience({ audience: "fluxychat", recipient: null }, config)).toEqual({
      valid: false,
      reason: "recipient_mismatch",
    });
  });

  it("recordSamlAssertionUse rejects a replayed assertion id (audit F-27)", async () => {
    const { recordSamlAssertionUse } = await import("../lib/sso-saml.js");
    const changes = { value: 1 };
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn(async () => ({ meta: { changes: changes.value } })),
      }),
    };
    const first = await recordSamlAssertionUse({ DB: db }, {
      projectId: "p1",
      assertionId: "a-1",
      notOnOrAfter: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(first).toEqual({ ok: true });
    changes.value = 0;
    const replay = await recordSamlAssertionUse({ DB: db }, { projectId: "p1", assertionId: "a-1" });
    expect(replay).toEqual({ ok: false, reason: "assertion_replayed" });
    const missing = await recordSamlAssertionUse({ DB: db }, { projectId: "p1", assertionId: null });
    expect(missing).toEqual({ ok: false, reason: "assertion_id_missing" });
  });

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

  it("accepts a valid reference digest and reads claims from the verified node (S-21 residual)", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const assertionId = "_valid-assertion-1";
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId,
      nameId: "alice@example.com",
      attributesXml:
        `<saml:AttributeStatement><saml:Attribute Name="role">` +
        `<saml:AttributeValue>admin</saml:AttributeValue>` +
        `</saml:Attribute></saml:AttributeStatement>`,
      privateKey,
      enveloped: false,
    });

    const result = await parseSamlAssertion(xml, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    // Regression: the earlier regex extraction truncated at the first inner
    // closing tag, so a valid response failed with name_id_missing.
    expect(result.isValid).toBe(true);
    expect(result.nameId).toBe("alice@example.com");
    expect(result.notBefore).toBe("2024-01-01T00:00:00Z");
    expect(result.notOnOrAfter).toBe("2099-01-01T00:00:00Z");
    expect(result.attributes).toEqual({ role: "admin" });
  });

  it("ignores wrapped markup in comments when extracting claims (S-21 residual)", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const assertionId = "_valid-assertion-2";
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId,
      nameId: "genuine@example.com",
      attributesXml:
        `<saml:AttributeStatement><saml:Attribute Name="role">` +
        `<saml:AttributeValue>member</saml:AttributeValue>` +
        `</saml:Attribute></saml:AttributeStatement>`,
      privateKey,
      enveloped: false,
    });

    // XML Signature Wrapping attempt: valid signature and digest, but an
    // injected comment (dropped by the digest canonicalization, invisible to
    // the DOM) carries fake claims in raw markup.
    const fake =
      `<saml:Assertion ID="${assertionId}">` +
      `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
      `<saml:NameID>evil@example.com</saml:NameID>` +
      `<saml:AttributeStatement><saml:Attribute Name="role">` +
      `<saml:AttributeValue>owner</saml:AttributeValue>` +
      `</saml:Attribute></saml:AttributeStatement>` +
      `</saml:Assertion>`;
    const wrapped = xml.replace(
      `<saml:Assertion ID="${assertionId}">`,
      `<!--${fake}--><saml:Assertion ID="${assertionId}">`,
    );

    const result = await parseSamlAssertion(wrapped, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    expect(result.isValid).toBe(true);
    expect(result.nameId).toBe("genuine@example.com");
    expect(result.attributes).toEqual({ role: "member" });
  });

  it("ignores claims nested in Advice and reads attributes structurally (audit F-38)", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const assertionId = "_valid-assertion-3";
    // Advice is valid signed content, but claims must come from the schema path
    // (AttributeStatement > Attribute), not from any descendant with that name.
    const attributesXml =
      `<saml:AttributeStatement><saml:Attribute Name="role">` +
      `<saml:AttributeValue>member</saml:AttributeValue>` +
      `</saml:Attribute></saml:AttributeStatement>` +
      `<saml:Advice><saml:Attribute Name="role">` +
      `<saml:AttributeValue>owner</saml:AttributeValue>` +
      `</saml:Attribute></saml:Advice>`;
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId,
      nameId: "genuine@example.com",
      attributesXml,
      privateKey,
      enveloped: false,
    });

    const result = await parseSamlAssertion(xml, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    expect(result.isValid).toBe(true);
    expect(result.nameId).toBe("genuine@example.com");
    expect(result.attributes).toEqual({ role: "member" });
  });

  it("reads Reference/Digest from the signed SignedInfo, not the first raw match (F-21)", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const assertionId = "_xsw-genuine-1";
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId,
      nameId: "genuine@example.com",
      attributesXml: "",
      privateKey,
      enveloped: false,
    });

    // XML Signature Wrapping: an unsigned evil assertion plus a decoy
    // <ds:Reference> whose digest matches it, both placed BEFORE the genuine
    // signed payload. A raw-XML first-match extraction would verify the
    // attacker's node and read claims from it.
    const evilAssertion =
      `<saml:Assertion ID="evil-1">` +
      `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
      `<saml:Subject><saml:NameID>evil@example.com</saml:NameID></saml:Subject>` +
      `<saml:Conditions NotBefore="2024-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>` +
      `</saml:Assertion>`;
    const withEvil = xml.replace(
      `<saml:Assertion ID="${assertionId}">`,
      `${evilAssertion}<saml:Assertion ID="${assertionId}">`,
    );
    const evilDigest = await referenceDigestForTest(withEvil, "evil-1");
    const decoyRef =
      `<ds:Reference URI="#evil-1">` +
      `<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<ds:DigestValue>${evilDigest}</ds:DigestValue>` +
      `</ds:Reference>`;
    const attack = withEvil.replace("</saml:Assertion>", `</saml:Assertion>${decoyRef}`);

    const result = await parseSamlAssertion(attack, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    expect(result.isValid).toBe(true);
    expect(result.nameId).toBe("genuine@example.com");
    expect(result.attributes).toEqual({});
  });

  it("verifies an assertion with the signature enveloped inside it", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const assertionId = "_enveloped-assertion-1";
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId,
      nameId: "bob@example.com",
      attributesXml: "",
      privateKey,
      enveloped: true,
    });

    const result = await parseSamlAssertion(xml, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    // Regression: the digest used to be computed over the assertion INCLUDING
    // the enveloped signature, so real assertion-signed IdP responses failed.
    expect(result.isValid).toBe(true);
    expect(result.nameId).toBe("bob@example.com");
  });

  it("rejects a duplicate reference id in both document orders (wrapping ambiguity)", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const assertionId = "_dup-assertion-1";
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId,
      nameId: "genuine@example.com",
      attributesXml: "",
      privateKey,
      enveloped: false,
    });
    const decoy =
      `<saml:Assertion ID="${assertionId}">` +
      `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
      `<saml:Subject><saml:NameID>evil@example.com</saml:NameID></saml:Subject>` +
      `<saml:Conditions NotBefore="2024-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>` +
      `</saml:Assertion>`;

    // Decoy before the genuine assertion (a first-match id lookup would verify
    // the wrong node) and after it (a second-identity smuggling attempt).
    // Both must fail closed.
    const decoyFirst = xml.replace(
      `<saml:Assertion ID="${assertionId}">`,
      `${decoy}<saml:Assertion ID="${assertionId}">`,
    );
    const decoySecond = xml.replace("</samlp:Response>", `${decoy}</samlp:Response>`);

    for (const candidate of [decoyFirst, decoySecond]) {
      const result = await parseSamlAssertion(candidate, {
        idpEntityId,
        idpCertificate: pemCert,
        wantAssertionsSigned: true,
        wantResponseSigned: false,
      });
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("reference_digest_reference_id_ambiguous");
      expect(result.nameId).toBeUndefined();
    }
  });

  it("rejects a Reference that does not point at a local fragment", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId: "_ref-uri-1",
      nameId: "alice@example.com",
      attributesXml: "",
      privateKey,
      enveloped: false,
      refUri: "http://other-sp.example.com/assertion",
    });

    const result = await parseSamlAssertion(xml, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("assertion_reference_missing");
  });

  it("rejects assertion claims tampered after the IdP computed the digest", async () => {
    const { privateKey, pemCert } = await generateTestRsaKeyPairAndCert();
    const { parseSamlAssertion } = await import("../lib/sso-saml.js");

    const idpEntityId = "http://idp.example.com";
    const { xml } = await buildSignedResponse({
      idpEntityId,
      assertionId: "_tampered-1",
      nameId: "genuine@example.com",
      attributesXml: "",
      privateKey,
      enveloped: false,
    });
    const tampered = xml.replace("genuine@example.com", "attacker@example.com");

    const result = await parseSamlAssertion(tampered, {
      idpEntityId,
      idpCertificate: pemCert,
      wantAssertionsSigned: true,
      wantResponseSigned: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("reference_digest_digest_mismatch");
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

/**
 * Build a SAML response whose <ds:Reference> digest is computed the way an IdP
 * does: exclusive C14N of the assertion (signature not yet inserted at digest
 * time; for the enveloped case it is added afterwards, so the verifier strips
 * it back to these exact bytes), SHA-256, base64. SignedInfo is signed with
 * the test key.
 */
async function buildSignedResponse({
  idpEntityId,
  assertionId,
  nameId,
  attributesXml,
  privateKey,
  enveloped,
  refUri,
}) {
  const assertion =
    `<saml:Assertion ID="${assertionId}">` +
    `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
    `<saml:Subject><saml:NameID>${nameId}</saml:NameID></saml:Subject>` +
    `<saml:Conditions NotBefore="2024-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>` +
    attributesXml +
    `</saml:Assertion>`;

  const skeleton =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<saml:Issuer>${idpEntityId}</saml:Issuer>` +
    assertion +
    `</samlp:Response>`;

  const digestB64 = await referenceDigestForTest(skeleton, assertionId);

  const signedInfo =
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
    `<ds:Reference URI="${refUri ?? `#${assertionId}`}">` +
    `<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<ds:DigestValue>${digestB64}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`;

  const canonicalSignedInfo = await canonicalizeForTest(signedInfo);
  const sigBytes = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(canonicalSignedInfo),
  );
  const sigB64 = bytesToBase64(new Uint8Array(sigBytes));

  const signature = `<ds:Signature>${signedInfo}<ds:SignatureValue>${sigB64}</ds:SignatureValue></ds:Signature>`;

  const xml = enveloped
    ? skeleton.replace(`</saml:Assertion>`, `${signature}</saml:Assertion>`)
    : skeleton.replace(`</samlp:Response>`, `${signature}</samlp:Response>`);
  return { xml };
}

/** SHA-256(c14n(assertion)) as base64 — the assertion carries no signature yet. */
async function referenceDigestForTest(responseXml, assertionId) {
  const { DOMParser } = await import("@xmldom/xmldom");
  const { default: C14nFactory } = await import("xml-c14n");
  const doc = new DOMParser().parseFromString(responseXml, "application/xml");
  const all = doc.getElementsByTagName("*");
  let node = null;
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i];
    const id = el.getAttribute && (el.getAttribute("ID") || el.getAttribute("Id"));
    if (id === assertionId) {
      node = el;
      break;
    }
  }
  if (!node) throw new Error(`assertion ${assertionId} not found`);
  const factory = new C14nFactory();
  const canonical = await new Promise((resolve, reject) => {
    factory
      .createCanonicaliser("http://www.w3.org/2001/10/xml-exc-c14n#")
      .canonicalise(node, (err, result) => (err ? reject(err) : resolve(result)));
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return bytesToBase64(new Uint8Array(digest));
}

