import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { COLAB_EXEC_TIMEOUT_SEC } from '../config/constants.js';
import { parseComputeQuota } from '../doctor/doctor.js';
import type { ColabSessionConfig, ColabSessionInfo, ColabUsageInfo } from '../types/session.js';

const execFileAsync = promisify(execFile);

export interface CommandExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ColabCliClient {
  private readonly colabBinary: string;

  public constructor(colabBinary: string = 'colab') {
    this.colabBinary = colabBinary;
  }

  public async runRaw(args: string[], timeoutMs?: number): Promise<CommandExecutionResult> {
    try {
      const { stdout, stderr } = await execFileAsync(this.colabBinary, args, {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const execError = err as {
        stdout?: string;
        stderr?: string;
        code?: number;
        message?: string;
      };
      return {
        stdout: execError.stdout?.trim() ?? '',
        stderr: execError.stderr?.trim() ?? execError.message ?? String(err),
        exitCode: execError.code ?? 1,
      };
    }
  }

  public async createSession(config: ColabSessionConfig = {}): Promise<CommandExecutionResult> {
    const args = ['new'];
    if (config.sessionName) {
      args.push('--session', config.sessionName);
    }
    if (config.gpu && config.gpu !== 'CPU') {
      args.push('--gpu', config.gpu);
    }
    if (config.highMem) {
      args.push('--high-mem');
    }
    return this.runRaw(args);
  }

  public async stopSession(sessionName?: string): Promise<CommandExecutionResult> {
    const args = ['stop'];
    if (sessionName) {
      args.push('--session', sessionName);
    }
    return this.runRaw(args);
  }

  public async listSessions(): Promise<ColabSessionInfo[]> {
    const res = await this.runRaw(['sessions']);
    if (res.exitCode !== 0 || !res.stdout) {
      return [];
    }

    const sessions: ColabSessionInfo[] = [];
    const lines = res.stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)/);
      if (match && match[1] && match[2]) {
        sessions.push({
          sessionName: match[1],
          status: match[2].toLowerCase() === 'active' ? 'active' : 'unknown',
        });
      }
    }
    return sessions;
  }

  public async mountDrive(
    path: string = '/content/drive',
    sessionName?: string,
  ): Promise<CommandExecutionResult> {
    const args = ['drivemount', path];
    if (sessionName) {
      args.push('--session', sessionName);
    }
    return this.runRaw(args);
  }

  public async execCode(
    codeSnippet: string,
    sessionName?: string,
    timeoutSeconds: number = COLAB_EXEC_TIMEOUT_SEC,
  ): Promise<CommandExecutionResult> {
    const escaped = codeSnippet.replace(/"/g, '\\"');
    const args = ['exec'];
    if (sessionName) {
      args.push('--session', sessionName);
    }
    args.push('--timeout', String(timeoutSeconds));
    args.push(`python3 -c "${escaped}"`);
    return this.runRaw(args, (timeoutSeconds + 5) * 1000);
  }

  public async upload(
    localPath: string,
    remotePath: string,
    sessionName?: string,
  ): Promise<CommandExecutionResult> {
    const args = ['upload', localPath, remotePath];
    if (sessionName) {
      args.push('--session', sessionName);
    }
    return this.runRaw(args);
  }

  public async download(
    remotePath: string,
    localPath: string,
    sessionName?: string,
  ): Promise<CommandExecutionResult> {
    const args = ['download', remotePath, localPath];
    if (sessionName) {
      args.push('--session', sessionName);
    }
    return this.runRaw(args);
  }

  public async getUsage(): Promise<ColabUsageInfo> {
    const res = await this.runRaw(['usage'], 10000);
    return parseComputeQuota(res.stdout || res.stderr);
  }
}
