# comfy-colab-cli

> **Headless CLI and AI Agent Skill to spin up ComfyUI on Google Colab GPU runtimes, execute image and video workflows, manage persistent models on 5 TB Google Drive, and auto-terminate GPU sessions.**

[![CI Quality Pipeline](https://github.com/sudo-krish/comfy-colab-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/sudo-krish/comfy-colab-cli/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node: >=20](https://img.shields.io/badge/node-%3E%3D20-green.svg)](https://nodejs.org/)
[![Zero Runtime Dependencies](https://img.shields.io/badge/dependencies-0%20runtime-brightgreen.svg)](package.json)
[![Coverage: 95%+](https://img.shields.io/badge/coverage-95%25-success.svg)](test/)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](tsconfig.json)

---

## Table of Contents

- [1. Executive Overview](#1-executive-overview)
- [2. System Architecture](#2-system-architecture)
- [3. Prerequisites & Environment](#3-prerequisites--environment)
- [4. Quickstart Guide (Human Walkthrough)](#4-quickstart-guide-human-walkthrough)
- [5. CLI Command Reference](#5-cli-command-reference)
- [6. Machine Interface: AI Agent Protocol (`--json`)](#6-machine-interface-ai-agent-protocol---json)
- [7. Hardware Escalation & GPU Matrix](#7-hardware-escalation--gpu-matrix)
- [8. Hybrid Drive-to-NVMe Model Architecture](#8-hybrid-drive-to-nvme-model-architecture)
- [9. Video Engine (Wan 2.1 & Hunyuan)](#9-video-engine-wan-21--hunyuan)
- [10. Developer Guide & Quality Gates](#10-developer-guide--quality-gates)
- [11. License](#11-license)

---

## 1. Executive Overview

Running ComfyUI on ephemeral Google Colab VMs traditionally suffers from three critical bottlenecks:
1. **Fragile Web UI Automation**: Browser scrapers, reverse proxies, and Cloudflare tunnels break frequently and waste compute units while idling.
2. **Slow Drive FUSE Reads**: Reading 15 GB checkpoints (e.g., Flux.1 or SDXL) directly over mounted Google Drive FUSE (`/content/drive/MyDrive`) creates severe I/O stalls during model loading (45–90 seconds per model load).
3. **Execution Timeouts**: `colab exec` imposes a strict 30-second execution timeout, causing standard blocking runs on multi-minute diffusion or video workloads to fail.

`comfy-colab-cli` eliminates these problems through a **zero-tunnel, headless orchestrator**:
- **Direct CLI-to-CLI Kernel Piping**: Leverages Google's official `google-colab-cli` to pipe commands and API graphs directly into the VM kernel.
- **In-VM Long-Polling Pipeline**: Workflow submissions post to `http://127.0.0.1:8188/prompt`, returning immediately. A detached in-VM background runner polls `/history/{prompt_id}` and atomically writes progress to `/tmp/job_<id>.status`. The host CLI executes short in-VM long-poll calls (up to 24s per exec), completely bypassing the 30-second timeout.
- **Hybrid Storage & NVMe Hot-Caching**: Persistent checkpoints and LoRAs live on your 5 TB Google Drive (`/content/drive/MyDrive/ComfyUI_Store/`), while actively used models are hot-cached onto local NVMe (`/content/ComfyUI/models/`), reducing load times to ~2 seconds.
- **Sync-and-Shred Automation**: Outputs are downloaded directly to `./outputs/` with SHA-256 verification, after which remote cloud scratch files are shredded and VRAM is flushed (`POST /free`).
- **Zero Runaway Billing**: In-kernel Python watchdogs trigger `google.colab.runtime.unassign()` if an idle heartbeat expires (default: 20 minutes), ensuring you are never billed overnight if your machine disconnects.
- **Zero Production Dependencies**: Built exclusively with pure Node.js 22 built-ins (`node:crypto`, `node:child_process`, `node:fs`, `node:path`, `node:util`).

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Host["Host Machine (Linux / macOS / AI Agent)"]
        CLI["comfy-colab CLI & Node.js Engine"]
        Vault["AES-256-GCM Vault<br/>~/.config/comfy-colab-cli/vault.enc<br/>(HF & CivitAI Tokens)"]
        Outputs["Local Outputs Directory<br/>./outputs/ (Verified SHA-256)"]
        ColabCLI["google-colab-cli binary"]
    end

    subgraph GoogleCloud["Google Colab Cloud Infrastructure"]
        subgraph ColabVM["Ephemeral Colab GPU Runtime (L4 / A100 / T4)"]
            Watchdog["In-Kernel Idle Watchdog<br/>(runtime.unassign countdown)"]
            ComfyServer["ComfyUI Server<br/>(127.0.0.1:8188)"]
            NVMe["Fast Local NVMe Disk<br/>/content/ComfyUI"]
            OutputFolder["Ephemeral Job Scratch<br/>/content/ComfyUI/output/job_<uuid>/"]
            StatusFile["Detached Runner Status<br/>/tmp/job_<id>.status"]
        end

        subgraph PersistentDrive["Persistent Storage (5 TB Google Drive)"]
            DriveRoot["/content/drive/MyDrive/ComfyUI_Store/"]
            Models["models/<br/>(checkpoints, loras, vae, unet)"]
            Snapshots["snapshots/<br/>(custom_nodes lockfiles)"]
        end
    end

    CLI -->|Read Secrets| Vault
    CLI -->|Execute| ColabCLI
    ColabCLI -->|colab new / stop| ColabVM
    ColabCLI -->|colab drivemount| PersistentDrive
    ColabCLI -->|Submit POST /prompt| ComfyServer
    ComfyServer -->|Render| OutputFolder
    OutputFolder -->|Download & Checksum| Outputs
    Outputs -->|Cloud Shred| OutputFolder
    StatusFile -->|Sub-30s Long-Poll| CLI
    DriveRoot -->|Hot-Cache| NVMe
    Watchdog -.->|Idle TTL Exceeded| ColabVM
```

---

## 3. Prerequisites & Environment

| Requirement | Supported Version | Notes |
| :--- | :--- | :--- |
| **Operating System** | Linux (CachyOS, Arch, Ubuntu, Fedora) or macOS | Tested on Linux x86_64 and arm64 macOS |
| **Node.js** | `>= 20.0.0` (Recommended: Node 22 LTS) | Pure ESM; uses built-in Node standard modules |
| **Python Package Manager** | `uv` (`>= 0.4.0`) | Recommended for instant tool installation |
| **Google Colab CLI** | `google-colab-cli` (`colab`) | Install via `uv tool install google-colab-cli` |
| **Google Account** | Google AI Pro or Colab Pro subscription | Provides terminal access & 5 TB Google Drive |

---

## 4. Quickstart Guide (Human Walkthrough)

### Step 1: Diagnose Environment
Run the doctor check to verify that Node, `uv`, `google-colab-cli`, OAuth authentication, and GPU compute quotas are ready:
```bash
comfy-colab doctor
```

### Step 2: Configure Authenticated Model Registries
Store your HuggingFace and CivitAI API tokens in the machine-bound `AES-256-GCM` encrypted vault (`chmod 600`):
```bash
comfy-colab auth --hf hf_yourTokenHere --civitai civit_yourKeyHere
```

### Step 3: Scaffold Persistent Google Drive Storage
Initialize the persistent folder tree on your Google Drive:
```bash
comfy-colab setup
```
*(Creates `/content/drive/MyDrive/ComfyUI_Store/models/` and injects `extra_model_paths.yaml`).*

### Step 4: Generate Your First Image (Flux.1 Dev)
Run an end-to-end headless job with NVMe hot-caching and automatic ephemeral VM termination:
```bash
comfy-colab run \
  --template flux \
  --prompt "a majestic cybernetic lion in neon savanna, photorealistic 8k, volumetric lighting" \
  --hot-cache flux1-dev.safetensors \
  --output ./outputs \
  --ephemeral
```
Your image is rendered on Colab, downloaded to `./outputs/`, verified via SHA-256, cloud outputs are wiped, and the Colab VM is shut down to prevent billing leaks.

---

## 5. CLI Command Reference

All commands support both human-friendly console output and strict `--json` envelope mode.

| Command | Subcommand / Options | Description | Example Usage |
| :--- | :--- | :--- | :--- |
| `doctor` | `[--json]` | Diagnose system dependencies, Colab OAuth state, and compute balance. | `comfy-colab doctor --json` |
| `auth` | `[--hf <tok>] [--civitai <key>] [--json]` | Manage encrypted credentials in `vault.enc`. | `comfy-colab auth --hf hf_xxx --json` |
| `setup` | `[--path <drive_path>] [--json]` | Scaffold Drive directory tree and write `extra_model_paths.yaml`. | `comfy-colab setup --json` |
| `up` | `[--gpu L4\|A100\|T4] [--ttl <min>] [--mount-drive] [--bootstrap] [--json]` | Spin up Colab VM, mount Drive, and inject idle watchdog. | `comfy-colab up --gpu L4 --ttl 20 --json` |
| `stop` | `[-s\|--session <name>] [--json]` | Terminate a running Colab session immediately. | `comfy-colab stop -s comfy-session --json` |
| `sessions` | `[--json]` | List active Colab VM sessions and their states. | `comfy-colab sessions --json` |
| `image` | `--prompt <text> [--model <ckpt>] [--lora <chain>] [--set <override>] [--count <n>] [--batch-file <file>] [--json]` | Generate images, chain multiple LoRAs, or execute batch seed sweeps. | `comfy-colab image --prompt "hero" --lora "style:0.8" --json` |
| `video` | `--prompt <text> [--init-image <img.png>] [--model <ckpt>] [--gpu L4\|A100] [--json]` | Generate video with Wan 2.1 / VHS (T2V & I2V) with VRAM hardware checks. | `comfy-colab video --prompt "drone shot" --gpu L4 --json` |
| `template` | `list \| show <name> [--json]` | Inspect built-in golden API workflows (`flux`, `sdxl`, `wan21`). | `comfy-colab template show flux --json` |
| `run` | `[--template <name>] [-w <file.json>] [--prompt <text>] [--set <override>] [--output <dir>] [--hot-cache <ckpt>] [--ephemeral] [--json]` | Unified end-to-end execution pipeline with hot-cache and auto-teardown. | `comfy-colab run --template flux --ephemeral --json` |
| `models` | `list [--type <dir>] \| pull <url> [--type <dir>] \| upload <path> [--type <dir>] [--json]` | Inventory Drive models, pull via `aria2c` directly to Drive, or upload local LoRAs. | `comfy-colab models list --type loras --json` |
| `snapshot` | `save [name] \| restore <file.json> [--json]` | Save or restore custom node lockfiles on Google Drive. | `comfy-colab snapshot save stable_v1 --json` |
| `update` | `[--target cli\|comfy\|all] [--json]` | Upgrade `google-colab-cli`, `comfy-cli`, or ComfyUI core. | `comfy-colab update --target all --json` |
| `skill` | `install [--target <dir>] [--json]` | Generate and install `SKILL.md` into AI agent workspaces. | `comfy-colab skill install --json` |

---

## 6. Machine Interface: AI Agent Protocol (`--json`)

`comfy-colab-cli` is built from the ground up for autonomous AI coding agents (Claude Code, Antigravity, Cursor, Cline).

### Guarantees
1. **Deterministic Exit Codes**: `0` on success; `1` on error.
2. **Token Efficiency**: Every command executed with `--json` outputs a compact payload under **150 tokens**.
3. **No Terminal Hijacking**: Interactive spinners, banners, and progress bars are strictly suppressed.

### Standard Success Schema
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

### Standard Error Schema
```json
{
  "ok": false,
  "command": "video",
  "error": {
    "code": "ERR_GPU_OOM",
    "message": "GPU 'T4' has insufficient VRAM for 14B video generation. Escalating to 'L4' (24 GB) or 'A100' is strongly recommended."
  }
}
```

### Installing the Agent Skill
To equip an agent workspace with the skill instructions:
```bash
comfy-colab skill install
```
This generates an exhaustive, production-grade `SKILL.md` in `.gemini/skills/comfy-colab/` (or your chosen agent workspace directory).

---

## 7. Hardware Escalation & GPU Matrix

Colab provides multiple GPU tiers. Using the wrong tier leads to Out-Of-Memory (OOM) crashes:

| Workflow / Architecture | Checkpoint Examples | Minimum GPU | Recommended GPU | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **SD 1.5** | `v1-5-pruned-emaonly.safetensors` | `T4` (16 GB) | `T4` | Low compute unit consumption (~0.2 units/hr) |
| **SDXL Base** | `sd_xl_base_1.0.safetensors` | `T4` (16 GB) | `L4` (24 GB) | Faster step iterations on Ada Lovelace architecture |
| **Flux.1 Dev / Schnell** | `flux1-dev.safetensors` (12B/FP8) | `L4` (24 GB) | `L4` / `A100` | Requires high RAM and fast FP8 tensor cores |
| **Wan 2.1 Video (T2V / I2V)** | `wan2.1_t2v_14B_fp8.safetensors` | `L4` (24 GB) | `L4` / `A100` | **T4 will OOM.** CLI warns and auto-escalates |
| **HunyuanVideo / LTX-Video** | `hunyuan_video.safetensors` | `L4` (24 GB) | `A100` (40/80 GB) | Enable VRAM tiling & `--lowvram` |

---

## 8. Hybrid Drive-to-NVMe Model Architecture

```
/content/drive/MyDrive/ComfyUI_Store/      <-- Persistent (5 TB Google Drive)
├── models/
│   ├── checkpoints/                      <-- Base checkpoints (SDXL, Flux, Wan)
│   ├── loras/                            <-- Custom LoRAs and styles
│   ├── vae/                              <-- VAE weights (ae.safetensors)
│   ├── clip/                             <-- CLIP & T5 text encoders
│   ├── controlnet/                       <-- ControlNet models
│   └── unet/                             <-- Standalone UNET models
├── snapshots/                            <-- custom_nodes version lockfiles
└── workflows/                            <-- Reusable API JSON graphs
```

### Direct Cloud-to-Drive Pull (`models pull`)
Instead of downloading 20 GB models to your local machine and slowly uploading them, `comfy-colab models pull` executes directly on the remote Colab VM at 1–2 Gbps:
```bash
comfy-colab models pull \
  https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors \
  --type checkpoints \
  --json
```

### NVMe Hot-Caching (`--hot-cache`)
Before executing a generation job, passing `--hot-cache <filename>` copies the model from the Google Drive mount directly to `/content/ComfyUI/models/checkpoints/` on local NVMe disk, completely eliminating FUSE read latency.

---

## 9. Video Engine (Wan 2.1 & Hunyuan)

`comfy-colab video` automates the generation of temporal video sequences:
- **Text-to-Video (T2V)**: Generates 81-frame sequences encoded to H.264 MP4 (`yuv420p`) via `VHS_VideoCombine`.
- **Image-to-Video (I2V)**: Uploads an initial keyframe (`--init-image ./frame.png`), injects `LoadImage` and `VAEEncode` nodes, and cleans up the input frame post-generation.
- **Hardware Verification**: Automatically tests GPU VRAM and warns against running on T4 runtimes.

Example Text-to-Video:
```bash
comfy-colab video \
  --prompt "cinematic flythrough of a futuristic neon cyber-city at dusk, 4k" \
  --gpu L4 \
  --json
```

---

## 10. Developer Guide & Quality Gates

This repository enforces an **8-stage shift-left industrial quality pipeline** via `.makelib`:

```bash
# Initialize development environment and git hooks
make init

# Run all 8 quality gates (ESLint strict, TypeScript strict, McCabe <= 10, Vitest >= 80%, detect-secrets, audit)
make check-all

# Run Vitest test suite with V8 code coverage
make test

# Format codebase with Prettier
make format

# Build production distribution bundles (CJS and ESM dual build)
make build
```

### Git Branch Policy
Enforced via native Git pre-commit hooks:
`^(feat|feature|fix|patch|major|breaking|docs|chore|refactor|ci)/[a-z0-9._-]+$`

---

## 11. License

Apache License 2.0. See [LICENSE](LICENSE) for details.
