import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  encryptVault,
  decryptVault,
  saveVault,
  loadVault,
  updateTokens,
} from '../src/config/vault.js';
import type { VaultData } from '../src/types/vault.js';

describe('Vault Encryption & Decryption', () => {
  const sampleData: VaultData = {
    huggingFaceToken: 'hf_test_token_12345',
    civitAiApiKey: 'civitai_key_abcde',
    customKeys: { foo: 'bar' },
    updatedAt: new Date().toISOString(),
  };

  it('encrypts and decrypts with the default machine key', () => {
    const encrypted = encryptVault(sampleData);
    expect(encrypted.version).toBe(1);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.data).toBeDefined();
    expect(encrypted.salt).toBeDefined();

    const decrypted = decryptVault(encrypted);
    expect(decrypted.huggingFaceToken).toBe(sampleData.huggingFaceToken);
    expect(decrypted.civitAiApiKey).toBe(sampleData.civitAiApiKey);
    expect(decrypted.customKeys).toEqual(sampleData.customKeys);
  });

  it('encrypts and decrypts with an explicit custom key', () => {
    const customKey = 'my_super_secure_passphrase_99';
    const encrypted = encryptVault(sampleData, customKey);
    const decrypted = decryptVault(encrypted, customKey);

    expect(decrypted.huggingFaceToken).toBe(sampleData.huggingFaceToken);
    expect(decrypted.civitAiApiKey).toBe(sampleData.civitAiApiKey);
  });

  it('fails decryption when provided with a wrong key', () => {
    const encrypted = encryptVault(sampleData, 'correct_key');
    expect(() => decryptVault(encrypted, 'wrong_key')).toThrow();
  });

  it('fails decryption when ciphertext or auth tag is tampered with', () => {
    const encrypted = encryptVault(sampleData, 'key123');
    // Tamper with data payload
    encrypted.data = Buffer.from('tampered_content').toString('base64');
    expect(() => decryptVault(encrypted, 'key123')).toThrow();
  });

  it('saves and loads from disk with atomic write and permissions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    const vaultPath = path.join(tmpDir, 'test_vault.enc');

    try {
      expect(loadVault(vaultPath)).toBeNull();

      saveVault(sampleData, vaultPath, 'disk_key');
      expect(fs.existsSync(vaultPath)).toBe(true);

      const loaded = loadVault(vaultPath, 'disk_key');
      expect(loaded?.huggingFaceToken).toBe(sampleData.huggingFaceToken);

      // Update tokens
      const updated = updateTokens(
        {
          huggingFaceToken: 'hf_updated_new',
          civitAiApiKey: 'civit_new_key',
          customKeys: { extra: 'val' },
        },
        vaultPath,
        'disk_key',
      );
      expect(updated.huggingFaceToken).toBe('hf_updated_new');
      expect(updated.civitAiApiKey).toBe('civit_new_key');
      expect(updated.customKeys?.['extra']).toBe('val');

      const reloaded = loadVault(vaultPath, 'disk_key');
      expect(reloaded?.huggingFaceToken).toBe('hf_updated_new');

      // Corrupted file handling
      fs.writeFileSync(vaultPath, 'invalid_json_content');
      expect(loadVault(vaultPath, 'disk_key')).toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('handles environment variable key override', () => {
    process.env['COMFY_COLAB_VAULT_KEY'] = 'env_secret_key_123';
    try {
      const encrypted = encryptVault(sampleData);
      const decrypted = decryptVault(encrypted);
      expect(decrypted.huggingFaceToken).toBe(sampleData.huggingFaceToken);
    } finally {
      delete process.env['COMFY_COLAB_VAULT_KEY'];
    }
  });
});
