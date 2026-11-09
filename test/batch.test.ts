import { describe, it, expect } from 'vitest';
import { parseBatchFileContent, resolveBatchPrompts } from '../src/workflow/batch.js';

describe('workflow batch generator', () => {
  it('parses plain text prompt lines, ignoring blank lines and comments', () => {
    const raw = `
# This is a comment
A vibrant cyberpunk city at sunset

# Another comment
A serene mountain lake with autumn trees
    `;
    const items = parseBatchFileContent(raw);
    expect(items).toHaveLength(2);
    expect(items[0]?.prompt).toBe('A vibrant cyberpunk city at sunset');
    expect(items[0]?.index).toBe(0);
    expect(items[1]?.prompt).toBe('A serene mountain lake with autumn trees');
    expect(items[1]?.index).toBe(1);
  });

  it('parses JSON-lines format with structured fields', () => {
    const jsonl = `
{"prompt": "A futuristic robot", "seed": 42, "negativePrompt": "blur"}
{"prompt": "A medieval castle", "seed": 100}
plain text prompt line
    `;
    const items = parseBatchFileContent(jsonl);
    expect(items).toHaveLength(3);
    expect(items[0]?.prompt).toBe('A futuristic robot');
    expect(items[0]?.seed).toBe(42);
    expect(items[0]?.negativePrompt).toBe('blur');
    expect(items[1]?.prompt).toBe('A medieval castle');
    expect(items[1]?.seed).toBe(100);
    expect(items[2]?.prompt).toBe('plain text prompt line');
  });

  it('resolves count-based batch generation when no batch file is provided', () => {
    const items = resolveBatchPrompts({
      count: 3,
      basePrompt: 'A glowing crystal',
      baseNegativePrompt: 'low quality',
      baseSeed: 1000,
    });

    expect(items).toHaveLength(3);
    expect(items[0]?.prompt).toBe('A glowing crystal');
    expect(items[0]?.negativePrompt).toBe('low quality');
    expect(items[0]?.seed).toBe(1000);
    expect(items[1]?.seed).toBe(1001);
    expect(items[2]?.seed).toBe(1002);
  });

  it('falls back to default single item when count is omitted or non-positive', () => {
    const items = resolveBatchPrompts({});
    expect(items).toHaveLength(1);
    expect(items[0]?.prompt).toContain('landscape');
    expect(typeof items[0]?.seed).toBe('number');
  });
});
