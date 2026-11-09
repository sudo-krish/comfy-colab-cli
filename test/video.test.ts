import { describe, expect, it } from 'vitest';
import { buildVideoWorkflow, validateGpuForVideo } from '../src/workflow/video.js';

describe('Video Workflow Builder & Hardware Escalation', () => {
  it('validates GPU for video generation', () => {
    const t4Check = validateGpuForVideo('T4');
    expect(t4Check.compatible).toBe(false);
    expect(t4Check.warning).toContain('insufficient VRAM');

    const l4Check = validateGpuForVideo('L4');
    expect(l4Check.compatible).toBe(true);
    expect(l4Check.warning).toBeUndefined();

    const a100Check = validateGpuForVideo('A100');
    expect(a100Check.compatible).toBe(true);

    const emptyCheck = validateGpuForVideo(undefined);
    expect(emptyCheck.compatible).toBe(false);
  });

  it('builds standard Text-to-Video workflow', () => {
    const wf = buildVideoWorkflow({
      prompt: 'a drone flying over mountains',
      frames: 65,
      fps: 30,
      width: 720,
      height: 480,
    });

    expect(wf['1']?.class_type).toBe('CheckpointLoaderSimple');
    expect(wf['2']?.class_type).toBe('CLIPTextEncode');
    expect(wf['2']?.inputs['text']).toBe('a drone flying over mountains');
    expect(wf['4']?.inputs['batch_size']).toBe(65);
    expect(wf['7']?.class_type).toBe('VHS_VideoCombine');
    expect(wf['7']?.inputs['frame_rate']).toBe(30);
    expect(wf['10']).toBeUndefined();
  });

  it('builds Image-to-Video workflow when initImage is provided', () => {
    const wf = buildVideoWorkflow({
      prompt: 'character smiling',
      initImage: 'input_frame_0.png',
      model: 'wan2.1_i2v_14B_fp8.safetensors',
    });

    expect(wf['10']?.class_type).toBe('LoadImage');
    expect(wf['10']?.inputs['image']).toBe('input_frame_0.png');
    expect(wf['11']?.class_type).toBe('VAEEncode');
    expect(wf['5']?.inputs['latent_image']).toEqual(['11', 0]);
  });
});
