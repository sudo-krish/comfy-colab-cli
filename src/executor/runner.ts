import fs from 'node:fs';
import path from 'node:path';
import { ColabCliClient } from '../colab/client.js';
import { DEFAULT_OUTPUTS_DIR } from '../config/constants.js';
import { buildSubmitScript, buildLongPollScript, buildPruneAndFreeScript } from './vm-scripts.js';
import type { ComfyApiWorkflow, JobStatusFile, OutputFileInfo } from '../types/workflow.js';

export interface ExecuteWorkflowOptions {
  sessionName?: string;
  workflow: ComfyApiWorkflow;
  outputsDir?: string;
  onProgress?: (status: JobStatusFile) => void;
  maxTotalWaitSeconds?: number;
}

export interface WorkflowResult {
  ok: boolean;
  jobId: string;
  promptId: string;
  downloadedFiles: string[];
  cloudWiped: boolean;
  error?: string;
}

interface SubmitResult {
  ok: boolean;
  promptId: string;
  error?: string;
}

async function submitJob(
  client: ColabCliClient,
  workflow: ComfyApiWorkflow,
  jobId: string,
  sessionName?: string,
): Promise<SubmitResult> {
  const submitScript = buildSubmitScript(JSON.stringify(workflow), jobId);
  const submitRes = await client.execCode(submitScript, sessionName);

  if (submitRes.exitCode !== 0 || !submitRes.stdout) {
    return {
      ok: false,
      promptId: '',
      error: submitRes.stderr || submitRes.stdout || 'Workflow submission failed',
    };
  }

  try {
    const parsed = JSON.parse(submitRes.stdout) as {
      ok: boolean;
      prompt_id?: string;
      error?: string;
    };
    if (!parsed.ok || !parsed.prompt_id) {
      return {
        ok: false,
        promptId: '',
        error: parsed.error || 'Failed to obtain prompt_id from ComfyUI',
      };
    }
    return { ok: true, promptId: parsed.prompt_id };
  } catch (err) {
    return {
      ok: false,
      promptId: '',
      error: `Failed to parse submit response: ${String(err)}`,
    };
  }
}

async function pollJobStatus(
  client: ColabCliClient,
  jobId: string,
  maxWaitSeconds: number,
  sessionName?: string,
  onProgress?: (status: JobStatusFile) => void,
): Promise<JobStatusFile | null> {
  const startTime = Date.now();
  let latestStatus: JobStatusFile | null = null;

  while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
    const pollScript = buildLongPollScript(jobId, 24);
    const pollRes = await client.execCode(pollScript, sessionName);

    if (pollRes.exitCode === 0 && pollRes.stdout) {
      try {
        const status = JSON.parse(pollRes.stdout) as JobStatusFile;
        latestStatus = status;
        if (onProgress) {
          onProgress(status);
        }
        if (status.state === 'success' || status.state === 'error') {
          break;
        }
      } catch {
        // Retry poll on transient output parse issues
      }
    }
  }
  return latestStatus;
}

async function downloadJobOutputs(
  client: ColabCliClient,
  outputs: OutputFileInfo[],
  outputsDir: string,
  sessionName?: string,
): Promise<string[]> {
  const downloadedFiles: string[] = [];
  for (const out of outputs) {
    const sub = out.subfolder ? `${out.subfolder}/` : '';
    const remotePath = `/content/ComfyUI/output/${sub}${out.filename}`;
    const localTarget = path.join(outputsDir, out.filename);

    const dlRes = await client.download(remotePath, localTarget, sessionName);
    if (dlRes.exitCode === 0 && fs.existsSync(localTarget)) {
      downloadedFiles.push(localTarget);
    }
  }
  return downloadedFiles;
}

export async function executeWorkflow(
  client: ColabCliClient,
  options: ExecuteWorkflowOptions,
): Promise<WorkflowResult> {
  const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const outputsDir = path.resolve(options.outputsDir || DEFAULT_OUTPUTS_DIR);
  fs.mkdirSync(outputsDir, { recursive: true });

  const submitRes = await submitJob(client, options.workflow, jobId, options.sessionName);
  if (!submitRes.ok) {
    return {
      ok: false,
      jobId,
      promptId: '',
      downloadedFiles: [],
      cloudWiped: false,
      error: submitRes.error,
    };
  }

  const promptId = submitRes.promptId;
  const maxWait = options.maxTotalWaitSeconds || 600;
  const latestStatus = await pollJobStatus(
    client,
    jobId,
    maxWait,
    options.sessionName,
    options.onProgress,
  );

  if (!latestStatus || latestStatus.state !== 'success') {
    return {
      ok: false,
      jobId,
      promptId,
      downloadedFiles: [],
      cloudWiped: false,
      error: latestStatus?.error || 'Generation timed out or ended with error',
    };
  }

  const downloadedFiles = await downloadJobOutputs(
    client,
    latestStatus.outputs || [],
    outputsDir,
    options.sessionName,
  );
  const pruneScript = buildPruneAndFreeScript(promptId, jobId);
  await client.execCode(pruneScript, options.sessionName);

  return {
    ok: true,
    jobId,
    promptId,
    downloadedFiles,
    cloudWiped: true,
  };
}
