import { describe, expect, it } from 'vitest';
import { buildImageWorkflow, parseLoraFlag } from '../src/workflow/builder.js';

describe('Workflow Builder & LoRA Chaining', () => {
  it('parses lora flag strings correctly', () => {
    const specs1 = parseLoraFlag('style.safetensors:0.8:0.7,detail.safetensors:0.5');
    expect(specs1).toHaveLength(2);
    expect(specs1[0]?.name).toBe('style.safetensors');
    expect(specs1[0]?.modelWeight).toBe(0.8);
    expect(specs1[0]?.clipWeight).toBe(0.7);

    expect(specs1[1]?.name).toBe('detail.safetensors');
    expect(specs1[1]?.modelWeight).toBe(0.5);
    expect(specs1[1]?.clipWeight).toBe(0.5);

    expect(parseLoraFlag('')).toEqual([]);
    expect(parseLoraFlag('   ')).toEqual([]);
  });

  it('builds standard image workflow without LoRAs', () => {
    const wf = buildImageWorkflow({
      prompt: 'a majestic mountain at sunrise',
      width: 512,
      height: 512,
      steps: 20,
      seed: 42,
    });

    expect(wf['1']?.class_type).toBe('CheckpointLoaderSimple');
    expect(wf['2']?.class_type).toBe('CLIPTextEncode');
    expect(wf['2']?.inputs['text']).toBe('a majestic mountain at sunrise');
    expect(wf['4']?.inputs['width']).toBe(512);
    expect(wf['5']?.inputs['seed']).toBe(42);
    expect(wf['5']?.inputs['steps']).toBe(20);
    expect(wf['7']?.class_type).toBe('SaveImage');
  });

  it('dynamically inserts LoRA loader nodes into the graph', () => {
    const wf = buildImageWorkflow({
      prompt: 'cyberpunk city',
      loras: [
        { name: 'neon.safetensors', modelWeight: 0.8, clipWeight: 0.8 },
        { name: 'rain.safetensors', modelWeight: 0.6, clipWeight: 0.6 },
      ],
    });

    expect(wf['10']?.class_type).toBe('LoraLoader');
    expect(wf['10']?.inputs['lora_name']).toBe('neon.safetensors');
    expect(wf['10']?.inputs['strength_model']).toBe(0.8);

    expect(wf['11']?.class_type).toBe('LoraLoader');
    expect(wf['11']?.inputs['lora_name']).toBe('rain.safetensors');
    expect(wf['11']?.inputs['model']).toEqual(['10', 0]);

    // Positive prompt clip input connects to the end of the LoRA chain
    expect(wf['2']?.inputs['clip']).toEqual(['11', 1]);
    // KSampler model input connects to the end of the LoRA chain
    expect(wf['5']?.inputs['model']).toEqual(['11', 0]);
  });
});

