/**
 * Credential vault data structures
 */

export interface VaultData {
  huggingFaceToken?: string;
  civitAiApiKey?: string;
  customKeys?: Record<string, string>;
  updatedAt: string;
}

export interface EncryptedPayload {
  version: 1;
  iv: string; // Base64 encoded 12 bytes for AES-GCM
  tag: string; // Base64 encoded 16 bytes auth tag
  data: string; // Base64 encoded ciphertext
  salt: string; // Base64 encoded salt for PBKDF2
}

export function isEncryptedPayload(val: unknown): val is EncryptedPayload {
  return (
    typeof val === 'object' &&
    val !== null &&
    (val as Record<string, unknown>)['version'] === 1 &&
    typeof (val as Record<string, unknown>)['data'] === 'string' &&
    typeof (val as Record<string, unknown>)['iv'] === 'string' &&
    typeof (val as Record<string, unknown>)['tag'] === 'string' &&
    typeof (val as Record<string, unknown>)['salt'] === 'string'
  );
}
