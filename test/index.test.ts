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

  it('prepares image workflow in text and json modes', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runCli(['image', '--prompt', 'cybernetic astronaut', '--lora', 'neon.safetensors:0.8']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] Image workflow prepared'),
    );

    runCli(['image', '--prompt', 'cybernetic astronaut', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "image"'));

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
