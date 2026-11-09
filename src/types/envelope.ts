/**
 * Strict AI agent JSON envelope schema
 */

export interface AgentEnvelope<T = unknown> {
  ok: boolean;
  command: string;
  session_id?: string;
  compute_units_spent_est?: number;
  outputs?: string[];
  cloud_wiped?: boolean;
  runtime_status?: 'active' | 'terminated' | 'stopped' | 'unassigned' | 'idle';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function isAgentEnvelope(val: unknown): val is AgentEnvelope {
  return (
    typeof val === 'object' &&
    val !== null &&
    typeof (val as Record<string, unknown>)['ok'] === 'boolean' &&
    typeof (val as Record<string, unknown>)['command'] === 'string'
  );
}
