import { describe, expect, it } from 'vitest';
import { generateBootstrapScript } from '../src/storage/bootstrap.js';
import {
  buildListModelsScript,
  buildHotCacheScript,
  buildPullModelScript,
  buildRefreshModelsScript,
} from '../src/storage/models.js';

describe('Storage Bootstrap & Model Manager Scripts', () => {
  it('generates storage bootstrap script', () => {
    const script = generateBootstrapScript({
      driveStorePath: '/content/drive/MyDrive/ComfyUI_Store',
    });

    expect(script).toContain('models/checkpoints');
    expect(script).toContain('extra_model_paths.yaml');
    expect(script).toContain('STORE = "/content/drive/MyDrive/ComfyUI_Store"');
    expect(script).toContain('base_path: {STORE}/models');
  });

  it('generates list models script', () => {
    const script1 = buildListModelsScript();
    expect(script1).toContain('target_types = os.listdir(MODELS_DIR)');

    const script2 = buildListModelsScript('loras');
    expect(script2).toContain("target_types = ['loras']");
  });

  it('generates hot-cache script', () => {
    const script = buildHotCacheScript('sdxl.safetensors', 'checkpoints');
    expect(script).toContain('sdxl.safetensors');
    expect(script).toContain('/content/ComfyUI/models/checkpoints');
  });

  it('generates pull model script with auth token', () => {
    const script = buildPullModelScript(
      'https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors',
      'checkpoints',
      'dummy-hf-token', // pragma: whitelist secret
    );
    expect(script).toContain('Bearer dummy-hf-token');
    expect(script).toContain('flux1-dev.safetensors');
  });

  it('generates refresh models script targeting ComfyUI endpoint', () => {
    const script = buildRefreshModelsScript();
    expect(script).toContain('http://127.0.0.1:8188/refresh');
    expect(script).toContain('[REFRESH]');
  });
});
