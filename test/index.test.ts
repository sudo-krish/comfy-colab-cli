import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import { ComfyColabClient, VERSION } from '../src/index.js';
import { runCli } from '../src/cli.js';

describe('ComfyColabClient', () => {
  it('generates a valid Colab notebook script', () => {
    const client = new ComfyColabClient();
    const script = client.generateColabNotebookScript();

    expect(script).toContain('!git clone https://github.com/comfyanonymous/ComfyUI.git');
    expect(script).toContain('!pip install -r ComfyUI/requirements.txt');
  });

  it('exports VERSION matching semver format', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('runCli', () => {
  it('prints help message with --help flag', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = runCli(['--help']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('prints help message in json mode with --help --json', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = runCli(['--help', '--json']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "help"'));
    writeSpy.mockRestore();
  });

  it('prints version with --version flag', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = runCli(['--version']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(`v${VERSION}\n`);
    writeSpy.mockRestore();
  });

  it('prints version in json mode with --version --json', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = runCli(['--version', '--json']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "version"'));
    writeSpy.mockRestore();
  });

  it('executes doctor command in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['doctor']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('comfy-colab Environment Doctor'),
    );

    runCli(['doctor', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "doctor"'));

    writeSpy.mockRestore();
  });

  it('executes auth command with tokens in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['auth', '--hf', 'hf_cli_token', '--civitai', 'civit_cli_key']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[SUCCESS]'));

    runCli(['auth', '--hf', 'hf_cli_token_2', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"hasHfToken": true'));

    runCli(['auth']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Vault Status:'));

    writeSpy.mockRestore();
  });

  it('executes skill install command in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['skill', 'install']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SUCCESS] AI agent skill installed'),
    );

    runCli(['skill', 'install', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "skill:install"'));

    writeSpy.mockRestore();
  });

  it('prepares image workflow in text and json modes with overrides', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli([
      'image',
      '--prompt',
      'cybernetic astronaut',
      '--lora',
      'neon.safetensors:0.8',
      '--set',
      '5.inputs.steps=30',
    ]);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] Image workflow prepared'),
    );

    runCli(['image', '--prompt', 'cybernetic astronaut', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "image"'));

    writeSpy.mockRestore();
  });

  it('prepares video workflow in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['video', '--prompt', 'drone flying over ocean', '--gpu', 'T4']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));

    runCli(['video', '--prompt', 'drone flying over ocean', '--gpu', 'L4', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "video"'));

    writeSpy.mockRestore();
  });

  it('handles models commands in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['models', 'list', '--type', 'checkpoints']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Models inventory ready'));

    runCli(['models', 'list', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "models:list"'));

    runCli(['models', 'pull', 'https://hf.co/model.safetensors', '--type', 'loras']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Model pull task ready'));

    runCli(['models', 'pull', 'https://hf.co/model.safetensors', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "models:pull"'));

    runCli(['models', 'upload', './my_lora.safetensors', '--type', 'loras']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] Model upload task ready'),
    );

    runCli(['models', 'upload', './my_lora.safetensors', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "models:upload"'));

    writeSpy.mockRestore();
  });

  it('handles snapshot commands in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['snapshot', 'save', 'my_backup']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Snapshot save prepared'));

    runCli(['snapshot', 'save', 'my_backup', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "snapshot:save"'));

    runCli(['snapshot', 'restore', '123_my_backup.json']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] Snapshot restore prepared'),
    );

    runCli(['snapshot', 'restore', '123_my_backup.json', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "snapshot:restore"'));

    writeSpy.mockRestore();
  });

  it('handles update command in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['update', '--target', 'cli']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Update initiated'));

    runCli(['update', '--target', 'all', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "update"'));

    writeSpy.mockRestore();
  });

  it('handles unknown commands with json envelope and error', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = runCli(['nonexistent-command', '--json']);
    expect(code).toBe(1);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('ERR_UNKNOWN_COMMAND'));

    writeSpy.mockRestore();
  });

  it('prints default usage message with no arguments', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = runCli([]);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining(`comfy-colab v${VERSION}. Run with --help for usage.`),
    );
    writeSpy.mockRestore();
  });
});
