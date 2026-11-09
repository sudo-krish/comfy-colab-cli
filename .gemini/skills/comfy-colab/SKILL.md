---
name: comfy-colab
description: Headless AI agent orchestrator to spin up ComfyUI on Google Colab GPU runtimes, execute image/video workflows, manage persistent models on Google Drive, and auto-terminate GPU billing.
---

# ComfyUI on Google Colab (Headless AI Agent Skill)

Use `comfy-colab` to orchestrate headless ComfyUI execution on Google Colab GPUs without requiring any browser interaction or public tunnels. Commands pipe directly over Google's official `google-colab-cli` into the Colab VM kernel.

---

## 1. Core Directives for AI Agents

1. **Strict `--json` Mode**:
   - **ALWAYS** pass `--json` to every command.
   - Suppresses console spinners, banners, and progress bars.
   - Guarantees compact, deterministic JSON envelopes adhering to the schema below (< 150 tokens per call).

2. **Zero Runaway Billing (Auto-Termination)**:
   - When running one-off jobs, pass `--ephemeral` on `comfy-colab run` to automatically shut down the VM when the job completes.
   - For interactive sessions, always run `comfy-colab stop --json` once generation batches finish.
   - In-kernel idle watchdogs terminate sessions automatically if heartbeats cease (default: 20 minutes).

3. **GPU Selection & Hardware Escalation**:
   - **SD 1.5 / SDXL**: Compatible with `T4` (16 GB) or `L4` (24 GB).
   - **Flux.1 Dev**: Requires `L4` (24 GB) or `A100` (40/80 GB).
   - **Video Generation (Wan 2.1 14B, HunyuanVideo)**: **MUST** use `--gpu L4` or `--gpu A100`. **NEVER** use `T4` for video generation; it will crash with Out-Of-Memory (OOM).

4. **NVMe Hot-Caching**:
   - Reading 15 GB checkpoints directly over Google Drive FUSE (`/content/drive/MyDrive`) takes 45–90 seconds.
   - Use `--hot-cache <checkpoint_name>` to copy the model to local NVMe (`/content/ComfyUI/models/`), speeding up load times to ~2 seconds.

5. **Cloud Sync-and-Shred**:
   - Generations are rendered to ephemeral VM scratch disks, downloaded locally with SHA-256 checksum verification, and immediately shredded from the cloud.

---

## 2. Standard Agent JSON Envelope Specification

Every command executed with `--json` returns one of the following envelopes:

### Success Envelope
```json
{
  "ok": true,
  "command": "run",
  "data": {
    "prompt": "a cybernetic astronaut, 8k",
    "template": "flux",
    "outputDir": "./outputs",
    "ephemeral": true
  }
}
```

### Failure Envelope
```json
{
  "ok": false,
  "command": "run",
  "error": {
    "code": "ERR_UNKNOWN_COMMAND | ERR_COMPUTE_EXHAUSTED | ERR_WORKFLOW_FAILED",
    "message": "Detailed explanation of failure"
  }
}
```

---

## 3. Comprehensive Command Reference

### Environment & Diagnostics
- Check prerequisites, GPU quota, Node version, and vault status:
  `comfy-colab doctor --json`
- Configure HuggingFace and CivitAI API tokens in encrypted AES-256-GCM vault:
  `comfy-colab auth --hf <token> --civitai <key> --json`
- Inspect vault configuration status:
  `comfy-colab auth --json`

### Cloud Lifecycle Management
Sessions are created and orchestrated directly by `comfy-colab` (you do not need to call raw `colab` commands). `comfy-colab run` will even auto-provision a session if none is currently active:
- Spin up a Colab VM session with GPU and background idle watchdog:
  `comfy-colab up --gpu L4 --ttl 25 --mount-drive --json`
- Terminate an active Colab session immediately:
  `comfy-colab stop --session <session_id> --json`
- List all active sessions and statuses:
  `comfy-colab sessions --json`
- Print or open browser notebook URL attached to VM kernel:
  `comfy-colab url [--session <session_id>] [--open] --json`
- Initialize persistent Google Drive directory scaffolding:
  `comfy-colab setup --json`

### Image Generation
- Basic text-to-image:
  `comfy-colab image --prompt "a cybernetic wolf in neon rain" --model "v1-5-pruned-emaonly.safetensors" --json`
- Multi-LoRA daisy chaining (`--lora "name:model_weight:clip_weight"`):
  `comfy-colab image --prompt "hero shot" --lora "style_v1.safetensors:0.8,detailer.safetensors:0.5" --json`
- Dot-notation AST parameter overrides (`--set <node_id>.<input>=<value>`):
  `comfy-colab image --prompt "ancient temple" --set "5.inputs.steps=35" --set "5.inputs.cfg=7.5" --json`
- Seed sweep / Batch count:
  `comfy-colab image --prompt "cosmic nebula" --count 5 --json`
- Matrix batch generation from file:
  `comfy-colab image --batch-file ./prompts.jsonl --json`

### Video Generation (Wan 2.1)
- Text-to-Video (T2V):
  `comfy-colab video --prompt "cinematic drone flythrough of neon Tokyo, 4k" --gpu L4 --json`
- Image-to-Video (I2V):
  `comfy-colab video --prompt "camera orbits subject smoothly" --init-image ./frame0.png --gpu L4 --json`

### Golden Workflow Templates & Unified Run
- List built-in golden templates:
  `comfy-colab template list --json`
- View template graph schema (`flux`, `sdxl`, `wan21`):
  `comfy-colab template show flux --json`
- Execute end-to-end headless run with hot-caching and ephemeral termination:
  `comfy-colab run --template flux --prompt "portrait of a warrior" --hot-cache flux1-dev.safetensors --ephemeral --json`
- Execute custom workflow file with overrides:
  `comfy-colab run -w ./custom_api.json --set "3.inputs.seed=42" --output ./renders --ephemeral --json`

### Persistent Model Management (Google Drive)
- List installed models on Drive by type:
  `comfy-colab models list --type checkpoints --json`
  `comfy-colab models list --type loras --json`
- Cloud-to-Drive direct download (uses Colab's 1-2 Gbps bandwidth directly to Drive, zero local bandwidth used):
  `comfy-colab models pull https://huggingface.co/.../model.safetensors --type checkpoints --json`
- Local-to-Drive upload (custom LoRAs or checkpoints with automatic ComfyUI cache refresh):
  `comfy-colab models upload ./my_custom_style.safetensors --type loras --json`

### Snapshots & Maintenance
- Save custom node lockfile snapshot:
  `comfy-colab snapshot save my_stable_nodes --json`
- Roll back to a previous snapshot lockfile:
  `comfy-colab snapshot restore my_stable_nodes.json --json`
- Self-update tools:
  `comfy-colab update --target all --json`

---

## 4. Agent Execution Recipes

### Recipe A: Generate High-Fidelity Flux Image
```bash
# 1. Verify health and quota
comfy-colab doctor --json

# 2. Run ephemeral Flux generation with NVMe hot-cache
comfy-colab run \
  --template flux \
  --prompt "cyberpunk detective in rainy alley, volumetric lighting, photorealistic 8k" \
  --hot-cache flux1-dev.safetensors \
  --output ./outputs \
  --ephemeral \
  --json
```

### Recipe B: Image-to-Video Generation with Wan 2.1
```bash
# 1. Enforce L4/A100 GPU and launch I2V
comfy-colab video \
  --prompt "cinematic slow motion camera push-in, shallow depth of field" \
  --init-image ./first_frame.png \
  --gpu L4 \
  --json
```

### Recipe C: Batch Generation with Chained LoRAs
```bash
comfy-colab image \
  --prompt "futuristic automotive concept, studio lighting" \
  --lora "mech_style.safetensors:0.7,hyperdetail.safetensors:0.4" \
  --count 4 \
  --json
```