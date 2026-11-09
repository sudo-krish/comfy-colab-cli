import type { ComfyApiWorkflow } from '../types/workflow.js';
import type { GpuType } from '../types/session.js';

export interface VideoGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  initImage?: string;
  model?: string;
  frames?: number;
  fps?: number;
  width?: number;
  height?: number;
  motionScale?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
}

export function validateGpuForVideo(gpu?: GpuType): { compatible: boolean; warning?: string } {
  if (!gpu || gpu === 'T4' || gpu === 'CPU') {
    return {
      compatible: false,
      warning: `GPU '${gpu || 'unspecified'}' has insufficient VRAM for 14B/video generation. Escalating to 'L4' (24 GB) or 'A100' is strongly recommended to prevent Out-Of-Memory crashes.`,
    };
  }
  return { compatible: true };
}

function attachInitImageNodes(workflow: ComfyApiWorkflow, initImage: string): void {
  workflow['10'] = {
    class_type: 'LoadImage',
    inputs: {
      image: initImage,
    },
  };
  workflow['11'] = {
    class_type: 'VAEEncode',
    inputs: {
      pixels: ['10', 0],
      vae: ['1', 2],
    },
  };
  workflow['5']!.inputs['latent_image'] = ['11', 0];
}

interface ResolvedVideoParams {
  modelName: string;
  frames: number;
  fps: number;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  negativePrompt: string;
}

function resolveVideoParams(options: VideoGenerationOptions): ResolvedVideoParams {
  const {
    model: modelName = 'wan2.1_t2v_14B_fp8.safetensors',
    frames = 81,
    fps = 24,
    width = 832,
    height = 480,
    steps = 30,
    cfg = 6.0,
    negativePrompt = 'jitter, blur, distortion, low quality, artifacts',
  } = options;
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000_000);

  return {
    modelName,
    frames,
    fps,
    width,
    height,
    steps,
    cfg,
    seed,
    negativePrompt,
  };
}

export function buildVideoWorkflow(options: VideoGenerationOptions): ComfyApiWorkflow {
  const params = resolveVideoParams(options);

  const workflow: ComfyApiWorkflow = {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: params.modelName,
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: options.prompt,
        clip: ['1', 1],
      },
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: params.negativePrompt,
        clip: ['1', 1],
      },
    },
    '4': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: params.width,
        height: params.height,
        batch_size: params.frames,
      },
    },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: 'euler',
        scheduler: 'normal',
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
      class_type: 'VHS_VideoCombine',
      inputs: {
        images: ['6', 0],
        frame_rate: params.fps,
        loop_count: 0,
        filename_prefix: 'ComfyUI_Video',
        format: 'video/h264-mp4',
        pingpong: false,
        save_output: true,
      },
    },
  };

  if (options.initImage) {
    attachInitImageNodes(workflow, options.initImage);
  }

  return workflow;
}
