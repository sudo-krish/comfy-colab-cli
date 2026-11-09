import { REMOTE_DRIVE_STORE } from '../config/constants.js';

export function buildSaveSnapshotScript(snapshotName: string = 'default'): string {
  return `
import os, time, subprocess, json

SNAPSHOTS_DIR = f"${REMOTE_DRIVE_STORE}/snapshots"
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

ts = int(time.time())
filename = f"{ts}_${snapshotName}.json"
filepath = os.path.join(SNAPSHOTS_DIR, filename)

cmd = f"comfy node save-snapshot {filepath}"
proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)

res = {
    "ok": proc.returncode == 0,
    "snapshot": filename,
    "path": filepath,
    "stdout": proc.stdout.strip(),
    "stderr": proc.stderr.strip()
}
print(json.dumps(res))
`.trim();
}

export function buildRestoreSnapshotScript(snapshotFilename: string): string {
  return `
import os, subprocess, json

SNAPSHOTS_DIR = f"${REMOTE_DRIVE_STORE}/snapshots"
filepath = os.path.join(SNAPSHOTS_DIR, "${snapshotFilename}")

if not os.path.exists(filepath):
    print(json.dumps({"ok": False, "error": f"Snapshot '{filepath}' does not exist"}))
else:
    cmd = f"comfy node restore-snapshot {filepath}"
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(json.dumps({
        "ok": proc.returncode == 0,
        "restored": "${snapshotFilename}",
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip()
    }))
`.trim();
}

export function buildUpdateScript(target: 'cli' | 'comfy' | 'all' = 'all'): string {
  return `
import subprocess, json

results = {}

if "${target}" in ("cli", "all"):
    proc_cli = subprocess.run("uv tool upgrade comfy-cli", shell=True, capture_output=True, text=True)
    results["cli_update"] = {"ok": proc_cli.returncode == 0, "output": proc_cli.stdout.strip()}

if "${target}" in ("comfy", "all"):
    proc_comfy = subprocess.run("comfy --workspace=/content/ComfyUI update all", shell=True, capture_output=True, text=True)
    results["comfy_update"] = {"ok": proc_comfy.returncode == 0, "output": proc_comfy.stdout.strip()}

print(json.dumps({"ok": True, "details": results}))
`.trim();
}

