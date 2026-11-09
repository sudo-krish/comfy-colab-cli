import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { generateSkillMarkdown, installSkill } from '../src/skill/installer.js';

describe('Skill Installer', () => {
  it('generates agent skill markdown', () => {
    const md = generateSkillMarkdown();
    expect(md).toContain('name: comfy-colab');
    expect(md).toContain('--json');
    expect(md).toContain('comfy-colab doctor --json');
    expect(md).toContain('Wan 2.1');
    expect(md).toContain('--hot-cache');
    expect(md).toContain('template show flux');
  });

  it('installs skill into target directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-test-'));
    try {
      const saved = installSkill(tmpDir);
      expect(fs.existsSync(saved)).toBe(true);
      const content = fs.readFileSync(saved, 'utf8');
      expect(content).toContain('name: comfy-colab');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
