/**
 * Python scripts executed on the remote Colab VM
 * Implements the approved REST polling workflow:
 * - POST /prompt validation & prompt_id retrieval
 * - In-VM detached runner with atomic status writes
 * - In-VM sub-30s long-polling loop
 * - POST /history deletion and POST /free VRAM flush
 */

export function buildSubmitScript(workflowJsonStr: string, jobId: string): string {
  const escapedJson = JSON.stringify(workflowJsonStr);

  return `
import json, urllib.request, urllib.error, sys, os, subprocess, time

WORKFLOW_RAW = ${escapedJson}
JOB_ID = "${jobId}"
STATUS_FILE = f"/tmp/job_{JOB_ID}.status"
TMP_STATUS = f"/tmp/job_{JOB_ID}.status.tmp"

try:
    workflow = json.loads(WORKFLOW_RAW)
except Exception as e:
    print(json.dumps({"ok": False, "error": f"JSON parse error: {e}"}))
    sys.exit(1)

payload = json.dumps({"prompt": workflow}).encode("utf-8")
req = urllib.request.Request("http://127.0.0.1:8188/prompt", data=payload, headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        prompt_id = res_data.get("prompt_id")
        if not prompt_id:
            print(json.dumps({"ok": False, "error": "No prompt_id returned"}))
            sys.exit(1)
except urllib.error.HTTPError as err:
    body = err.read().decode("utf-8")
    try:
        err_json = json.loads(body)
    except Exception:
        err_json = {"raw": body}
    print(json.dumps({"ok": False, "status_code": err.code, "error": "ComfyUI prompt rejected", "details": err_json}))
    sys.exit(1)
except Exception as e:
    print(json.dumps({"ok": False, "error": f"Failed to connect to ComfyUI: {e}"}))
    sys.exit(1)

# Write initial queued status atomically
initial_status = {
    "jobId": JOB_ID,
    "promptId": prompt_id,
    "state": "queued",
    "progressPercent": 0,
    "currentNode": None,
    "outputs": [],
    "startedAt": int(time.time()),
    "updatedAt": int(time.time())
}
with open(TMP_STATUS, "w") as f:
    json.dump(initial_status, f)
os.replace(TMP_STATUS, STATUS_FILE)

# Spawn detached background runner in VM
runner_cmd = f"python3 -c \\"import urllib.request, json, time, os; prompt_id='{prompt_id}'; job_id='{JOB_ID}';\\
status_f=f'/tmp/job_{job_id}.status'; tmp_f=f'/tmp/job_{job_id}.status.tmp';\\
while True:\\
    time.sleep(2);\\
    try:\\
        with urllib.request.urlopen(f'http://127.0.0.1:8188/history/{prompt_id}') as r:\\
            hist = json.loads(r.read().decode('utf-8'));\\
            if prompt_id in hist:\\
                entry = hist[prompt_id];\\
                st = entry.get('status', {});\\
                outs = [];\\
                for nid, o in entry.get('outputs', {}).items():\\
                    for k in ['images', 'videos', 'gifs']:\\
                        outs.extend(o.get(k, []));\\
                final_state = 'success' if st.get('completed', True) else 'error';\\
                data = {'jobId': job_id, 'promptId': prompt_id, 'state': final_state, 'progressPercent': 100, 'currentNode': None, 'outputs': outs, 'updatedAt': int(time.time()), 'completedAt': int(time.time())};\\
                with open(tmp_f, 'w') as f: json.dump(data, f);\\
                os.replace(tmp_f, status_f);\\
                break;\\
    except Exception: pass;\\" > /dev/null 2>&1 &"

subprocess.Popen(runner_cmd, shell=True)

print(json.dumps({"ok": True, "job_id": JOB_ID, "prompt_id": prompt_id}))
`.trim();
}

export function buildLongPollScript(jobId: string, maxWaitSeconds: number = 24): string {
  return `
import json, time, os, sys

STATUS_FILE = f"/tmp/job_${jobId}.status"
MAX_WAIT = ${maxWaitSeconds}
start_time = time.time()
last_state = None

while time.time() - start_time < MAX_WAIT:
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r") as f:
                data = json.load(f)
            curr_state = data.get("state")
            if curr_state in ("success", "error"):
                print(json.dumps(data))
                sys.exit(0)
            if last_state is None:
                last_state = curr_state
            elif curr_state != last_state:
                print(json.dumps(data))
                sys.exit(0)
        except Exception:
            pass
    time.sleep(1.5)

# Return current state on timeout
if os.path.exists(STATUS_FILE):
    with open(STATUS_FILE, "r") as f:
        print(f.read().strip())
else:
    print(json.dumps({"jobId": "${jobId}", "state": "queued", "progressPercent": 0, "outputs": []}))
`.trim();
}

export function buildPruneAndFreeScript(promptId: string, jobId: string): string {
  return `
import urllib.request, json, os, shutil

# 1. Prune ComfyUI History
try:
    req = urllib.request.Request(
        "http://127.0.0.1:8188/history",
        data=json.dumps({"delete": ["${promptId}"]}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        pass
except Exception as e:
    print(f"History delete warning: {e}")

# 2. Free VRAM memory caches
try:
    req = urllib.request.Request(
        "http://127.0.0.1:8188/free",
        data=json.dumps({"unload_models": True, "free_memory": True}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        pass
except Exception as e:
    print(f"Memory free warning: {e}")

# 3. Cloud wipe ephemeral output files
job_out = f"/content/ComfyUI/output/job_${jobId}"
if os.path.exists(job_out):
    shutil.rmtree(job_out, ignore_errors=True)

status_file = f"/tmp/job_${jobId}.status"
if os.path.exists(status_file):
    try:
        os.remove(status_file)
    except Exception:
        pass

print(json.dumps({"ok": True, "cloud_wiped": True}))
`.trim();
}

