import type { ComfyApiWorkflow } from '../types/workflow.js';

export interface LoraSpec {
  name: string;
  modelWeight: number;
  clipWeight: number;
}

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  loras?: LoraSpec[];
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
}

function parseSingleLoraEntry(entry: string): LoraSpec | null {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(':');
  const name = parts[0]?.trim() || '';
  if (!name) {
    return null;
  }
  const modelWeight = parts[1] ? parseFloat(parts[1]) : 1.0;
  const clipWeight = parts[2] ? parseFloat(parts[2]) : modelWeight;

  return {
    name,
    modelWeight: isNaN(modelWeight) ? 1.0 : modelWeight,
    clipWeight: isNaN(clipWeight) ? 1.0 : clipWeight,
  };
}

export function parseLoraFlag(flagValue: string): LoraSpec[] {
  if (!flagValue || typeof flagValue !== 'string') {
    return [];
  }
  return flagValue
    .split(',')
    .map(parseSingleLoraEntry)
    .filter((spec): spec is LoraSpec => spec !== null);
}

export function buildImageWorkflow(options: ImageGenerationOptions): ComfyApiWorkflow {
  const modelName = options.model || 'v1-5-pruned-emaonly.safetensors';
  const width = options.width || 1024;
  const height = options.height || 1024;
  const steps = options.steps || 25;
  const cfg = options.cfg || 7.0;
  const seed =
    options.seed !== undefined ? options.seed : Math.floor(Math.random() * 1_000_000_000);
  const loras = options.loras || [];

  const workflow: ComfyApiWorkflow = {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: modelName,
      },
    },
  };

  let currentModelSource: [string, number] = ['1', 0];
  let currentClipSource: [string, number] = ['1', 1];
  let nextNodeId = 10;

  // Dynamically chain LoRA loader nodes
  for (const lora of loras) {
    const loraNodeId = String(nextNodeId++);
    workflow[loraNodeId] = {
      class_type: 'LoraLoader',
      inputs: {
        lora_name: lora.name,
        strength_model: lora.modelWeight,
        strength_clip: lora.clipWeight,
        model: currentModelSource,
        clip: currentClipSource,
      },
    };
    currentModelSource = [loraNodeId, 0];
    currentClipSource = [loraNodeId, 1];
  }

  workflow['2'] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: options.prompt,
      clip: currentClipSource,
    },
  };

  workflow['3'] = {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: options.negativePrompt || 'text, watermark, blur, low quality',
      clip: currentClipSource,
    },
  };

  workflow['4'] = {
    class_type: 'EmptyLatentImage',
    inputs: {
      width,
      height,
      batch_size: 1,
    },
  };

  workflow['5'] = {
    class_type: 'KSampler',
    inputs: {
      seed,
      steps,
      cfg,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1.0,
      model: currentModelSource,
      positive: ['2', 0],
      negative: ['3', 0],
      latent_image: ['4', 0],
    },
  };

  workflow['6'] = {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['5', 0],
      vae: ['1', 2],
    },
  };

  workflow['7'] = {
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: 'ComfyUI',
      images: ['6', 0],
    },
  };

  return workflow;
}
