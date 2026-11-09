/**
 * ComfyUI workflow, prompt, job status, and history schemas
 */

export interface ComfyNodeInput {
  [key: string]: unknown;
}

export interface ComfyNode {
  inputs: ComfyNodeInput;
  class_type: string;
  _meta?: {
    title?: string;
  };
}

export type ComfyApiWorkflow = Record<string, ComfyNode>;

export interface PromptSubmissionResponse {
  prompt_id: string;
  number: number;
  node_errors?: Record<string, unknown>;
  error?: string;
}

export type JobState = 'queued' | 'running' | 'success' | 'error';

export const VALID_JOB_STATES: readonly JobState[] = ['queued', 'running', 'success', 'error'];

export function isJobState(val: unknown): val is JobState {
  return typeof val === 'string' && VALID_JOB_STATES.includes(val as JobState);
}

export interface OutputFileInfo {
  filename: string;
  subfolder: string;
  type: string;
}

export interface JobStatusFile {
  jobId: string;
  promptId: string;
  state: JobState;
  progressPercent: number;
  currentNode: string | null;
  outputs: OutputFileInfo[];
  error?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ComfyHistoryEntry {
  prompt: [number, string, ComfyApiWorkflow, Record<string, unknown>, string[]];
  outputs: Record<
    string,
    { images?: OutputFileInfo[]; videos?: OutputFileInfo[]; gifs?: OutputFileInfo[] }
  >;
  status: {
    status_str: 'success' | 'error';
    completed: boolean;
    messages: unknown[];
  };
}

export type ComfyHistoryResponse = Record<string, ComfyHistoryEntry>;

export interface ComfyQueueResponse {
  queue_running: unknown[];
  queue_pending: unknown[];
}
