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
    const store = new Map();
    const env = {
      RATE_LIMIT_KV: {
        async put(key, value) {
          store.set(key, value);
        },
        async get(key) {
          return store.get(key) ?? null;
        },
        async delete(key) {
          store.delete(key);
        },
      },
    };
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

  it("rejects allowlisted projects when the address is missing", async () => {
    const store = new Map();
    const env = {
      RATE_LIMIT_KV: {
        async put(key, value) {
          store.set(key, value);
        },
        async get(key) {
          return store.get(key) ?? null;
        },
        async delete(key) {
          store.delete(key);
        },
      },
    };
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
});
