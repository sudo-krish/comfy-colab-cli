import { REMOTE_DRIVE_STORE } from '../config/constants.js';

export interface BootstrapOptions {
  driveStorePath?: string;
  comfyWorkspace?: string;
}

export function generateBootstrapScript(options: BootstrapOptions = {}): string {
  const store = options.driveStorePath || REMOTE_DRIVE_STORE;
  const workspace = options.comfyWorkspace || '/content/ComfyUI';

  return `
import os, subprocess, urllib.request

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

# 3. Ensure ComfyUI repo and dependencies exist
if not os.path.exists(os.path.join(WORKSPACE, "main.py")):
    subprocess.run(["git", "clone", "--depth", "1", "https://github.com/comfyanonymous/ComfyUI.git", WORKSPACE], check=True)
    subprocess.run(["pip", "install", "-q", "-r", os.path.join(WORKSPACE, "requirements.txt")], check=True)

# 4. Launch ComfyUI daemon if not running
try:
    with urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=2) as r:
        running = (r.status == 200)
except Exception:
    running = False

if not running:
    log_f = open("/tmp/comfyui.log", "a")
    err_f = open("/tmp/comfyui.err", "a")
    subprocess.Popen(["python3", "main.py", "--listen", "127.0.0.1", "--port", "8188", "--preview-method", "none"], cwd=WORKSPACE, stdout=log_f, stderr=err_f)

print(f"[BOOTSTRAP] Initialized Google Drive store at {STORE} and injected {yaml_path}")
`.trim();
}
