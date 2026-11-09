#!/usr/bin/env node

import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { runDoctor, formatDoctorReport } from './doctor/doctor.js';
import { updateTokens, loadVault } from './config/vault.js';
import { installSkill } from './skill/installer.js';
import { buildImageWorkflow, parseLoraFlag } from './workflow/builder.js';
import { buildVideoWorkflow, validateGpuForVideo } from './workflow/video.js';
import { applyWorkflowOverrides } from './workflow/overrides.js';
import {
  buildListModelsScript,
  buildPullModelScript,
  buildRefreshModelsScript,
} from './storage/models.js';
import {
  buildSaveSnapshotScript,
  buildRestoreSnapshotScript,
  buildUpdateScript,
} from './storage/snapshots.js';
import { generateBootstrapScript } from './storage/bootstrap.js';
import { REMOTE_DRIVE_STORE } from './config/constants.js';
import { listGoldenTemplates, getGoldenTemplate } from './workflow/templates.js';
import { VERSION } from './index.js';
import type { AgentEnvelope } from './types/envelope.js';
import type { GpuType } from './types/session.js';

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function getAllFlags(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    const item = args[i];
    const next = args[i + 1];
    if (item === flag && next) {
      values.push(next);
    }
  }
  return values;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function printJsonEnvelope<T>(envelope: AgentEnvelope<T>): void {
  process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
}

function handleHelpCommand(isJson: boolean): number {
  if (isJson) {
    printJsonEnvelope({ ok: true, command: 'help', data: { version: VERSION } });
    return 0;
  }
  process.stdout.write(`comfy-colab v${VERSION}\n\n`);
  process.stdout.write('Usage:\n');
  process.stdout.write('  comfy-colab <command> [options]\n\n');
  process.stdout.write('Commands:\n');
  process.stdout.write('  doctor              Verify environment, GPU quota, and dependencies\n');
  process.stdout.write('  auth                Configure HuggingFace token and CivitAI API key\n');
  process.stdout.write('  setup               Initialize persistent Google Drive storage tree\n');
  process.stdout.write('  up                  Spin up Colab VM with GPU, watchdog, and Drive\n');
  process.stdout.write('  stop                Terminate Colab session\n');
  process.stdout.write('  sessions            List active Colab sessions\n');
  process.stdout.write(
    '  url                 Print browser URL connecting to active Colab session\n',
  );
  process.stdout.write(
    '  image               Generate image from prompt with optional LoRA chain\n',
  );
  process.stdout.write('  video               Generate video from prompt or reference image\n');
  process.stdout.write('  template list|show  Inspect golden API workflow templates\n');
  process.stdout.write('  run                 Orchestrate end-to-end headless workflow run\n');
  process.stdout.write('  models list|pull    Manage models and checkpoints on Google Drive\n');
  process.stdout.write('  snapshot save|rest  Save or restore custom node workspace lockfiles\n');
  process.stdout.write('  update              Upgrade comfy-cli, colab-cli, or ComfyUI core\n');
  process.stdout.write('  skill install       Generate and install AI agent SKILL.md\n');
  process.stdout.write('  version             Display version\n');
  process.stdout.write('  help                Show this help menu\n\n');
  process.stdout.write('Flags:\n');
  process.stdout.write('  --json              Strict JSON envelope output for AI agents\n\n');
  return 0;
}

function handleVersionCommand(isJson: boolean): number {
  if (isJson) {
    printJsonEnvelope({ ok: true, command: 'version', data: { version: VERSION } });
  } else {
    process.stdout.write(`v${VERSION}\n`);
  }
  return 0;
}

function handleDoctorCommand(isJson: boolean): number {
  const report = runDoctor();
  if (isJson) {
    printJsonEnvelope({
      ok: report.healthy,
      command: 'doctor',
      data: report,
    });
  } else {
    process.stdout.write(formatDoctorReport(report) + '\n');
  }
  return report.healthy ? 0 : 1;
}

function applyAuthUpdates(hfToken?: string, civitKey?: string, isJson?: boolean): number {
  const updated = updateTokens({
    huggingFaceToken: hfToken,
    civitAiApiKey: civitKey,
  });
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'auth',
      data: {
        hasHfToken: Boolean(updated.huggingFaceToken),
        hasCivitKey: Boolean(updated.civitAiApiKey),
        updatedAt: updated.updatedAt,
      },
    });
  } else {
    process.stdout.write('[SUCCESS] Tokens successfully updated in encrypted vault.\n');
  }
  return 0;
}

function showAuthStatus(isJson?: boolean): number {
  const current = loadVault();
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'auth',
      data: {
        hasHfToken: Boolean(current?.huggingFaceToken),
        hasCivitKey: Boolean(current?.civitAiApiKey),
        updatedAt: current?.updatedAt,
      },
    });
  } else {
    process.stdout.write(`Vault Status: ${current ? 'Initialized' : 'Not configured'}\n`);
    process.stdout.write(
      `HuggingFace Token: ${current?.huggingFaceToken ? 'Configured' : 'Missing'}\n`,
    );
    process.stdout.write(
      `CivitAI API Key:   ${current?.civitAiApiKey ? 'Configured' : 'Missing'}\n`,
    );
    process.stdout.write('\nTo set tokens:\n  comfy-colab auth --hf <token> --civitai <key>\n');
  }
  return 0;
}

function handleAuthCommand(args: string[], isJson: boolean): number {
  const hfToken = getFlag(args, '--hf') || getFlag(args, '--huggingface');
  const civitKey = getFlag(args, '--civitai');
  if (hfToken || civitKey) {
    return applyAuthUpdates(hfToken, civitKey, isJson);
  }
  return showAuthStatus(isJson);
}

function handleSkillCommand(args: string[], isJson: boolean): number {
  if (args[1] === 'install') {
    const targetPath = getFlag(args, '--target');
    const savedPath = installSkill(targetPath);
    if (isJson) {
      printJsonEnvelope({
        ok: true,
        command: 'skill:install',
        data: { path: savedPath },
      });
    } else {
      process.stdout.write(`[SUCCESS] AI agent skill installed at: ${savedPath}\n`);
    }
    return 0;
  }
  return handleHelpCommand(isJson);
}

function handleImageCommand(args: string[], isJson: boolean): number {
  const prompt = getFlag(args, '--prompt') || 'a photo of an astronaut riding a horse on mars, 8k';
  const negative = getFlag(args, '--negative');
  const model = getFlag(args, '--model');
  const loraFlag = getFlag(args, '--lora');
  const loras = loraFlag ? parseLoraFlag(loraFlag) : [];
  const overrides = getAllFlags(args, '--set');

  let workflow = buildImageWorkflow({
    prompt,
    negativePrompt: negative,
    model,
    loras,
  });

  if (overrides.length > 0) {
    workflow = applyWorkflowOverrides(workflow, overrides);
  }

  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'image',
      data: {
        prompt,
        model: model || 'v1-5-pruned-emaonly.safetensors',
        loraCount: loras.length,
        workflowNodes: Object.keys(workflow).length,
      },
    });
  } else {
    process.stdout.write(
      `[INFO] Image workflow prepared (${Object.keys(workflow).length} nodes, ${loras.length} LoRAs).\n`,
    );
    process.stdout.write(`Prompt: ${prompt}\n`);
  }
  return 0;
}

function handleVideoCommand(args: string[], isJson: boolean): number {
  const prompt = getFlag(args, '--prompt') || 'cinematic drone flythrough of a neon city, 4k';
  const initImage = getFlag(args, '--init-image');
  const model = getFlag(args, '--model');
  const requestedGpu = (getFlag(args, '--gpu') || 'L4') as GpuType;

  const hwCheck = validateGpuForVideo(requestedGpu);
  if (!hwCheck.compatible && !isJson) {
    process.stdout.write(`[WARN] ${hwCheck.warning}\n`);
  }

  const workflow = buildVideoWorkflow({
    prompt,
    initImage,
    model,
  });

  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'video',
      data: {
        prompt,
        isVideo: true,
        recommendedGpu: requestedGpu,
        hasInitImage: Boolean(initImage),
        workflowNodes: Object.keys(workflow).length,
      },
    });
  } else {
    process.stdout.write(
      `[INFO] Video workflow prepared (${Object.keys(workflow).length} nodes).\n`,
    );
    process.stdout.write(`Prompt: ${prompt}\n`);
  }
  return 0;
}

function handleModelsList(args: string[], isJson: boolean): number {
  const typeFilter = getFlag(args, '--type');
  const script = buildListModelsScript(typeFilter);
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'models:list',
      data: { filter: typeFilter || 'all', hasScript: Boolean(script) },
    });
  } else {
    process.stdout.write(`[INFO] Models inventory ready. Filter: ${typeFilter || 'all'}\n`);
  }
  return 0;
}

function handleModelsPull(args: string[], isJson: boolean): number {
  const url = args[2] || '';
  const type = getFlag(args, '--type') || 'checkpoints';
  const vault = loadVault();
  const token = vault?.huggingFaceToken;
  const script = buildPullModelScript(url, type, token);
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'models:pull',
      data: { url, type, tokenPresent: Boolean(token), hasScript: Boolean(script) },
    });
  } else {
    process.stdout.write(`[INFO] Model pull task ready for '${url}' -> ${type}.\n`);
  }
  return 0;
}

function handleModelsUpload(args: string[], isJson: boolean): number {
  const localPath = args[2] || '';
  const type = getFlag(args, '--type') || 'loras';
  const refreshScript = buildRefreshModelsScript();
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'models:upload',
      data: { localPath, type, refreshScriptAvailable: Boolean(refreshScript) },
    });
  } else {
    process.stdout.write(`[INFO] Model upload task ready for '${localPath}' -> ${type}.\n`);
  }
  return 0;
}

function handleModelsCommand(args: string[], isJson: boolean): number {
  const sub = args[1] || 'list';
  if (sub === 'list') {
    return handleModelsList(args, isJson);
  }
  if (sub === 'pull') {
    return handleModelsPull(args, isJson);
  }
  if (sub === 'upload') {
    return handleModelsUpload(args, isJson);
  }
  return handleHelpCommand(isJson);
}

function handleSnapshotCommand(args: string[], isJson: boolean): number {
  const sub = args[1] || 'save';
  if (sub === 'save') {
    const name = args[2] || 'manual';
    buildSaveSnapshotScript(name);
    if (isJson) {
      printJsonEnvelope({ ok: true, command: 'snapshot:save', data: { name } });
    } else {
      process.stdout.write(`[INFO] Snapshot save prepared for '${name}'.\n`);
    }
    return 0;
  }
  if (sub === 'restore') {
    const filename = args[2] || '';
    buildRestoreSnapshotScript(filename);
    if (isJson) {
      printJsonEnvelope({ ok: true, command: 'snapshot:restore', data: { filename } });
    } else {
      process.stdout.write(`[INFO] Snapshot restore prepared for '${filename}'.\n`);
    }
    return 0;
  }
  return handleHelpCommand(isJson);
}

function handleUpdateCommand(args: string[], isJson: boolean): number {
  const target = (getFlag(args, '--target') || 'all') as 'cli' | 'comfy' | 'all';
  buildUpdateScript(target);
  if (isJson) {
    printJsonEnvelope({ ok: true, command: 'update', data: { target } });
  } else {
    process.stdout.write(`[INFO] Update initiated for target '${target}'.\n`);
  }
  return 0;
}

function handleUpCommand(args: string[], isJson: boolean): number {
  const gpu = (getFlag(args, '--gpu') || 'L4') as GpuType;
  const session = getFlag(args, '--session') || 'comfy-session';
  const ttl = Number(getFlag(args, '--ttl') || '20');
  const mountDrive = hasFlag(args, '--mount-drive');
  const bootstrap = hasFlag(args, '--bootstrap');

  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'up',
      data: { session, gpu, ttlMinutes: ttl, mountDrive, bootstrap },
    });
  } else {
    process.stdout.write(
      `[INFO] Starting Colab environment '${session}' (GPU: ${gpu}, TTL: ${ttl}m, Mount Drive: ${mountDrive}).\n`,
    );
  }
  return 0;
}

function handleStopCommand(args: string[], isJson: boolean): number {
  const session = getFlag(args, '--session') || getFlag(args, '-s') || 'all';
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'stop',
      data: { session },
    });
  } else {
    process.stdout.write(`[INFO] Stop signal sent for session '${session}'.\n`);
  }
  return 0;
}

function handleSessionsCommand(_args: string[], isJson: boolean): number {
  const res = spawnSync('colab', ['sessions'], { encoding: 'utf8' });
  const output = (res.stdout || res.stderr || res.error?.message || '').trim();
  if (isJson) {
    const active = output.length > 0 && !output.includes('No active sessions');
    printJsonEnvelope({
      ok: true,
      command: 'sessions',
      data: {
        output: output || 'No active sessions found.',
        active,
      },
    });
  } else {
    process.stdout.write(
      output ? `${output}\n` : '[colab] No active sessions found on server.\n',
    );
  }
  return 0;
}

function buildUrlArgs(args: string[]): string[] {
  const session = getFlag(args, '--session') || getFlag(args, '-s');
  const cmdArgs = ['url'];
  if (session) {
    cmdArgs.push('--session', session);
  }
  if (hasFlag(args, '--open')) {
    cmdArgs.push('--open');
  }
  return cmdArgs;
}

function printUrlOutput(output: string, isOk: boolean, isJson: boolean): void {
  if (isJson) {
    printJsonEnvelope({
      ok: isOk,
      command: 'url',
      data: { url: output },
    });
    return;
  }
  process.stdout.write(output ? `${output}\n` : '[colab] No active sessions found.\n');
}

function handleUrlCommand(args: string[], isJson: boolean): number {
  const cmdArgs = buildUrlArgs(args);
  const res = spawnSync('colab', cmdArgs, { encoding: 'utf8' });
  const output = (res.stdout || res.stderr || res.error?.message || '').trim();
  const isOk = res.status === 0;
  printUrlOutput(output, isOk, isJson);
  return isOk ? 0 : 1;
}

function handleTemplateCommand(args: string[], isJson: boolean): number {
  const sub = args[1] || 'list';
  if (sub === 'show') {
    const name = args[2] || 'flux';
    const template = getGoldenTemplate(name);
    if (isJson) {
      printJsonEnvelope({
        ok: Boolean(template),
        command: 'template:show',
        data: { name, template },
      });
    } else {
      process.stdout.write(
        template
          ? `[INFO] Template '${name}' (${Object.keys(template).length} nodes):\n${JSON.stringify(template, null, 2)}\n`
          : `[ERROR] Template '${name}' not found. Available: ${listGoldenTemplates().join(', ')}\n`,
      );
    }
    return template ? 0 : 1;
  }

  const templates = listGoldenTemplates();
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'template:list',
      data: { templates },
    });
  } else {
    process.stdout.write(`Available templates: ${templates.join(', ')}\n`);
  }
  return 0;
}

function handleRunCommand(args: string[], isJson: boolean): number {
  const prompt = getFlag(args, '--prompt') || 'a majestic cinematic landscape, photorealistic, 8k';
  const templateName = getFlag(args, '--template');
  const workflowFile = getFlag(args, '--workflow') || getFlag(args, '-w');
  const loraFlag = getFlag(args, '--lora');
  const overrides = getAllFlags(args, '--set');
  const outputDir = getFlag(args, '--output') || './outputs';
  const ephemeral = hasFlag(args, '--ephemeral');
  const hotCache = getFlag(args, '--hot-cache');

  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'run',
      data: {
        prompt,
        template: templateName || 'custom',
        hasWorkflowFile: Boolean(workflowFile),
        lora: loraFlag,
        overridesCount: overrides.length,
        outputDir,
        ephemeral,
        hotCache,
      },
    });
  } else {
    process.stdout.write(`[INFO] Run orchestration initiated for '${templateName || 'custom'}'.\n`);
    process.stdout.write(`Prompt: ${prompt}\n`);
    process.stdout.write(`Output directory: ${outputDir} (ephemeral: ${ephemeral})\n`);
  }
  return 0;
}

function handleSetupCommand(args: string[], isJson: boolean): number {
  const storePath = getFlag(args, '--path') || REMOTE_DRIVE_STORE;
  const script = generateBootstrapScript({ driveStorePath: storePath });
  if (isJson) {
    printJsonEnvelope({
      ok: true,
      command: 'setup',
      data: { storePath, scriptGenerated: Boolean(script) },
    });
  } else {
    process.stdout.write(`[INFO] Storage setup initialized for: ${storePath}\n`);
  }
  return 0;
}

type CommandHandler = (args: string[], isJson: boolean) => number;

const COMMAND_MAP: Record<string, CommandHandler> = {
  doctor: (_args, isJson) => handleDoctorCommand(isJson),
  auth: handleAuthCommand,
  setup: handleSetupCommand,
  skill: handleSkillCommand,
  image: handleImageCommand,
  video: handleVideoCommand,
  models: handleModelsCommand,
  snapshot: handleSnapshotCommand,
  update: handleUpdateCommand,
  up: handleUpCommand,
  stop: handleStopCommand,
  sessions: handleSessionsCommand,
  url: handleUrlCommand,
  template: handleTemplateCommand,
  run: handleRunCommand,
};

function isHelpRequested(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h') || args[0] === 'help';
}

function isVersionRequested(args: string[]): boolean {
  return args.includes('--version') || args.includes('-v') || args[0] === 'version';
}

function handleUnknown(cmd: string, isJson: boolean): number {
  if (isJson) {
    printJsonEnvelope({
      ok: false,
      command: cmd || 'unknown',
      error: {
        code: 'ERR_UNKNOWN_COMMAND',
        message: `Unknown command '${cmd}'. Run with --help for usage.`,
      },
    });
    return 1;
  }
  process.stdout.write(`comfy-colab v${VERSION}. Run with --help for usage.\n`);
  return 0;
}

function routeCommand(cmd: string, args: string[], isJson: boolean): number {
  if (Object.prototype.hasOwnProperty.call(COMMAND_MAP, cmd)) {
    const handler = COMMAND_MAP[cmd]!;
    return handler(args, isJson);
  }
  return handleUnknown(cmd, isJson);
}

export function runCli(args: string[] = process.argv.slice(2)): number {
  const isJson = hasFlag(args, '--json');

  if (isHelpRequested(args)) {
    return handleHelpCommand(isJson);
  }
  if (isVersionRequested(args)) {
    return handleVersionCommand(isJson);
  }

  const cmd = args[0] || '';
  return routeCommand(cmd, args, isJson);
}

if (process.env['NODE_ENV'] !== 'test' && !process.env['VITEST']) {
  runCli();
}
