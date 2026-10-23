import { describe, expect, it } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  buildSiweMessage,
  hashPersonalMessage,
  recoverPersonalSignAddress,
  issueWalletNonce,
  verifyWalletSiwe,
  setWalletAllowlist,
} from "./wallet-siwe.js";

function addressFromPrivateKey(priv) {
  const pub = secp256k1.getPublicKey(priv, false);
  return `0x${bytesToHex(keccak_256(pub.slice(1)).slice(12))}`;
}

function signPersonal(message, priv) {
  const hash = hashPersonalMessage(message);
  const noble = secp256k1.sign(hash, priv, { prehash: false, format: "recovered" });
  const eth = new Uint8Array(65);
  eth.set(noble.subarray(1), 0);
  eth[64] = noble[0];
  return `0x${bytesToHex(eth)}`;
}

/** Minimal D1 mock: the SIWE nonce table with atomic single-use claim. */
function makeEnv(extra = {}) {
  const rows = new Map();
  const kvStore = new Map();
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                if (sql.includes("INSERT INTO wallet_siwe_nonces")) {
                  rows.set(`${args[0]}:${args[1]}`, {
                    project_id: args[0],
                    address: args[1],
                    nonce: args[2],
                    message: args[3],
                    issued_at: args[4],
                    expires_at: args[5],
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("DELETE FROM wallet_siwe_nonces")) {
                  if (env.__claimLoses) return { meta: { changes: 0 } };
                  const key = `${args[0]}:${args[1]}`;
                  const row = rows.get(key);
                  if (row && row.nonce === args[2]) {
                    rows.delete(key);
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 0 } };
                }
                return { meta: { changes: 0 } };
              },
              async first() {
                if (sql.includes("FROM wallet_siwe_nonces")) {
                  const row = rows.get(`${args[0]}:${args[1]}`);
                  return row ? { ...row } : null;
                }
                return null;
              },
            };
          },
        };
      },
    },
    // Test hook: simulate the losing side of a concurrent claim.
    __claimLoses: false,
    RATE_LIMIT_KV: {
      async put(key, value) {
        kvStore.set(key, value);
      },
      async get(key) {
        return kvStore.get(key) ?? null;
      },
      async delete(key) {
        kvStore.delete(key);
      },
    },
    ...extra,
  };
  return env;
}

describe("wallet-siwe", () => {
  it("recovers the signer of a personal_sign message", () => {
    const priv = secp256k1.keygen().secretKey;
    const address = addressFromPrivateKey(priv);
    const message = buildSiweMessage({
      domain: "fluxychat.com",
      uri: "https://fluxychat.com/web3",
      address,
      nonce: "abc123",
      issuedAt: "2026-09-07T12:00:00.000Z",
    });
    const signature = signPersonal(message, priv);
    expect(recoverPersonalSignAddress(message, signature)).toBe(address);
  });

  it("issues a nonce and accepts a matching signature once", async () => {
    const env = makeEnv({ WALLET_SIWE_ALLOW_ANY_WALLET: "true" });
    const priv = secp256k1.keygen().secretKey;
    const address = addressFromPrivateKey(priv);
    const issued = await issueWalletNonce(env, {
      projectId: "proj-1",
      address,
      domain: "fluxychat.com",
      uri: "https://fluxychat.com/web3",
    });
    expect(issued.error).toBeUndefined();
    const signature = signPersonal(issued.message, priv);
    const ok = await verifyWalletSiwe(env, {
      projectId: "proj-1",
      address,
      message: issued.message,
      signature,
      domain: "fluxychat.com",
    });
    expect(ok.address).toBe(address);
    const again = await verifyWalletSiwe(env, {
      projectId: "proj-1",
      address,
      message: issued.message,
      signature,
      domain: "fluxychat.com",
    });
    expect(again.error).toBe("nonce_expired");
  });

  it("rejects a signature whose nonce was already claimed (audit F-36)", async () => {
    const env = makeEnv({ WALLET_SIWE_ALLOW_ANY_WALLET: "true" });
    const priv = secp256k1.keygen().secretKey;
    const address = addressFromPrivateKey(priv);
    const issued = await issueWalletNonce(env, {
      projectId: "proj-1",
      address,
      domain: "fluxychat.com",
      uri: "https://fluxychat.com/web3",
    });
    // Simulate the losing side of a concurrent replay: the read still sees the
    // nonce but the atomic claim deletes zero rows.
    env.__claimLoses = true;
    const signature = signPersonal(issued.message, priv);
    const denied = await verifyWalletSiwe(env, {
      projectId: "proj-1",
      address,
      message: issued.message,
      signature,
      domain: "fluxychat.com",
    });
    expect(denied.error).toBe("nonce_expired");
  });

  it("rejects allowlisted projects when the address is missing", async () => {
    const env = makeEnv();
    await setWalletAllowlist(env, "proj-1", ["0x1111111111111111111111111111111111111111"]);
    const priv = secp256k1.keygen().secretKey;
    const address = addressFromPrivateKey(priv);
    const issued = await issueWalletNonce(env, {
      projectId: "proj-1",
      address,
      domain: "fluxychat.com",
      uri: "https://fluxychat.com/web3",
    });
    const signature = signPersonal(issued.message, priv);
    const denied = await verifyWalletSiwe(env, {
      projectId: "proj-1",
      address,
      message: issued.message,
      signature,
      domain: "fluxychat.com",
    });
    expect(denied.error).toBe("not_allowlisted");
  });

  it("refuses sign-in when no allowlist is configured (audit F-36)", async () => {
    const env = makeEnv();
    const priv = secp256k1.keygen().secretKey;
    const address = addressFromPrivateKey(priv);
    const issued = await issueWalletNonce(env, {
      projectId: "proj-1",
      address,
      domain: "fluxychat.com",
      uri: "https://fluxychat.com/web3",
    });
    const signature = signPersonal(issued.message, priv);
    const denied = await verifyWalletSiwe(env, {
      projectId: "proj-1",
      address,
      message: issued.message,
      signature,
      domain: "fluxychat.com",
    });
    expect(denied).toMatchObject({ error: "allowlist_not_configured", status: 403 });
  });
});
