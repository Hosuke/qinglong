// This module contains no answer or answer verifier; AES-GCM authenticates decryption.
export function normalizeAnswer(s) {
  return s.normalize('NFKC')
    .replace(/[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/gu, '')
    .replaceAll('興', '兴');
}

function decodeBase64(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Invalid encrypted bundle encoding');
  }
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}

export async function decrypt(answer, encJson) {
  if (!encJson || encJson.v !== 1 || encJson.kdf !== 'PBKDF2-SHA256' || encJson.iter !== 600000) {
    throw new Error('Unsupported encrypted bundle');
  }
  const salt = decodeBase64(encJson.salt);
  const iv = decodeBase64(encJson.iv);
  const ciphertext = decodeBase64(encJson.ct);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) {
    throw new Error('Invalid encrypted bundle lengths');
  }
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(normalizeAnswer(answer)), 'PBKDF2', false, ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: encJson.iter },
    material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 }, key, ciphertext,
  );
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
}
