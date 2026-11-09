import { describe, expect, it } from 'vitest';
import {
  isGpuType,
  isJobState,
  isAgentEnvelope,
  isCheckStatus,
  isEncryptedPayload,
} from '../src/types/index.js';

describe('Runtime Type Guards', () => {
  it('validates GPU types correctly', () => {
    expect(isGpuType('T4')).toBe(true);
    expect(isGpuType('L4')).toBe(true);
    expect(isGpuType('A100')).toBe(true);
    expect(isGpuType('H100')).toBe(true);
    expect(isGpuType('CPU')).toBe(true);

    expect(isGpuType('RTX4090')).toBe(false);
    expect(isGpuType(null)).toBe(false);
    expect(isGpuType(123)).toBe(false);
  });

  it('validates Job states correctly', () => {
    expect(isJobState('queued')).toBe(true);
    expect(isJobState('running')).toBe(true);
    expect(isJobState('success')).toBe(true);
    expect(isJobState('error')).toBe(true);

    expect(isJobState('pending')).toBe(false);
    expect(isJobState(undefined)).toBe(false);
  });

  it('validates Agent Envelope structure', () => {
    expect(isAgentEnvelope({ ok: true, command: 'doctor' })).toBe(true);
    expect(
      isAgentEnvelope({ ok: false, command: 'image', error: { code: 'FAIL', message: 'err' } }),
    ).toBe(true);

    expect(isAgentEnvelope(null)).toBe(false);
    expect(isAgentEnvelope({ ok: 'not_a_boolean', command: 'doctor' })).toBe(false);
    expect(isAgentEnvelope({ ok: true })).toBe(false);
  });

  it('validates Check Status', () => {
    expect(isCheckStatus('pass')).toBe(true);
    expect(isCheckStatus('fail')).toBe(true);
    expect(isCheckStatus('warn')).toBe(true);

    expect(isCheckStatus('unknown')).toBe(false);
    expect(isCheckStatus(42)).toBe(false);
  });

  it('validates Encrypted Payload structure', () => {
    const valid = {
      version: 1,
      iv: 'iv_val',
      tag: 'tag_val',
      data: 'data_val',
      salt: 'salt_val',
    };
    expect(isEncryptedPayload(valid)).toBe(true);

    expect(isEncryptedPayload(null)).toBe(false);
    expect(isEncryptedPayload({ ...valid, version: 2 })).toBe(false);
    expect(isEncryptedPayload({ ...valid, data: 123 })).toBe(false);
  });
});
