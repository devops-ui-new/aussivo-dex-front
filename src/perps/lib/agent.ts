// Agent-wallet key management. The agent key is generated in the browser,
// approved on Hyperliquid via ApproveAgent (main-wallet signature), and can
// TRADE but never withdraw. It is stored encrypted with AES-GCM under a key
// derived from a deterministic main-wallet signature, so unlocking a new
// session costs one signature and the plaintext key never leaves this tab.

import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { HL_NETWORK } from '../config';

export const AGENT_UNLOCK_MESSAGE =
  'BuilderFi agent key unlock v1\n\nSigning this message unlocks popup-free trading on this device. It costs nothing and cannot move funds.';

function storageKey(address: string): string {
  return `builderfi.agent.${HL_NETWORK}.${address.toLowerCase()}`;
}

async function deriveAesKey(signature: string): Promise<CryptoKey> {
  const bytes = new TextEncoder().encode(signature);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...b));
}

function fromB64(s: string) {
  const bin = atob(s);
  // Explicit ArrayBuffer backing so the result satisfies BufferSource under
  // TS 5.7+ generic TypedArray types.
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function hasStoredAgent(address: string): boolean {
  return localStorage.getItem(storageKey(address)) !== null;
}

export function clearStoredAgent(address: string): void {
  localStorage.removeItem(storageKey(address));
  sessionStorage.removeItem(sessionKey(address));
}

// ---------- per-tab session cache ----------
// The decrypted key is cached in sessionStorage so a page RELOAD does not force
// another unlock signature. sessionStorage is cleared when the tab closes, and
// the key can trade but never withdraw — a deliberately bounded exposure that
// removes the "Unlock Trading on every reload" friction.
function sessionKey(address: string): string {
  return `builderfi.agentkey.${HL_NETWORK}.${address.toLowerCase()}`;
}

/** Cache the raw agent private key for this tab session. */
export function cacheSessionAgent(address: string, privateKey: string): void {
  try {
    sessionStorage.setItem(sessionKey(address), privateKey);
  } catch {
    // storage unavailable — falls back to per-reload unlock
  }
}

/** Restore the agent from the tab-session cache without a signature. */
export function restoreSessionAgent(address: string): PrivateKeyAccount | null {
  try {
    const pk = sessionStorage.getItem(sessionKey(address));
    if (!pk) return null;
    return privateKeyToAccount(pk as `0x${string}`);
  } catch {
    return null;
  }
}

/** Generate a fresh agent key and persist it encrypted under the unlock signature. */
export async function createAgent(
  address: string,
  unlockSignature: string,
): Promise<PrivateKeyAccount> {
  const privateKey = generatePrivateKey();
  const key = await deriveAesKey(unlockSignature);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(privateKey),
  );
  localStorage.setItem(
    storageKey(address),
    JSON.stringify({ v: 1, iv: toB64(iv), data: toB64(ciphertext) }),
  );
  cacheSessionAgent(address, privateKey); // survive reloads for this tab
  return privateKeyToAccount(privateKey);
}

/** Decrypt the stored agent key with the unlock signature. Null if absent/corrupt. */
export async function unlockAgent(
  address: string,
  unlockSignature: string,
): Promise<PrivateKeyAccount | null> {
  const raw = localStorage.getItem(storageKey(address));
  if (!raw) return null;
  try {
    const { iv, data } = JSON.parse(raw) as { iv: string; data: string };
    const key = await deriveAesKey(unlockSignature);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(iv) },
      key,
      fromB64(data),
    );
    const pk = new TextDecoder().decode(plain);
    cacheSessionAgent(address, pk); // survive reloads for this tab
    return privateKeyToAccount(pk as `0x${string}`);
  } catch {
    // wrong signature (different wallet?) or corrupt entry
    return null;
  }
}
