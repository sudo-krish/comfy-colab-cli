import { REMOTE_DRIVE_STORE } from '../config/constants.js';

export interface BootstrapOptions {
  driveStorePath?: string;
  comfyWorkspace?: string;
}

export function generateBootstrapScript(options: BootstrapOptions = {}): string {
  const store = options.driveStorePath || REMOTE_DRIVE_STORE;
  const workspace = options.comfyWorkspace || '/content/ComfyUI';

  return `
import os

STORE = "${store}"
WORKSPACE = "${workspace}"

# 1. Scaffold persistent Google Drive directory hierarchy
subdirs = [
    "models/checkpoints",
    "models/loras",
    "models/vae",
    "models/clip",
    "models/unet",
    "models/controlnet",
    "models/text_encoders",
    "workflows",
    "snapshots",
    "cache/wheels"
]

for d in subdirs:
    target = os.path.join(STORE, d)
    os.makedirs(target, exist_ok=True)

# 2. Inject extra_model_paths.yaml for ComfyUI
yaml_content = f"""comfyui:
  base_path: {STORE}/models
  checkpoints: checkpoints
  loras: loras
  vae: vae
  clip: clip
  unet: unet
  controlnet: controlnet
"""

os.makedirs(WORKSPACE, exist_ok=True)
yaml_path = os.path.join(WORKSPACE, "extra_model_paths.yaml")
with open(yaml_path, "w") as f:
    f.write(yaml_content)

print(f"[BOOTSTRAP] Initialized Google Drive store at {STORE} and injected {yaml_path}")
`.trim();
}
