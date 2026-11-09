/**
 * Diagnostic and doctor check definitions
 */

export type CheckStatus = 'pass' | 'fail' | 'warn';

export const VALID_CHECK_STATUSES: readonly CheckStatus[] = ['pass', 'fail', 'warn'];

export function isCheckStatus(val: unknown): val is CheckStatus {
  return typeof val === 'string' && VALID_CHECK_STATUSES.includes(val as CheckStatus);
}

export interface CheckItem {
  id: string;
  name: string;
  status: CheckStatus;
  message: string;
  fixRecommendation?: string;
}

export interface DoctorReport {
  timestamp: string;
  platform: string;
  healthy: boolean;
  checks: CheckItem[];
}
