import { describe, it, expect, vi } from 'vitest';
import { runOrchestration } from '../src/executor/orchestrator.js';
import { ColabCliClient } from '../src/colab/client.js';

describe('Workflow Orchestrator', () => {
  it('executes end-to-end orchestration with golden template and hotCache', async () => {
    const client = new ColabCliClient();
    vi.spyOn(client, 'listSessions').mockResolvedValue([
      { sessionName: 'comfy-session', status: 'active' },
    ]);

    vi.spyOn(client, 'execCode').mockImplementation(async code => {
      if (code.includes('buildSubmitScript') || code.includes('127.0.0.1:8188/prompt')) {
        return {
          stdout: JSON.stringify({ ok: true, prompt_id: 'p_test', job_id: 'j_test' }),
          stderr: '',
          exitCode: 0,
        };
      }
      if (code.includes('job_status') || code.includes('/tmp/job_')) {
        return {
          stdout: JSON.stringify({
            state: 'success',
            outputs: [{ filename: 'render.png', type: 'output' }],
          }),
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: 'ok', stderr: '', exitCode: 0 };
    });

    vi.spyOn(client, 'download').mockResolvedValue({
      stdout: 'downloaded',
      stderr: '',
      exitCode: 0,
    });

    vi.spyOn(client, 'stopSession').mockResolvedValue({
      stdout: 'stopped',
      stderr: '',
      exitCode: 0,
    });

    const result = await runOrchestration(
      {
        templateName: 'flux',
        hotCache: 'flux1-dev.safetensors',
        overrides: ['6.inputs.steps=30'],
        ephemeral: true,
      },
      client,
    );

    expect(result.ok).toBe(true);
    expect(result.cloudWiped).toBe(true);
    expect(result.sessionTerminated).toBe(true);
  });

  it('runs orchestration with prompt and lora parameters', async () => {
    const client = new ColabCliClient();
    vi.spyOn(client, 'listSessions').mockResolvedValue([
      { sessionName: 'comfy-session', status: 'active' },
    ]);

    vi.spyOn(client, 'execCode').mockImplementation(async code => {
      if (code.includes('buildSubmitScript') || code.includes('127.0.0.1:8188/prompt')) {
        return {
          stdout: JSON.stringify({ ok: true, prompt_id: 'p_abc', job_id: 'j_abc' }),
          stderr: '',
          exitCode: 0,
        };
      }
      if (code.includes('job_status') || code.includes('/tmp/job_')) {
        return {
          stdout: JSON.stringify({
            state: 'success',
            outputs: [],
          }),
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: 'ok', stderr: '', exitCode: 0 };
    });

    const result = await runOrchestration(
      {
        prompt: 'a glowing neon landscape',
        loraFlag: 'cyberpunk:0.8',
      },
      client,
    );

    expect(result.ok).toBe(true);
    expect(result.sessionTerminated).toBe(false);
  });

  it('automatically starts session if none is active', async () => {
    const client = new ColabCliClient();
    vi.spyOn(client, 'listSessions')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ sessionName: 'comfy-session', status: 'active' }]);
    vi.spyOn(client, 'createSession').mockResolvedValue({
      stdout: 'created',
      stderr: '',
      exitCode: 0,
    });
    vi.spyOn(client, 'mountDrive').mockResolvedValue({
      stdout: 'mounted',
      stderr: '',
      exitCode: 0,
    });
    vi.spyOn(client, 'execCode').mockImplementation(async code => {
      if (code.includes('127.0.0.1:8188/prompt')) {
        return {
          stdout: JSON.stringify({ ok: true, prompt_id: 'p_auto', job_id: 'j_auto' }),
          stderr: '',
          exitCode: 0,
        };
      }
      if (code.includes('/tmp/job_')) {
        return {
          stdout: JSON.stringify({ state: 'success', outputs: [] }),
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: 'ok', stderr: '', exitCode: 0 };
    });

    const result = await runOrchestration({ prompt: 'test auto-start' }, client);
    expect(result.ok).toBe(true);
  });
});
