import { describe, expect, it, vi } from 'vitest';
import { ColabCliClient } from '../src/colab/client.js';
import { generateWatchdogScript } from '../src/colab/watchdog.js';

describe('ColabCliClient & In-Kernel Watchdog', () => {
  it('generates watchdog script with options', () => {
    const script = generateWatchdogScript({
      ttlMinutes: 15,
      heartbeatPath: '/tmp/test_heartbeat',
      checkIntervalSeconds: 20,
    });

    expect(script).toContain('TTL_SECONDS = 900');
    expect(script).toContain('HEARTBEAT_FILE = "/tmp/test_heartbeat"');
    expect(script).toContain('runtime.unassign()');
  });

  it('constructs session management commands', async () => {
    const client = new ColabCliClient('mock-colab');
    const runSpy = vi.spyOn(client, 'runRaw').mockResolvedValue({
      stdout: 'session created',
      stderr: '',
      exitCode: 0,
    });

    await client.createSession({ sessionName: 'test-session', gpu: 'A100', highMem: true });
    expect(runSpy).toHaveBeenCalledWith([
      'new',
      '--session',
      'test-session',
      '--gpu',
      'A100',
      '--high-mem',
    ]);

    // Default session creation without gpu and with CPU
    await client.createSession({});
    expect(runSpy).toHaveBeenCalledWith(['new']);

    await client.createSession({ gpu: 'CPU' });
    expect(runSpy).toHaveBeenCalledWith(['new']);

    await client.stopSession('test-session');
    expect(runSpy).toHaveBeenCalledWith(['stop', '--session', 'test-session']);

    await client.stopSession();
    expect(runSpy).toHaveBeenCalledWith(['stop']);

    await client.mountDrive('/content/drive', 'test-session');
    expect(runSpy).toHaveBeenCalledWith([
      'drivemount',
      '/content/drive',
      '--session',
      'test-session',
    ]);

    await client.mountDrive();
    expect(runSpy).toHaveBeenCalledWith(['drivemount', '/content/drive']);

    await client.execCode('print(1)', 'test-session', 10);
    expect(runSpy).toHaveBeenCalled();

    await client.execCode('print(2)');
    expect(runSpy).toHaveBeenCalled();

    await client.upload('./local.png', '/remote.png', 'test-session');
    expect(runSpy).toHaveBeenCalledWith([
      'upload',
      './local.png',
      '/remote.png',
      '--session',
      'test-session',
    ]);

    await client.download('/remote.png', './local.png', 'test-session');
    expect(runSpy).toHaveBeenCalledWith([
      'download',
      '/remote.png',
      './local.png',
      '--session',
      'test-session',
    ]);

    // getUsage
    vi.spyOn(client, 'runRaw').mockResolvedValueOnce({
      stdout: 'Compute unit balance: 50.0 units',
      stderr: '',
      exitCode: 0,
    });
    const usage = await client.getUsage();
    expect(usage.computeUnitsBalance).toBe(50.0);
  });

  it('handles execution failures gracefully in runRaw', async () => {
    const client = new ColabCliClient('nonexistent-binary-xyz');
    const res = await client.runRaw(['test']);
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).toBeDefined();
  });

  it('parses active sessions from CLI output', async () => {
    const client = new ColabCliClient('mock-colab');
    vi.spyOn(client, 'runRaw').mockResolvedValue({
      stdout: 'my-session  active  L4  12m\nanother-sess  stopped  T4  1h',
      stderr: '',
      exitCode: 0,
    });

    const sessions = await client.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.sessionName).toBe('my-session');
    expect(sessions[0]?.status).toBe('active');
    expect(sessions[1]?.sessionName).toBe('another-sess');
    expect(sessions[1]?.status).toBe('unknown');
  });
});
