import { REMOTE_DRIVE_STORE } from '../config/constants.js';

export function buildListModelsScript(typeFilter?: string): string {
  const filterCode = typeFilter
    ? `target_types = ['${typeFilter}']`
    : `target_types = os.listdir(MODELS_DIR)`;

  return `
import os, json

STORE = "${REMOTE_DRIVE_STORE}"
MODELS_DIR = os.path.join(STORE, "models")
results = []

if os.path.exists(MODELS_DIR):
    ${filterCode}
    for t in target_types:
        type_path = os.path.join(MODELS_DIR, t)
        if os.path.isdir(type_path):
            for fname in os.listdir(type_path):
                fpath = os.path.join(type_path, fname)
                if os.path.isfile(fpath):
                    size_mb = round(os.path.getsize(fpath) / (1024 * 1024), 2)
                    results.append({
                        "name": fname,
                        "type": t,
                        "sizeMb": size_mb,
                        "path": fpath
                    })

print(json.dumps(results))
`.trim();
}

export function buildHotCacheScript(filename: string, modelType: string = 'checkpoints'): string {
  return `
import os, shutil

DRIVE_SRC = f"${REMOTE_DRIVE_STORE}/models/${modelType}/${filename}"
NVME_DEST_DIR = f"/content/ComfyUI/models/${modelType}"
NVME_DEST = os.path.join(NVME_DEST_DIR, "${filename}")

os.makedirs(NVME_DEST_DIR, exist_ok=True)

if os.path.exists(NVME_DEST):
    print(f"[HOT-CACHE] '{filename}' already cached on local NVMe.")
elif os.path.exists(DRIVE_SRC):
    print(f"[HOT-CACHE] Copying '{filename}' from Google Drive to fast NVMe...")
    shutil.copy2(DRIVE_SRC, NVME_DEST)
    print(f"[HOT-CACHE] '{filename}' successfully hot-cached on NVMe.")
else:
    print(f"[HOT-CACHE] Warning: '{filename}' not found in Google Drive store ({DRIVE_SRC}).")
`.trim();
}

export function buildPullModelScript(
  sourceUrl: string,
  modelType: string = 'checkpoints',
  token?: string,
): string {
  const authHeader = token ? `headers = {"Authorization": f"Bearer ${token}"}` : 'headers = {}';

  return `
import os, urllib.request

DEST_DIR = f"${REMOTE_DRIVE_STORE}/models/${modelType}"
os.makedirs(DEST_DIR, exist_ok=True)

URL = "${sourceUrl}"
filename = URL.split("?")[0].split("/")[-1] or "downloaded_model.safetensors"
DEST_FILE = os.path.join(DEST_DIR, filename)

${authHeader}

print(f"[PULL] Downloading '{filename}' to Google Drive {DEST_DIR}...")
req = urllib.request.Request(URL, headers=headers)
with urllib.request.urlopen(req) as resp, open(DEST_FILE, "wb") as out_file:
    while True:
        chunk = resp.read(16 * 1024 * 1024)
        if not chunk:
            break
        out_file.write(chunk)

print(f"[PULL] Download complete: {DEST_FILE}")
`.trim();
}

export function buildRefreshModelsScript(): string {
  return `
import urllib.request

try:
    req = urllib.request.Request("http://127.0.0.1:8188/refresh", data=b"", method="POST")
    urllib.request.urlopen(req, timeout=5)
    print("[REFRESH] ComfyUI object info and model caches refreshed.")
except Exception as e:
    print(f"[REFRESH] Note: Could not notify ComfyUI server at 127.0.0.1:8188: {e}")
`.trim();
}

