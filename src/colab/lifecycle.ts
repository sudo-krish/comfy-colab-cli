import { ColabCliClient } from './client.js';
import { generateWatchdogScript } from './watchdog.js';
import { generateBootstrapScript } from '../storage/bootstrap.js';
import type { GpuType, ColabSessionInfo } from '../types/session.js';

export interface StartEnvironmentOptions {
  sessionName?: string;
  gpu?: GpuType;
  highMem?: boolean;
  ttlMinutes?: number;
  mountDrive?: boolean;
  bootstrapStorage?: boolean;
}

export interface EnvironmentStatus {
  ok: boolean;
  sessionName?: string;
  status: string;
  gpu?: GpuType;
  details?: string;
}

export class ColabLifecycleManager {
  private readonly client: ColabCliClient;

  public constructor(client?: ColabCliClient) {
    this.client = client ?? new ColabCliClient();
  }

  public async start(options: StartEnvironmentOptions = {}): Promise<EnvironmentStatus> {
    const createRes = await this.client.createSession({
      sessionName: options.sessionName,
      gpu: options.gpu,
      highMem: options.highMem,
    });

    if (createRes.exitCode !== 0) {
      return {
        ok: false,
        status: 'error',
        details: createRes.stderr || createRes.stdout,
      };
    }

    if (options.mountDrive) {
      await this.client.mountDrive('/content/drive', options.sessionName);
    }

    if (options.bootstrapStorage) {
      const script = generateBootstrapScript();
      await this.client.execCode(script, options.sessionName, 25);
    }

    const ttl = options.ttlMinutes ?? 20;
    const watchdogCode = generateWatchdogScript({ ttlMinutes: ttl });
    await this.client.execCode(watchdogCode, options.sessionName, 10);

    return {
      ok: true,
      sessionName: options.sessionName || 'default',
      status: 'active',
      gpu: options.gpu,
    };
  }

  public async stop(sessionName?: string): Promise<{ ok: boolean; message: string }> {
    const res = await this.client.stopSession(sessionName);
    return {
      ok: res.exitCode === 0,
      message: res.stdout || res.stderr || 'Session stopped',
    };
  }

  public async list(): Promise<ColabSessionInfo[]> {
    return this.client.listSessions();
  }
}
