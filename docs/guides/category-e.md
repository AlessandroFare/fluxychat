# Category E — Enterprise/Security (14 modules)

## E-1: MLS Encryption (`mls-encryption.ts`)

End-to-end encryption for groups using MLS-style protocol with key rotation and multi-device support.

```
createMlsManager() → MlsManager
```

**Key APIs:** `createGroup`, `addDevice`, `removeDevice`, `encryptMessage`, `decryptMessage`, `rotateKeys`

**Usage:**
```typescript
const mls = createMlsManager();
const group = mls.createGroup({ cipherSuite: "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" });
mls.addDevice(group.groupId, { deviceId: "alice", publicKey: "pk", signatureKey: "sk", credentialType: "basic" });
const msg = mls.encryptMessage(group.groupId, "alice", "hello");
const text = mls.decryptMessage(group.groupId, msg);
```

**Config:** Supports 3 cipher suites, max device limits, auto key rotation intervals.

---

## E-2: AI Governance (`ai-governance.ts`)

Model/prompt/tool registry with risk tiering, approvals, and evaluations.

```
createAiGovernance(config?) → AiGovernance
```

**Key APIs:** `registerModel`, `registerPrompt`, `registerTool`, `approveModel`, `listModels`, `listPrompts`, `listTools`

**Risk Tiers:** `low`, `medium`, `high`, `critical`

---

## E-3: eDiscovery / Legal Hold (`ediscovery.ts`)

Immutable legal holds, scoped exports, chain-of-custody audit log.

```
createEdiscoveryManager(config?) → EdiscoveryManager
```

**Key APIs:** `createHold`, `releaseHold`, `requestExport`, `completeExport`, `getAuditLog`

**Audit:** Every action is logged with a SHA-256 checksum for tamper detection.

---

## E-4: DLP PHI/PCI Detection (`dlp-detection.ts`)

Pattern-based data loss prevention for text/file/audio content.

```
createDlpDetector() → DlpDetector
```

**Key APIs:** `createPolicy`, `updatePolicy`, `scanText`, `scanFile`

**Default patterns:** SSN, email, phone (PHI); credit card, CVV (PCI).

**Actions:** `block`, `redact`, `quarantine`, `flag`, `allow`

---

## E-5: Customer-Managed Keys (`cmk-encryption.ts`)

Envelope encryption with key rotation, revocation, and tenant isolation.

```
createCmkManager(policy?) → CmkManager
```

**Key APIs:** `createKey`, `rotateKey`, `revokeKey`, `encrypt`, `decrypt`, `getAuditLog`

**Algorithms:** AES-256-GCM, AES-256-CBC, ChaCha20-Poly1305

**Status lifecycle:** `active → rotating → active | revoked`

---

## E-6: Data Residency (`data-residency.ts`)

Region pinning, subprocessor management, inference routing.

```
createResidencyValidator() → ResidencyValidator
```

**Key APIs:** `createPolicy`, `updatePolicy`, `validateDataLocation`, `resolveInferenceRegion`, `getDataLocation`

**Regions:** us-east, us-west, eu-west, eu-central, ap-southeast, ap-northeast, sa-east, me-central

---

## E-7: Policy-Based Approvals (`policy-approvals.ts`)

Rule-based policy engine with enforcing/shadow modes and transitive evaluation.

```
createPolicyEngine() → PolicyEngine
```

**Key APIs:** `addPolicy`, `removePolicy`, `evaluate`, `evaluateTransitive`

**Modes:** `enforcing` — blocks or allows; `shadow` — logs but doesn't block; `disabled`

---

## E-8: MCP Server Identity (`mcp-identity.ts`)

Server registration, instructions, and tool provenance for MCP protocol.

```
createMcpIdentityManager() → McpIdentityManager
```

**Key APIs:** `registerServer`, `setInstructions`, `createToolProvenance`, `listToolsByServer`

---

## E-9: Bot Protection (`bot-protection.ts`)

Device/user/tenant rate limits, raid mode, trust scoring.

```
createBotProtection() → BotProtection
```

**Key APIs:** `configureRateLimit`, `checkRateLimit`, `setRaidMode`, `getTrustScore`, `reportFalsePositive`

**Scopes:** device, user, tenant, global

---

## E-10: Session Replay (`session-replay.ts`)

Privacy-safe event timeline with redaction, consent tracking, and deterministic protocol export.

```
createSessionReplayManager() → SessionReplayManager
```

**Key APIs:** `createReplaySession`, `recordEvent`, `redactSession`, `exportProtocol`, `setConsent`

**Redaction levels:** `none`, `metadata_only`, `content_safe`, `full`

---

## E-11: Federation Bridge (`federation-bridge.ts`)

Matrix/ActivityPub/DM bridge with identity linking and compliance modes.

```
createFederationBridge() → FederationBridge
```

**Key APIs:** `addBridge`, `linkIdentity`, `bridgeMessage`, `getStatus`

**Protocols:** `matrix`, `activitypub`, `dm`, `custom`

---

## E-12: Feature Flags (`feature-flags.ts`)

Tenant rollout, kill switch, holdout groups, metric guardrails.

```
createFeatureFlagManager() → FeatureFlagManager
```

**Key APIs:** `createFlag`, `isEnabled`, `setKillSwitch`, `recordMetric`

**Guardrails:** Auto-disable flags when metrics breach thresholds.

---

## E-13: Sandboxed Tool Execution (`sandbox-execution.ts`)

Isolated code execution with quota limits, timeout, and kill support.

```
createSandboxExecutor(quota?) → SandboxExecutor
```

**Key APIs:** `run`, `kill`, `getQuota`, `listRuns`

**Runtimes:** node, python, wasm, docker

---

## E-14: Generative UI Sandbox (`gui-sandbox.ts`)

Isolated iframe rendering for untrusted UI components with CSP and capability grants.

```
createGuiSandboxManager() → GuiSandboxManager
```

**Key APIs:** `registerComponent`, `renderComponent`, `grantCapability`, `revokeComponent`

**Sandbox attributes:** allow-scripts, allow-same-origin, allow-forms, allow-popups
