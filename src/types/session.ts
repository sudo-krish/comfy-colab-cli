/**
 * Colab Session and VM shape definitions
 */

export type GpuType = 'T4' | 'L4' | 'A100' | 'H100' | 'CPU';

export const VALID_GPU_TYPES: readonly GpuType[] = ['T4', 'L4', 'A100', 'H100', 'CPU'];

export function isGpuType(val: unknown): val is GpuType {
  return typeof val === 'string' && VALID_GPU_TYPES.includes(val as GpuType);
}

export type TunnelProvider = 'none' | 'cloudflared' | 'ngrok' | 'localtunnel';

export interface ColabSessionConfig {
  sessionName?: string;
  gpu?: GpuType;
  highMem?: boolean;
  ttlMinutes?: number;
  tunnel?: TunnelProvider;
  autoTerminate?: boolean;
}

export interface ColabSessionInfo {
  sessionName: string;
  status: 'active' | 'starting' | 'stopped' | 'unknown';
  accelerator?: string;
  uptimeSeconds?: number;
}

export interface ColabUsageInfo {
  computeUnitsBalance: number;
  usageRatePerHour?: number;
  isEntitled: boolean;
  rawText: string;
}
