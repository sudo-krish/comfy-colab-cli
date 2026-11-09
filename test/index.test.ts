import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import { ComfyColabClient, VERSION } from '../src/index.js';
import { runCli } from '../src/cli.js';

describe('ComfyColabClient', () => {
  it('initializes with default options', () => {
    const client = new ComfyColabClient();
    const config = client.getConfig();

    expect(config.gpuType).toBe('T4');
    expect(config.timeoutMinutes).toBe(60);
    expect(config.autoTerminate).toBe(true);
    expect(config.tunnelProvider).toBe('cloudflared');
  });

  it('respects custom configuration overrides', () => {
    const client = new ComfyColabClient({
      gpuType: 'A100',
      timeoutMinutes: 120,
      autoTerminate: false,
      tunnelProvider: 'ngrok',
    });
    const config = client.getConfig();

    expect(config.gpuType).toBe('A100');
    expect(config.timeoutMinutes).toBe(120);
    expect(config.autoTerminate).toBe(false);
    expect(config.tunnelProvider).toBe('ngrok');
  });

  it('generates a valid Colab notebook script', () => {
    const client = new ComfyColabClient({ gpuType: 'A100' });
    const script = client.generateColabNotebookScript();

    expect(script).toContain('# GPU Target: A100');
    expect(script).toContain('!git clone https://github.com/comfyanonymous/ComfyUI.git');
  });

  it('prepares workflow job payloads', () => {
    const client = new ComfyColabClient();
    const workflow = { prompt: { 1: { class_type: 'KSampler' } } };
    const job = client.prepareWorkflow(workflow);

    expect(job.id).toMatch(/^job_/);
    expect(job.workflow).toEqual(workflow);
    expect(job.createdAt).toBeGreaterThan(0);
  });

  it('rejects invalid workflow payloads', () => {
    const client = new ComfyColabClient();

    expect(() => client.prepareWorkflow(null as unknown as Record<string, unknown>)).toThrow(
      TypeError,
    );
    expect(() => client.prepareWorkflow([] as unknown as Record<string, unknown>)).toThrow(
      TypeError,
    );
  });

  it('parses session status correctly', () => {
    const client = new ComfyColabClient();

    const status1 = client.parseStatus({
      running: true,
      gpu: 'A100',
      uptime: 3600,
      url: 'https://foo.trycloudflare.com',
    });
    expect(status1.active).toBe(true);
    expect(status1.gpuType).toBe('A100');
    expect(status1.uptimeSeconds).toBe(3600);
    expect(status1.tunnelUrl).toBe('https://foo.trycloudflare.com');

    const status2 = client.parseStatus({});
    expect(status2.active).toBe(false);
    expect(status2.gpuType).toBe('T4');
    expect(status2.uptimeSeconds).toBe(0);
    expect(status2.tunnelUrl).toBeNull();
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

  it('prints version with --version flag', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = runCli(['--version']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalledWith(`v${VERSION}\n`);
    writeSpy.mockRestore();
  });

  it('prints startup script with init command', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = runCli(['init']);

    expect(code).toBe(0);
    expect(writeSpy).toHaveBeenCalled();
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
