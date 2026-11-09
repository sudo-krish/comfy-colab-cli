#!/usr/bin/env node

import process from 'node:process';
import { ComfyColabClient, VERSION } from './index.js';

export function runCli(args: string[] = process.argv.slice(2)): number {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`comfy-colab v${VERSION}\n\n`);
    process.stdout.write('Usage:\n');
    process.stdout.write('  comfy-colab [command] [options]\n\n');
    process.stdout.write('Commands:\n');
    process.stdout.write('  init       Generate startup script for Google Colab\n');
    process.stdout.write('  version    Display current version\n');
    process.stdout.write('  help       Show this help menu\n\n');
    return 0;
  }

  if (args.includes('--version') || args.includes('-v') || args.includes('version')) {
    process.stdout.write(`v${VERSION}\n`);
    return 0;
  }

  const client = new ComfyColabClient();
  if (args.includes('init')) {
    process.stdout.write(client.generateColabNotebookScript() + '\n');
    return 0;
  }

  process.stdout.write(`comfy-colab v${VERSION}. Run with --help for usage.\n`);
  return 0;
}

if (process.env['NODE_ENV'] !== 'test' && !process.env['VITEST']) {
  runCli();
}
