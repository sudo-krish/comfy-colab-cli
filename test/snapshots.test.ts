import { describe, expect, it } from 'vitest';
import {
  buildSaveSnapshotScript,
  buildRestoreSnapshotScript,
  buildUpdateScript,
} from '../src/storage/snapshots.js';

describe('Snapshots & Self-Updating Scripts', () => {
  it('generates save snapshot script', () => {
    const script = buildSaveSnapshotScript('production_v1');
    expect(script).toContain('comfy node save-snapshot');
    expect(script).toContain('production_v1');
    expect(script).toContain('/content/drive/MyDrive/ComfyUI_Store/snapshots');
  });

  it('generates restore snapshot script', () => {
    const script = buildRestoreSnapshotScript('1700000000_production_v1.json');
    expect(script).toContain('comfy node restore-snapshot');
    expect(script).toContain('1700000000_production_v1.json');
  });

  it('generates update scripts for cli, comfy, and all targets', () => {
    const scriptCli = buildUpdateScript('cli');
    expect(scriptCli).toContain('uv tool upgrade comfy-cli');

    const scriptComfy = buildUpdateScript('comfy');
    expect(scriptComfy).toContain('comfy --workspace=/content/ComfyUI update all');

    const scriptAll = buildUpdateScript('all');
    expect(scriptAll).toContain('uv tool upgrade comfy-cli');
    expect(scriptAll).toContain('comfy --workspace=/content/ComfyUI update all');
  });
});

