import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { ColabCliClient } from '../src/colab/client.js';
import {
  buildSubmitScript,
  buildLongPollScript,
  buildPruneAndFreeScript,
} from '../src/executor/vm-scripts.js';
import { executeWorkflow } from '../src/executor/runner.js';

describe('Workflow Executor & VM Scripts', () => {
  it('generates submit script', () => {
    const script = buildSubmitScript('{"1":{"class_type":"Test"}}', 'job123');
    expect(script).toContain('http://127.0.0.1:8188/prompt');
    expect(script).toContain('JOB_ID = "job123"');
    expect(script).toContain('STATUS_FILE = f"/tmp/job_{JOB_ID}.status"');
    expect(script).toContain('prompt_id');
  });

  it('generates long-poll script', () => {
    const script = buildLongPollScript('job123', 20);
    expect(script).toContain('job_job123.status');
    expect(script).toContain('MAX_WAIT = 20');
  });

  it('generates prune and free script', () => {
    const script = buildPruneAndFreeScript('prompt99', 'job123');
    expect(script).toContain('http://127.0.0.1:8188/history');
    expect(script).toContain('http://127.0.0.1:8188/free');
    expect(script).toContain('/content/ComfyUI/output/job_job123');
  });

  it('executes end-to-end workflow lifecycle with mocked Colab client', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-test-'));
    const dummyImage = path.join(tmpDir, 'test_output.png');
    fs.writeFileSync(dummyImage, 'fake_png_data');

    const client = new ColabCliClient('mock-colab');

    vi.spyOn(client, 'execCode').mockImplementation(async code => {
      if (code.includes('http://127.0.0.1:8188/prompt')) {
        return {
          stdout: JSON.stringify({ ok: true, prompt_id: 'p_12345', job_id: 'j_123' }),
          stderr: '',
          exitCode: 0,
        };
      }
      if (code.includes('MAX_WAIT')) {
        return {
          stdout: JSON.stringify({
            jobId: 'j_123',
            promptId: 'p_12345',
            state: 'success',
            progressPercent: 100,
            outputs: [{ filename: 'test_output.png', subfolder: '', type: 'output' }],
          }),
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: JSON.stringify({ ok: true }), stderr: '', exitCode: 0 };
    });

    vi.spyOn(client, 'download').mockResolvedValue({
      stdout: 'downloaded',
      stderr: '',
      exitCode: 0,
    });

    try {
      const res = await executeWorkflow(client, {
        workflow: { '1': { class_type: 'TestNode', inputs: {} } },
        outputsDir: tmpDir,
      });

      expect(res.ok).toBe(true);
      expect(res.promptId).toBe('p_12345');
      expect(res.cloudWiped).toBe(true);
      expect(res.downloadedFiles).toContain(dummyImage);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('handles submission errors and failure states in executeWorkflow', async () => {
    const client = new ColabCliClient('mock-colab');

    // 1. Non-zero exit code on submit
    vi.spyOn(client, 'execCode').mockResolvedValueOnce({
      stdout: '',
      stderr: 'Connection refused to 8188',
      exitCode: 1,
    });
    const res1 = await executeWorkflow(client, {
      workflow: { '1': { class_type: 'Test', inputs: {} } },
    });
    expect(res1.ok).toBe(false);
    expect(res1.error).toContain('Connection refused');

    // 2. ComfyUI rejection (400 bad workflow)
    vi.spyOn(client, 'execCode').mockResolvedValueOnce({
      stdout: JSON.stringify({ ok: false, error: 'ComfyUI prompt rejected' }),
      stderr: '',
      exitCode: 0,
    });
    const res2 = await executeWorkflow(client, {
      workflow: { '1': { class_type: 'BadNode', inputs: {} } },
    });
    expect(res2.ok).toBe(false);
    expect(res2.error).toContain('ComfyUI prompt rejected');

    // 3. Invalid json on submit
    vi.spyOn(client, 'execCode').mockResolvedValueOnce({
      stdout: 'not_valid_json_response',
      stderr: '',
      exitCode: 0,
    });
    const res3 = await executeWorkflow(client, {
      workflow: { '1': { class_type: 'Test', inputs: {} } },
    });
    expect(res3.ok).toBe(false);
    expect(res3.error).toContain('Failed to parse submit response');

    // 4. Polling returns error state with subfolder
    vi.spyOn(client, 'execCode')
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ ok: true, prompt_id: 'p_err', job_id: 'j_err' }),
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          jobId: 'j_err',
          promptId: 'p_err',
          state: 'error',
          error: 'CUDA out of memory',
          outputs: [{ filename: 'sub.png', subfolder: 'renders', type: 'output' }],
        }),
        stderr: '',
        exitCode: 0,
      });

    const res4 = await executeWorkflow(client, {
      workflow: { '1': { class_type: 'Test', inputs: {} } },
      maxTotalWaitSeconds: 5,
    });
    expect(res4.ok).toBe(false);
    expect(res4.error).toContain('CUDA out of memory');
  });
});
