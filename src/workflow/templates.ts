import type { ComfyApiWorkflow } from '../types/workflow.js';

export const FLUX_GOLDEN_TEMPLATE: ComfyApiWorkflow = {
  '1': {
    class_type: 'UNETLoader',
    inputs: {
      unet_name: 'flux1-dev.safetensors',
      weight_dtype: 'fp8_e4m3fn',
    },
  },
  '2': {
    class_type: 'DualCLIPLoader',
    inputs: {
      clip_name1: 't5xxl_fp8_e4m3fn.safetensors',
      clip_name2: 'clip_l.safetensors',
      type: 'flux',
    },
  },
  '3': {
    class_type: 'VAELoader',
    inputs: {
      vae_name: 'ae.safetensors',
    },
  },
  '4': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: 'a hyperrealistic cinematic masterpiece',
      clip: ['2', 0],
    },
  },
  '5': {
    class_type: 'EmptyLatentImage',
    inputs: {
      width: 1024,
      height: 1024,
      batch_size: 1,
    },
  },
  '6': {
    class_type: 'KSampler',
    inputs: {
      seed: 42,
      steps: 25,
      cfg: 3.5,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1.0,
      model: ['1', 0],
      positive: ['4', 0],
      negative: ['4', 0],
      latent_image: ['5', 0],
    },
  },
  '7': {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['6', 0],
      vae: ['3', 0],
    },
  },
  '8': {
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: 'ComfyColab_Flux',
      images: ['7', 0],
    },
  },
};

export const SDXL_GOLDEN_TEMPLATE: ComfyApiWorkflow = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: {
      ckpt_name: 'sd_xl_base_1.0.safetensors',
    },
  },
  '2': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: 'cinematic portrait, soft lighting, 8k',
      clip: ['1', 1],
    },
  },
  '3': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: 'blurry, distorted, low quality',
      clip: ['1', 1],
    },
  },
  '4': {
    class_type: 'EmptyLatentImage',
    inputs: {
      width: 1024,
      height: 1024,
      batch_size: 1,
    },
  },
  '5': {
    class_type: 'KSampler',
    inputs: {
      seed: 12345,
      steps: 20,
      cfg: 7.0,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 1.0,
      model: ['1', 0],
      positive: ['2', 0],
      negative: ['3', 0],
      latent_image: ['4', 0],
    },
  },
  '6': {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['5', 0],
      vae: ['1', 2],
    },
  },
  '7': {
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: 'ComfyColab_SDXL',
      images: ['6', 0],
    },
  },
};

export const WAN21_GOLDEN_TEMPLATE: ComfyApiWorkflow = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: {
      ckpt_name: 'wan2.1_t2v_14B_fp8.safetensors',
    },
  },
  '2': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: 'cinematic flythrough of a futuristic landscape',
      clip: ['1', 1],
    },
  },
  '3': {
    class_type: 'EmptyLatentImage',
    inputs: {
      width: 832,
      height: 480,
      batch_size: 81,
    },
  },
  '4': {
    class_type: 'KSampler',
    inputs: {
      seed: 99999,
      steps: 30,
      cfg: 6.0,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1.0,
      model: ['1', 0],
      positive: ['2', 0],
      negative: ['2', 0],
      latent_image: ['3', 0],
    },
  },
  '5': {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['4', 0],
      vae: ['1', 2],
    },
  },
  '6': {
    class_type: 'VHS_VideoCombine',
    inputs: {
      images: ['5', 0],
      frame_rate: 24,
      loop_count: 0,
      filename_prefix: 'ComfyColab_Wan21',
      format: 'video/h264-mp4',
      pingpong: false,
      save_output: true,
    },
  },
};

const TEMPLATES: Record<string, ComfyApiWorkflow> = {
  flux: FLUX_GOLDEN_TEMPLATE,
  sdxl: SDXL_GOLDEN_TEMPLATE,
  wan21: WAN21_GOLDEN_TEMPLATE,
};

export function listGoldenTemplates(): string[] {
  return Object.keys(TEMPLATES);
}

export function getGoldenTemplate(name: string): ComfyApiWorkflow | null {
  const normalized = name.toLowerCase().trim();
  const template = TEMPLATES[normalized];
  if (!template) {
    return null;
  }
  return JSON.parse(JSON.stringify(template)) as ComfyApiWorkflow;
}
