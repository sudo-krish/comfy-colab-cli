import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import { COLAB_CONFIG_DIR, VAULT_FILE } from '../config/constants.js';
import { loadVault } from '../config/vault.js';
import type { CheckItem, DoctorReport } from '../types/doctor.js';
import type { ColabUsageInfo } from '../types/session.js';

function isCommandAvailable(cmd: string): boolean {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function checkNodeVersion(): CheckItem {
  const current = process.versions.node;
  const major = parseInt(current.split('.')[0] || '0', 10);
  const pass = major >= 20;

  return {
    id: 'node_version',
    name: 'Node.js Runtime Version',
    status: pass ? 'pass' : 'fail',
    message: `Node.js v${current} detected (minimum required: v20.0.0)`,
    fixRecommendation: pass
      ? undefined
      : 'Please upgrade your Node.js runtime to version 20 or higher.',
  };
}

export function checkOsPlatform(): CheckItem {
  const platform = os.platform();
  const pass = platform === 'linux' || platform === 'darwin';

  return {
    id: 'os_platform',
    name: 'Host Operating System',
    status: pass ? 'pass' : 'warn',
    message: `Running on platform '${platform}' (${os.release()})`,
    fixRecommendation: pass
      ? undefined
      : 'Linux or macOS is recommended for native Google Colab CLI compatibility.',
  };
}

export function checkUvBinary(): CheckItem {
  const available = isCommandAvailable('uv');
  return {
    id: 'uv_binary',
    name: 'Python UV Package Manager',
    status: available ? 'pass' : 'fail',
    message: available
      ? 'uv is installed and available in PATH'
      : 'uv executable was not found in PATH',
    fixRecommendation: available
      ? undefined
      : 'Install uv via: curl -LsSf https://astral.sh/uv/install.sh | sh',
  };
}

export function checkColabBinary(): CheckItem {
  const available = isCommandAvailable('colab');
  return {
    id: 'colab_binary',
    name: 'Google Colab CLI (colab)',
    status: available ? 'pass' : 'fail',
    message: available
      ? 'colab executable is installed in PATH'
      : 'colab executable was not found in PATH',
    fixRecommendation: available
      ? undefined
      : 'Install google-colab-cli via: uv tool install google-colab-cli',
  };
}

export function checkColabAuth(): CheckItem {
  const sessionsFile = `${COLAB_CONFIG_DIR}/sessions.json`;
  const oauthFile = `${os.homedir()}/.colab-cli-oauth-config.json`;
  const hasConfig = fs.existsSync(sessionsFile) || fs.existsSync(oauthFile);

  return {
    id: 'colab_auth',
    name: 'Google Colab Authentication',
    status: hasConfig ? 'pass' : 'warn',
    message: hasConfig
      ? 'Colab CLI session configuration detected'
      : 'Colab CLI is not yet authenticated with Google OAuth',
    fixRecommendation: hasConfig
      ? undefined
      : 'Run `comfy-colab auth` or `colab usage` to complete one-time OAuth.',
  };
}

export function checkVaultStatus(): CheckItem {
  const vaultExists = fs.existsSync(VAULT_FILE);
  const data = vaultExists ? loadVault() : null;
  const hasHf = Boolean(data?.huggingFaceToken);
  const hasCivit = Boolean(data?.civitAiApiKey);

  if (hasHf || hasCivit) {
    return {
      id: 'vault_status',
      name: 'Credential Vault (HuggingFace / CivitAI)',
      status: 'pass',
      message: `Vault active (${[hasHf && 'HuggingFace', hasCivit && 'CivitAI'].filter(Boolean).join(', ')})`,
    };
  }

  return {
    id: 'vault_status',
    name: 'Credential Vault (HuggingFace / CivitAI)',
    status: 'warn',
    message: vaultExists
      ? 'Vault exists but no tokens configured'
      : 'Vault has not yet been initialized',
    fixRecommendation:
      'Run `comfy-colab auth` to store tokens for gated models like Flux or Wan2.1.',
  };
}

export function parseComputeQuota(rawText: string): ColabUsageInfo {
  // Example colab usage output pattern:
  // "Compute unit balance: 100.5" or "Available: 45.2 compute units"
  const balanceMatch = rawText.match(/(?:balance|available|units?):\s*([0-9.]+)/i);
  const balance = balanceMatch && balanceMatch[1] ? parseFloat(balanceMatch[1]) : 0.0;

  const rateMatch = rawText.match(/([0-9.]+)\s*(?:units?\/hr|per hour)/i);
  const rate = rateMatch && rateMatch[1] ? parseFloat(rateMatch[1]) : undefined;

  return {
    computeUnitsBalance: balance,
    usageRatePerHour: rate,
    isEntitled: balance > 0,
    rawText,
  };
}

export function runDoctor(): DoctorReport {
  const checks: CheckItem[] = [
    checkNodeVersion(),
    checkOsPlatform(),
    checkUvBinary(),
    checkColabBinary(),
    checkColabAuth(),
    checkVaultStatus(),
  ];

  const healthy = checks.every(c => c.status !== 'fail');

  return {
    timestamp: new Date().toISOString(),
    platform: `${os.platform()} ${os.arch()}`,
    healthy,
    checks,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [
    '======================================================================',
    '                 comfy-colab Environment Doctor                      ',
    '======================================================================',
    `Platform:   ${report.platform}`,
    `Timestamp:  ${report.timestamp}`,
    `Overall:    ${report.healthy ? 'HEALTHY' : 'ISSUES DETECTED'}`,
    '----------------------------------------------------------------------',
  ];

  for (const check of report.checks) {
    const symbol =
      check.status === 'pass' ? '[PASS]' : check.status === 'warn' ? '[WARN]' : '[FAIL]';
    lines.push(`${symbol.padEnd(7)} ${check.name}: ${check.message}`);
    if (check.fixRecommendation && check.status !== 'pass') {
      lines.push(`        Recommendation: ${check.fixRecommendation}`);
    }
  }
  lines.push('======================================================================');
  return lines.join('\n');
}
