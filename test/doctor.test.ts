import { describe, expect, it } from 'vitest';
import {
  checkNodeVersion,
  checkOsPlatform,
  checkUvBinary,
  checkColabBinary,
  checkColabAuth,
  checkVaultStatus,
  parseComputeQuota,
  runDoctor,
  formatDoctorReport,
} from '../src/doctor/doctor.js';

describe('Doctor Diagnostic Checks', () => {
  it('checks Node version', () => {
    const result = checkNodeVersion();
    expect(result.id).toBe('node_version');
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Node.js');
  });

  it('checks OS platform', () => {
    const result = checkOsPlatform();
    expect(result.id).toBe('os_platform');
    expect(['pass', 'warn']).toContain(result.status);
  });

  it('checks uv and colab binary presence', () => {
    const uvCheck = checkUvBinary();
    expect(uvCheck.id).toBe('uv_binary');
    expect(['pass', 'fail']).toContain(uvCheck.status);

    const colabCheck = checkColabBinary();
    expect(colabCheck.id).toBe('colab_binary');
    expect(['pass', 'fail']).toContain(colabCheck.status);
  });

  it('checks Colab auth and vault status', () => {
    const authCheck = checkColabAuth();
    expect(authCheck.id).toBe('colab_auth');
    expect(['pass', 'warn']).toContain(authCheck.status);

    const vaultCheck = checkVaultStatus();
    expect(vaultCheck.id).toBe('vault_status');
    expect(['pass', 'warn']).toContain(vaultCheck.status);
  });

  it('handles simulated platform and node versions', () => {
    const originalVersion = process.versions.node;
    const originalPlatform = process.platform;

    try {
      Object.defineProperty(process.versions, 'node', { value: '18.12.0', configurable: true });
      const nodeCheck = checkNodeVersion();
      expect(nodeCheck.status).toBe('fail');
      expect(nodeCheck.fixRecommendation).toBeDefined();

      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      const osCheck = checkOsPlatform();
      expect(osCheck.status).toBe('warn');
      expect(osCheck.fixRecommendation).toBeDefined();
    } finally {
      Object.defineProperty(process.versions, 'node', {
        value: originalVersion,
        configurable: true,
      });
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });

  it('parses compute quota correctly', () => {
    const text1 = 'Compute unit balance: 142.50 units\nUsage rate: 2.1 units/hr';
    const quota1 = parseComputeQuota(text1);
    expect(quota1.computeUnitsBalance).toBe(142.5);
    expect(quota1.usageRatePerHour).toBe(2.1);
    expect(quota1.isEntitled).toBe(true);

    const text2 = 'Available: 0.0 units';
    const quota2 = parseComputeQuota(text2);
    expect(quota2.computeUnitsBalance).toBe(0.0);
    expect(quota2.isEntitled).toBe(false);

    const textEmpty = 'No quota information';
    const quotaEmpty = parseComputeQuota(textEmpty);
    expect(quotaEmpty.computeUnitsBalance).toBe(0.0);
    expect(quotaEmpty.isEntitled).toBe(false);
  });

  it('runs complete doctor check and formats report', () => {
    const report = runDoctor();
    expect(report.checks.length).toBeGreaterThanOrEqual(6);
    expect(report.platform).toBeDefined();

    const formatted = formatDoctorReport(report);
    expect(formatted).toContain('comfy-colab Environment Doctor');
    expect(formatted).toContain('Node.js Runtime Version');
  });

  it('formats warning and failure recommendations correctly', () => {
    const dummyReport = {
      timestamp: '2026-11-09T00:00:00Z',
      platform: 'linux x64',
      healthy: false,
      checks: [
        {
          id: 'test_fail',
          name: 'Dummy Fail',
          status: 'fail' as const,
          message: 'failed check',
          fixRecommendation: 'Run fix command',
        },
        {
          id: 'test_warn',
          name: 'Dummy Warn',
          status: 'warn' as const,
          message: 'warn check',
          fixRecommendation: 'Review warning',
        },
        {
          id: 'test_pass',
          name: 'Dummy Pass',
          status: 'pass' as const,
          message: 'all good',
        },
      ],
    };

    const formatted = formatDoctorReport(dummyReport);
    expect(formatted).toContain('[FAIL]  Dummy Fail: failed check');
    expect(formatted).toContain('Recommendation: Run fix command');
    expect(formatted).toContain('[WARN]  Dummy Warn: warn check');
    expect(formatted).toContain('Recommendation: Review warning');
    expect(formatted).toContain('[PASS]  Dummy Pass: all good');
  });
});
