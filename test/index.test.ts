import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import { ComfyColabClient, VERSION } from '../src/index.js';
import { runCli } from '../src/cli.js';
import { ColabLifecycleManager } from '../src/colab/lifecycle.js';
import * as orchestratorModule from '../src/executor/orchestrator.js';

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
  it('prints help message with --help flag', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await runCli(['--help']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('prints help message in json mode with --help --json', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await runCli(['--help', '--json']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "help"'));
    writeSpy.mockRestore();
  });

  it('prints version with --version flag', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await runCli(['--version']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(`v${VERSION}\n`);
    writeSpy.mockRestore();
  });

  it('prints version in json mode with --version --json', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await runCli(['--version', '--json']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "version"'));
    writeSpy.mockRestore();
  });

  it('executes doctor command in text and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['doctor']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('comfy-colab Environment Doctor'),
    );

    await runCli(['doctor', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "doctor"'));

    writeSpy.mockRestore();
  });

  it('manages vault tokens with auth command', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['auth', '--hf', 'hf_cli_token', '--civitai', 'civit_cli_key']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[SUCCESS] Tokens successfully'));

    await runCli(['auth', '--hf', 'hf_cli_token_2', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "auth"'));

    await runCli(['auth']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Vault Status:'));

    writeSpy.mockRestore();
  });

  it('handles setup command in text and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['setup']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Storage setup'));

    await runCli(['setup', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "setup"'));

    writeSpy.mockRestore();
  });

  it('handles skill command in text and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['skill', 'install']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SUCCESS] AI agent skill installed'),
    );

    await runCli(['skill', 'install', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "skill:install"'));

    await runCli(['skill', 'unknown']);
    expect(writeSpy).toHaveBeenCalledWith('Usage:\n');

    writeSpy.mockRestore();
  });

  it('prepares image workflow with prompt, loras, and overrides', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli([
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

    await runCli(['image', '--prompt', 'cybernetic astronaut', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "image"'));

    writeSpy.mockRestore();
  });

  it('prepares video workflow in text and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['video', '--prompt', 'drone flying over ocean', '--gpu', 'T4']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));

    await runCli(['video', '--prompt', 'drone flying over ocean', '--gpu', 'L4', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "video"'));

    writeSpy.mockRestore();
  });

  it('handles models commands in text and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['models', 'list', '--type', 'checkpoints']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Models inventory ready'));

    await runCli(['models', 'list', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "models:list"'));

    await runCli(['models', 'pull', 'https://hf.co/model.safetensors', '--type', 'loras']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Model pull task ready'));

    await runCli(['models', 'pull', 'https://hf.co/model.safetensors', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "models:pull"'));

    await runCli(['models', 'upload', './my_lora.safetensors', '--type', 'loras']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] Model upload task ready'),
    );

    await runCli(['models', 'upload', './my_lora.safetensors', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "models:upload"'));

    await runCli(['models', 'unknown']);
    expect(writeSpy).toHaveBeenCalledWith('Usage:\n');

    writeSpy.mockRestore();
  });

  it('handles snapshot commands in text and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['snapshot', 'save', 'my_backup']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Snapshot save prepared'));

    await runCli(['snapshot', 'save', 'my_backup', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "snapshot:save"'));

    await runCli(['snapshot', 'restore', '123_my_backup.json']);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] Snapshot restore prepared'),
    );

    await runCli(['snapshot', 'restore', '123_my_backup.json', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "snapshot:restore"'));

    await runCli(['snapshot', 'unknown']);
    expect(writeSpy).toHaveBeenCalledWith('Usage:\n');

    writeSpy.mockRestore();
  });

  it('handles update commands in text and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runCli(['update', '--target', 'cli']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Update initiated'));

    await runCli(['update', '--target', 'all', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "update"'));

    writeSpy.mockRestore();
  });

  it(
    'handles up, stop, and sessions commands in dry-run, live, and json modes',
    async () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      // Dry-run mode for up and stop
      await runCli(['up', '--gpu', 'A100', '--ttl', '30', '--mount-drive', '--dry-run']);
      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DRY-RUN] Starting Colab environment'),
      );

      await runCli(['up', '--gpu', 'L4', '--dry-run', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "up"'));

      await runCli(['stop', '--session', 'my-sess', '--dry-run']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[DRY-RUN] Stop signal sent'));

      await runCli(['stop', '--dry-run', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "stop"'));

      // Live mode with spied lifecycle manager
      vi.spyOn(ColabLifecycleManager.prototype, 'start').mockResolvedValueOnce({
        ok: true,
        sessionName: 'live-sess',
        status: 'active',
        gpu: 'L4',
      });
      await runCli(['up', '--session', 'live-sess']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[SUCCESS] Colab environment'));

      vi.spyOn(ColabLifecycleManager.prototype, 'start').mockResolvedValueOnce({
        ok: false,
        status: 'error',
        details: 'Quota exhausted',
      });
      await runCli(['up', '--session', 'fail-sess']);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to start Colab'));

      vi.spyOn(ColabLifecycleManager.prototype, 'stop').mockResolvedValueOnce({
        ok: true,
        message: 'stopped',
      });
      await runCli(['stop', '--session', 'live-sess']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[SUCCESS] Colab session'));

      vi.spyOn(ColabLifecycleManager.prototype, 'stop').mockResolvedValueOnce({
        ok: false,
        message: 'Session not found',
      });
      await runCli(['stop', '--session', 'fail-sess']);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to stop session'));

      // Live mode in JSON
      vi.spyOn(ColabLifecycleManager.prototype, 'start').mockResolvedValueOnce({
        ok: true,
        sessionName: 'live-json-sess',
        status: 'active',
        gpu: 'L4',
      });
      await runCli(['up', '--session', 'live-json-sess', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "up"'));

      vi.spyOn(ColabLifecycleManager.prototype, 'start').mockResolvedValueOnce({
        ok: false,
        status: 'error',
        details: 'Quota exhausted',
      });
      await runCli(['up', '--session', 'fail-json-sess', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"ERR_SESSION_START"'));

      vi.spyOn(ColabLifecycleManager.prototype, 'stop').mockResolvedValueOnce({
        ok: true,
        message: 'stopped',
      });
      await runCli(['stop', '--session', 'live-json-sess', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "stop"'));

      vi.spyOn(ColabLifecycleManager.prototype, 'stop').mockResolvedValueOnce({
        ok: false,
        message: 'Not found',
      });
      await runCli(['stop', '--session', 'fail-json-sess', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"ERR_SESSION_STOP"'));

      await runCli(['sessions']);
      expect(writeSpy).toHaveBeenCalled();

      await runCli(['sessions', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "sessions"'));

      await runCli(['url']);
      expect(writeSpy).toHaveBeenCalled();

      await runCli(['url', '-s', 'test-sess', '--open']);
      expect(writeSpy).toHaveBeenCalled();

      await runCli(['url', '--json']);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "url"'));

      writeSpy.mockRestore();
      errSpy.mockRestore();
    },
    15000,
  );

  it('handles template and run commands in text, dry-run, live, and json modes', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await runCli(['template', 'list']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Available templates:'));

    await runCli(['template', 'list', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "template:list"'));

    await runCli(['template', 'show', 'flux']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("[INFO] Template 'flux'"));

    await runCli(['template', 'show', 'flux', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "template:show"'));

    await runCli(['template', 'show', 'nonexistent']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Template'));

    // Dry-run run command
    await runCli([
      'run',
      '--template',
      'flux',
      '--prompt',
      'a neon robot',
      '--ephemeral',
      '--dry-run',
    ]);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DRY-RUN] Run orchestration planned'),
    );

    await runCli(['run', '--template', 'flux', '--dry-run', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "run"'));

    // Live run command (mocked runOrchestration)
    vi.spyOn(orchestratorModule, 'runOrchestration').mockResolvedValueOnce({
      ok: true,
      jobId: 'j_live_123',
      outputs: ['./outputs/render.png'],
      cloudWiped: true,
      sessionTerminated: true,
    });
    await runCli(['run', '--template', 'flux', '--ephemeral']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Generation complete!'));

    vi.spyOn(orchestratorModule, 'runOrchestration').mockResolvedValueOnce({
      ok: false,
      jobId: '',
      outputs: [],
      cloudWiped: false,
      sessionTerminated: false,
      error: 'Colab connection timed out',
    });
    await runCli(['run', '--template', 'flux']);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Orchestration failed'));

    vi.spyOn(orchestratorModule, 'runOrchestration').mockResolvedValueOnce({
      ok: true,
      jobId: 'j_live_456',
      outputs: ['./outputs/render2.png'],
      cloudWiped: true,
      sessionTerminated: false,
    });
    await runCli(['run', '--template', 'flux', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "run"'));

    vi.spyOn(orchestratorModule, 'runOrchestration').mockResolvedValueOnce({
      ok: false,
      jobId: '',
      outputs: [],
      cloudWiped: false,
      sessionTerminated: false,
      error: 'OOM error',
    });
    await runCli(['run', '--template', 'flux', '--json']);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"ERR_RUN_FAILED"'));

    writeSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('handles unknown commands with json envelope and error', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await runCli(['nonexistent-command', '--json']);
    expect(code).toBe(1);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('ERR_UNKNOWN_COMMAND'));

    writeSpy.mockRestore();
  });

  it('prints default usage message with no arguments', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await runCli([]);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining(`comfy-colab v${VERSION}. Run with --help for usage.`),
    );
    writeSpy.mockRestore();
  });
});
