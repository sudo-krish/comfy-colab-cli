#!/usr/bin/env node

import process from 'node:process';
import { runDoctor, formatDoctorReport } from './doctor/doctor.js';
import { updateTokens, loadVault } from './config/vault.js';
import { installSkill } from './skill/installer.js';
import { buildImageWorkflow, parseLoraFlag } from './workflow/builder.js';
import { VERSION } from './index.js';
import type { AgentEnvelope } from './types/envelope.js';

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
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
  process.stdout.write(
    '  image               Generate image from prompt with optional LoRA chain\n',
  );
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

  const workflow = buildImageWorkflow({
    prompt,
    negativePrompt: negative,
    model,
    loras,
  });

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

export function runCli(args: string[] = process.argv.slice(2)): number {
  const isJson = hasFlag(args, '--json');

  if (isHelpRequested(args)) {
    return handleHelpCommand(isJson);
  }
  if (isVersionRequested(args)) {
    return handleVersionCommand(isJson);
  }

  const cmd = args[0] || '';
  switch (cmd) {
    case 'doctor':
      return handleDoctorCommand(isJson);
    case 'auth':
      return handleAuthCommand(args, isJson);
    case 'skill':
      return handleSkillCommand(args, isJson);
    case 'image':
      return handleImageCommand(args, isJson);
    default:
      return handleUnknown(cmd, isJson);
  }
}

if (process.env['NODE_ENV'] !== 'test' && !process.env['VITEST']) {
  runCli();
}
