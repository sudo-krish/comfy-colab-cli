import fs from 'node:fs';

export interface BatchPromptItem {
  index: number;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
}

export interface ParseBatchOptions {
  batchFilePath?: string;
  count?: number;
  basePrompt?: string;
  baseNegativePrompt?: string;
  baseSeed?: number;
}

function parseJsonLine(line: string, index: number): BatchPromptItem | null {
  try {
    const parsed = JSON.parse(line) as {
      prompt?: string;
      negativePrompt?: string;
      seed?: number;
    };
    if (parsed.prompt && typeof parsed.prompt === 'string') {
      return {
        index,
        prompt: parsed.prompt,
        negativePrompt: parsed.negativePrompt,
        seed: parsed.seed,
      };
    }
  } catch {
    // Fall back to plain text
  }
  return null;
}

function parseSingleLine(line: string, index: number): BatchPromptItem {
  const jsonItem = parseJsonLine(line, index);
  if (jsonItem) {
    return jsonItem;
  }
  return {
    index,
    prompt: line,
  };
}

export function parseBatchFileContent(content: string): BatchPromptItem[] {
  const lines = content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  return lines.map((line, index) => parseSingleLine(line, index));
}

function generateCountBatch(
  count: number,
  basePrompt: string,
  baseNegative?: string,
  baseSeed?: number,
): BatchPromptItem[] {
  const items: BatchPromptItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = baseSeed !== undefined ? baseSeed + i : Math.floor(Math.random() * 1_000_000_000);
    items.push({
      index: i,
      prompt: basePrompt,
      negativePrompt: baseNegative,
      seed,
    });
  }
  return items;
}

export function resolveBatchPrompts(options: ParseBatchOptions): BatchPromptItem[] {
  if (options.batchFilePath && fs.existsSync(options.batchFilePath)) {
    const content = fs.readFileSync(options.batchFilePath, 'utf8');
    return parseBatchFileContent(content);
  }

  const count = options.count && options.count > 0 ? options.count : 1;
  const prompt = options.basePrompt || 'a majestic cinematic landscape, photorealistic, 8k';

  return generateCountBatch(count, prompt, options.baseNegativePrompt, options.baseSeed);
}
