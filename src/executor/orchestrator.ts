import fs from 'node:fs';
import { ColabCliClient } from '../colab/client.js';
import { ColabLifecycleManager } from '../colab/lifecycle.js';
import { ComfyWorkflowRunner } from './runner.js';
import { buildImageWorkflow, parseLoraFlag } from '../workflow/builder.js';
import { getGoldenTemplate } from '../workflow/templates.js';
import { applyWorkflowOverrides } from '../workflow/overrides.js';
import { buildHotCacheScript } from '../storage/models.js';
import { DEFAULT_OUTPUTS_DIR } from '../config/constants.js';
import type { ComfyApiWorkflow } from '../types/workflow.js';
import type { GpuType } from '../types/session.js';

export interface OrchestrationOptions {
  prompt?: string;
  negativePrompt?: string;
  templateName?: string;
  workflowFile?: string;
  model?: string;
  loraFlag?: string;
  overrides?: string[];
  outputDir?: string;
  sessionName?: string;
  ephemeral?: boolean;
  gpu?: GpuType;
  hotCache?: string;
}

export interface OrchestrationResult {
  ok: boolean;
  jobId: string;
  outputs: string[];
  cloudWiped: boolean;
  sessionTerminated: boolean;
  error?: string;
}

function loadWorkflowFromFile(filePath: string): ComfyApiWorkflow | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as ComfyApiWorkflow;
    }
  } catch {
    return null;
  }
  return null;
}

function resolveBaseWorkflow(options: OrchestrationOptions): ComfyApiWorkflow {
  if (options.workflowFile) {
    const fromFile = loadWorkflowFromFile(options.workflowFile);
    if (fromFile) {
      return fromFile;
    }
  }

  if (options.templateName) {
    const golden = getGoldenTemplate(options.templateName);
    if (golden) {
      return golden;
    }
  }

  const loras = options.loraFlag ? parseLoraFlag(options.loraFlag) : [];
  return buildImageWorkflow({
    prompt: options.prompt || 'a majestic landscape, photorealistic, 8k',
    negativePrompt: options.negativePrompt,
    model: options.model,
    loras,
  });
}

export async function runOrchestration(
  options: OrchestrationOptions,
  client?: ColabCliClient,
): Promise<OrchestrationResult> {
  const colabClient = client ?? new ColabCliClient();
  const lifecycle = new ColabLifecycleManager(colabClient);
  const runner = new ComfyWorkflowRunner(colabClient);

  if (options.hotCache) {
    const hotScript = buildHotCacheScript(options.hotCache);
    await colabClient.execCode(hotScript, options.sessionName, 30);
  }

  let workflow = resolveBaseWorkflow(options);
  if (options.overrides && options.overrides.length > 0) {
    workflow = applyWorkflowOverrides(workflow, options.overrides);
  }

  const result = await runner.run({
    sessionName: options.sessionName,
    workflow,
    outputsDir: options.outputDir || DEFAULT_OUTPUTS_DIR,
  });

  let sessionTerminated = false;
  if (options.ephemeral) {
    const stopRes = await lifecycle.stop(options.sessionName);
    sessionTerminated = stopRes.ok;
  }

  return {
    ok: result.ok,
    jobId: result.jobId,
    outputs: result.downloadedFiles,
    cloudWiped: result.cloudWiped,
    sessionTerminated,
    error: result.error,
  };
}
