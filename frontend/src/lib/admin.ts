'use client';

/**
 * Gate admin client-side (offuscamento UI, NON sicurezza reale).
 *
 * La password non è mai salvata in chiaro: si confronta solo lo SHA-256 hex.
 * Override via env: NEXT_PUBLIC_ADMIN_PASSWORD_HASH
 * Lo sblocco vive solo in sessionStorage -> si perde chiudendo il tab.
 */

export const ADMIN_CLICKS_REQUIRED = 8;
// Finestra max tra primo e ottavo click: oltre si azzera il contatore
export const ADMIN_CLICK_WINDOW_MS = 2500;
export const ADMIN_SESSION_KEY = 'cerca_interpelli_admin_unlocked';
export const ADMIN_EVENT = 'cerca-interpelli-admin-change';

// Hash di default (sostituibile con NEXT_PUBLIC_ADMIN_PASSWORD_HASH).
// Generato per l'owner — cambialo quando vuoi rigenerando con:
// node -e "console.log(require('crypto').createHash('sha256').update('TUA_PASSWORD').digest('hex'))"
const BUILTIN_ADMIN_PASSWORD_HASH =
  '8da9ef7f98b972b5621a1d83ed499bfaa58279c2f5b939b1287a1883a65f7b38';

export function getAdminPasswordHash(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ADMIN_PASSWORD_HASH;
  if (fromEnv && fromEnv.trim().length >= 32) return fromEnv.trim().toLowerCase();
  return BUILTIN_ADMIN_PASSWORD_HASH;
}

export async function sha256Hex(text: string): Promise<string> {
  // SubtleCrypto (solo contesti sicuri). Fallback JS puro se non disponibile.
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const buf = await window.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text)
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // cade nel fallback sotto
  }
  // Fallback minimo senza dipendenze (implementazione SHA-256 compatta)
  return pureSha256Hex(text);
}

// --- SHA-256 puro (fallback http / contesti non sicuri) ---
function pureSha256Hex(ascii: string): string {
  // Adattato da pubblico dominio (Angel Marin / Paul Johnston style), input UTF-8
  const bytes = new TextEncoder().encode(ascii);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const bitLen = bytes.length * 8;
  const withOne = new Uint8Array(bytes.length + 1);
  withOne.set(bytes);
  withOne[bytes.length] = 0x80;
  let paddedLen = withOne.length;
  while (paddedLen % 64 !== 56) paddedLen++;
  const padded = new Uint8Array(paddedLen + 8);
  padded.set(withOne);
  const dv = new DataView(padded.buffer);
  // 64-bit length: high 32 = 0 per messaggi < 2^32 bit
  dv.setUint32(paddedLen, 0);
  dv.setUint32(paddedLen + 4, bitLen >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const input = password.normalize('NFC');
  const [a, b] = await Promise.all([
    sha256Hex(input),
    Promise.resolve(getAdminPasswordHash()),
  ]);
  if (a.length !== b.length) return false;
  // Confronto a tempo costante (per non leakare via timing, per quanto client-side)
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdminUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function notifyAdminChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_EVENT));
  }
}

export function setAdminUnlocked() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
  } catch {}
  notifyAdminChange();
}

export function lockAdmin() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {}
  notifyAdminChange();
}

import { useSyncExternalStore, useCallback } from 'react';

function subscribeAdmin(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ADMIN_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(ADMIN_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

function getAdminSnapshot(): boolean {
  return isAdminUnlocked();
}

function getServerSnapshot(): boolean {
  return false;
}

/** Hook reattivo: true solo in questa sessione dopo password corretta. */
export function useIsAdmin(): boolean {
  return useSyncExternalStore(subscribeAdmin, getAdminSnapshot, getServerSnapshot);
}

export function useLockAdmin(): () => void {
  return useCallback(() => lockAdmin(), []);
}
