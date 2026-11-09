import { describe, it, expect, vi } from 'vitest';
import { ColabLifecycleManager } from '../src/colab/lifecycle.js';
import { ColabCliClient } from '../src/colab/client.js';

describe('Colab Lifecycle Manager', () => {
  it('starts a colab environment with options', async () => {
    const client = new ColabCliClient();
    vi.spyOn(client, 'createSession').mockResolvedValue({
      stdout: 'session created',
      stderr: '',
      exitCode: 0,
    });
    vi.spyOn(client, 'mountDrive').mockResolvedValue({
      stdout: 'mounted',
      stderr: '',
      exitCode: 0,
    });
    vi.spyOn(client, 'execCode').mockResolvedValue({
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
    });

    const manager = new ColabLifecycleManager(client);
    const result = await manager.start({
      sessionName: 'my-session',
      gpu: 'L4',
      ttlMinutes: 25,
      mountDrive: true,
      bootstrapStorage: true,
    });

    expect(result.ok).toBe(true);
    expect(result.sessionName).toBe('my-session');
    expect(result.status).toBe('active');
    expect(result.gpu).toBe('L4');
  });

  it('handles session creation failure gracefully', async () => {
    const client = new ColabCliClient();
    vi.spyOn(client, 'createSession').mockResolvedValue({
      stdout: '',
      stderr: 'Quota exceeded for GPU',
      exitCode: 1,
    });

    const manager = new ColabLifecycleManager(client);
    const result = await manager.start({ gpu: 'A100' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('error');
    expect(result.details).toContain('Quota exceeded');
  });

  it('stops a session and lists active sessions', async () => {
    const client = new ColabCliClient();
    vi.spyOn(client, 'stopSession').mockResolvedValue({
      stdout: 'session stopped',
      stderr: '',
      exitCode: 0,
    });
    vi.spyOn(client, 'listSessions').mockResolvedValue([
      { sessionName: 'sess_1', status: 'active' },
    ]);

    const manager = new ColabLifecycleManager(client);
    const stopResult = await manager.stop('sess_1');
    expect(stopResult.ok).toBe(true);

    const listResult = await manager.list();
    expect(listResult).toHaveLength(1);
    expect(listResult[0]?.sessionName).toBe('sess_1');
  });
});

