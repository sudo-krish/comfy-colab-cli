import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { VAULT_FILE } from './constants.js';
import type { EncryptedPayload, VaultData } from '../types/vault.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;

function getMachineIdentifier(): string {
  try {
    if (fs.existsSync('/etc/machine-id')) {
      return fs.readFileSync('/etc/machine-id', 'utf8').trim();
    }
  } catch {
    // fallback if unreadable
  }
  return `${os.hostname()}_${os.userInfo().username}_comfy_colab_vault`;
}

export function deriveKey(salt: Buffer, customKey?: string): Buffer {
  const masterSecret = customKey || process.env['COMFY_COLAB_VAULT_KEY'] || getMachineIdentifier();
  return crypto.pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encryptVault(data: VaultData, customKey?: string): EncryptedPayload {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(salt, customKey);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

export function decryptVault(payload: EncryptedPayload, customKey?: string): VaultData {
  const salt = Buffer.from(payload.salt, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.data, 'base64');

  const key = deriveKey(salt, customKey);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as VaultData;
}

export function loadVault(vaultPath: string = VAULT_FILE, customKey?: string): VaultData | null {
  if (!fs.existsSync(vaultPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(vaultPath, 'utf8');
    const payload = JSON.parse(raw) as EncryptedPayload;
    return decryptVault(payload, customKey);
  } catch {
    return null;
  }
}

export function saveVault(
  data: VaultData,
  vaultPath: string = VAULT_FILE,
  customKey?: string,
): void {
  const dir = path.dirname(vaultPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const encrypted = encryptVault(data, customKey);
  const tmpFile = `${vaultPath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(encrypted, null, 2), {
    mode: 0o600,
    encoding: 'utf8',
  });
  fs.renameSync(tmpFile, vaultPath);
}

export function updateTokens(
  updates: {
    huggingFaceToken?: string;
    civitAiApiKey?: string;
    customKeys?: Record<string, string>;
  },
  vaultPath: string = VAULT_FILE,
  customKey?: string,
): VaultData {
  const current = loadVault(vaultPath, customKey) || {
    updatedAt: new Date().toISOString(),
  };

  if (updates.huggingFaceToken !== undefined) {
    current.huggingFaceToken = updates.huggingFaceToken;
  }
  if (updates.civitAiApiKey !== undefined) {
    current.civitAiApiKey = updates.civitAiApiKey;
  }
  if (updates.customKeys) {
    current.customKeys = { ...(current.customKeys || {}), ...updates.customKeys };
  }
  current.updatedAt = new Date().toISOString();

  saveVault(current, vaultPath, customKey);
  return current;
}
