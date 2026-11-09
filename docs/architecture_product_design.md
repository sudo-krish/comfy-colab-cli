
Here is the complete **Product Requirements Document (PRD) & System Architecture** for `comfy-colab-cli`.

Because you have the **Google AI Pro** subscription (which unlocks `google-colab-cli` terminal access and 5 TB of Google Drive storage), we don't need brittle browser scrapers at all. Instead, our Node.js CLI (`comfy-colab`) will act as an **intelligent orchestrator** wrapping Google's official `colab` CLI on the host side and `comfy-cli` (`comfy`) inside the remote Colab VM.

---

## Part 1: Core System Architecture & Lifecycle Design

### 1. Authentication & Prerequisites (`comfy-colab auth`)

* **Hard Prerequisite Check:** The CLI verifies that the user is on Linux/macOS (such as your CachyOS setup), checks for `uv` / `google-colab-cli`, and validates an active Google AI Pro / Colab Pro entitlement via `colab usage`.
* **Two-Layer Auth Flow:**

1. **Colab Backend Auth:** Executes `colab auth` (using OAuth2 / Application Default Credentials stored in `~/.config/colab-cli/`).
2. **Model Registry Vault:** Prompts once for your **HuggingFace Token** and **CivitAI API Key** (needed for gated models like Flux or Wan2.1) and stores them encrypted (`AES-256-GCM`, `chmod 600`) at `~/.config/comfy-colab-cli/vault.enc`.

### 2. First-Time Setup & The "Hybrid Drive-to-NVMe" Architecture (`comfy-colab setup`)

Colab VMs are wiped every time they shut down, and reading 15 GB checkpoints directly over a mounted Google Drive FUSE filesystem (`/content/drive/MyDrive`) causes massive I/O bottlenecks during model loading. Conversely, reinstalling Python packages on every boot wastes 5 minutes of GPU compute units.

* **Persistent Storage Layer (Your 5 TB Google Drive):**
* During `comfy-colab setup`, we mount `/content/drive` and create a persistent directory tree at `/content/drive/MyDrive/ComfyUI_Store/`:
* `models/` (`checkpoints/`, `loras/`, `vae/`, `clip/`, `controlnet/`, `unet/`, `text_encoders/`)
* `custom_nodes_snapshot.json` (lockfile of installed custom nodes)
* `workflows/` (reusable API workflow templates)
* **Ephemeral Compute Layer (Colab Local NVMe `/content/ComfyUI`):**
* When a session boots (`comfy-colab up`), the CLI installs `comfy-cli` via `uv` (`uv tool install comfy-cli`), installs ComfyUI onto the fast local VM disk (`/content/ComfyUI`) using `comfy --workspace=/content/ComfyUI install --fast-deps`, and injects an `extra_model_paths.yaml` file pointing directly to `/content/drive/MyDrive/ComfyUI_Store/models/` (or uses `rsync` to copy only the actively requested model into `/content/ComfyUI/models/` for maximum read speed).

### 3. Updating `comfy-cli`, ComfyUI Core, and Custom Nodes (`comfy-colab update`)

Whether a new update drops in 3 days or 2 years, you never have to rebuild the architecture:

* **`comfy-colab update --target cli`**: Runs `uv tool upgrade google-colab-cli` locally and `uv tool upgrade comfy-cli` on the remote VM.
* **`comfy-colab update --target comfy`**: Executes `comfy --workspace=/content/ComfyUI update all` inside the VM, pulling the latest ComfyUI core release (`--version latest` or `--version nightly`), updating all custom nodes, and exporting a fresh `comfy node save-snapshot` to your Google Drive so future ephemeral boots install the exact updated dependency tree.

### 4. Direct CLI-to-CLI Prompt Execution (No Public Tunnel Needed!)

Because `google-colab-cli` gives us direct `colab exec` pipe execution into the VM kernel, **we don't even need a public Cloudflare tunnel for headless agent runs**:

1. Our local Node CLI (`comfy-colab`) takes your flags (`--prompt`, `--lora`, `--model`, `--batch`) and patches a local API workflow JSON in memory.
2. It pipes the patched JSON over `colab exec` to the remote VM where `comfy launch --background` is running on `127.0.0.1:8188`.
3. Inside the VM, `comfy run --workflow /tmp/job.json --wait --json` executes the workflow locally against `127.0.0.1:8188` and streams structured JSON progress events back over stdout to your Node CLI.

### 5. Auto-Download & Cloud Zero-Trace Wipe (`Sync-and-Shred`)

Every generation job writes outputs to `/content/ComfyUI/output/job_<uuid>/` on the Colab VM (never to Google Drive, so your Drive isn't cluttered with temporary generations unless requested).

1. **Pull to Local PC:** As soon as `comfy run` completes, our CLI transfers the generated files from `/content/ComfyUI/output/job_<uuid>/` directly to your local PC folder (e.g., `./outputs/`) and verifies the SHA-256 checksums.
2. **Cloud Shred:** Immediately after checksum verification, the CLI runs `rm -rf /content/ComfyUI/output/job_<uuid>/*` and calls `comfy free --free-memory` to flush VRAM/RAM caches.
3. **VM Teardown:** If running in ephemeral mode (or once the batch queue hits 0), the CLI invokes `colab stop -s <session_id>`, immediately terminating the GPU billing clock.

---

## Part 2: Product Owner Feature Backlog & Test Plan

Below is the prioritized feature list grouped into 6 Epics, along with the validation tests we must pass before publishing to npm.

### Epic 1: Foundation, Auth & Compute Guardrails

* **F1.1 — Prerequisite Doctor (`comfy-colab doctor`):** Checks Node >= 20, Python `uv`, `google-colab-cli` binary presence, and Google AI Pro compute balance (`colab usage`).
* **F1.2 — Encrypted Credential Vault (`comfy-colab auth`):** Triggers Google OAuth (`colab auth`) and encrypts HuggingFace + CivitAI tokens locally.
* **F1.3 — Dual Kill-Switch Watchdog (`comfy-colab up --ttl 20m`):** Spawns both a remote Python idle-monitor inside the Colab kernel (`runtime.unassign()`) and a local detached watchdog process so a crashed AI agent can never leave an A100/L4 GPU running overnight.
* *Test Case T1:* Pull the network plug or `kill -9` the local CLI mid-generation; verify via `colab sessions` that the remote GPU VM self-terminates when the idle TTL expires.

### Epic 2: Persistent Model & LoRA Manager (Google Drive Backed)

* **F2.1 — Remote Model Inventory (`comfy-colab models list [--type checkpoints|loras|vae|unet]`):** Reads `/content/drive/MyDrive/ComfyUI_Store/models/` and outputs a structured JSON table of installed models, file sizes, and base architectures (SDXL, Flux.1, Wan2.1, LTX-Video).
* **F2.2 — Cloud-to-Drive Direct Download (`comfy-colab models pull <url-or-civitai-id> --type <folder>`):** Uses the Colab VM's 1–2 Gbps connection (via `comfy model download` + `aria2c`) to download 10–20 GB checkpoints from HuggingFace or CivitAI straight into your Google Drive folder—zero local bandwidth used.
* **F2.3 — Local-to-Drive Model Upload (`comfy-colab models upload ./local_model.safetensors --type loras`):** Streams custom-trained LoRAs or local checkpoints from your PC to `/content/drive/MyDrive/ComfyUI_Store/models/loras/` with resume support and refreshes ComfyUI's object info cache (`/object_info`).
* **F2.4 — Smart NVMe Hot-Caching (`--hot-cache`):** Copies the specific checkpoint and LoRAs required by the current job from Google Drive into `/content/ComfyUI/models/` before launch so model loading takes 2 seconds instead of 45 seconds.
* *Test Case T2:* Upload a local `.safetensors` LoRA, run `comfy-colab models list --json`, and verify ComfyUI's `/object_info/LoraLoader` registers the new file without restarting the VM.

### Epic 3: Image Generation Engine (Single, Bulk, Prompts & Multi-LoRA)

* **F3.1 — Semantic CLI Prompting (`comfy-colab image`):** Generate without touching raw JSON via flags:
* `--prompt "..."` and `--negative "..."`
* `--model "flux1-dev.safetensors"`
* `--lora "style_v1.safetensors:0.8,detailer.safetensors:0.5"` (supports dynamically chaining multiple LoRAs with `:model_weight:clip_weight`).
* `--size 1024x1024`, `--steps 25`, `--cfg 3.5`, `--seed 42` (or `random`).
* **F3.2 — Bulk / Matrix Batch Generation (`--batch-file prompts.jsonl` or `--count 10`):** Accepts a JSONL/CSV file of 50+ prompts or a seed sweep, keeps the model pinned in GPU VRAM across the entire loop, streams each completed image to your local PC as soon as it finishes, and deletes it from the cloud immediately.
* **F3.3 — Custom Workflow Override (`-w ./custom_api.json --set "node_id.input=val"`):** Allows power users and AI agents to pass any complex ComfyUI API graph while overriding specific node inputs via dot-notation.
* *Test Case T3:* Run a bulk job of 5 prompts with 2 chained LoRAs; verify all 5 PNGs arrive locally, `/content/ComfyUI/output/` is empty, and the model only loaded into VRAM once.

### Epic 4: Video Generation Engine (Wan 2.1, HunyuanVideo, LTX-Video, AnimateDiff)

Video workflows on Colab require specialized hardware and memory management that standard image CLIs fail to handle:

* **F4.1 — Hardware Auto-Escalation:** Automatically selects `L4` (24 GB VRAM) or `A100` (40/80 GB VRAM) with `--high-mem` when a video workflow is invoked, warning if `T4` (16 GB) will OOM.
* **F4.2 — Video-Specific Parameter Injection (`comfy-colab video`):**
* **Text-to-Video (T2V) & Image-to-Video (I2V):** Uploads a local reference image (`--init-image ./frame0.png`) to `/content/ComfyUI/input/` for I2V workflows, and wipes the input image upon completion.
* **Temporal Controls:** `--frames 81`, `--fps 24`, `--resolution 832x480`, `--motion-scale 1.1`.
* **VRAM Tiling & Offloading:** Automatically enables `--gpu-only` or `--lowvram` / VAE tiling flags on `comfy launch` + injects `VHS_VideoCombine` (VideoHelperSuite) settings to encode H.264/MP4 (`cr=19`, `pix_fmt=yuv420p`) directly on the VM.
* **F4.3 — Auto Custom-Node Provisioning for Video:** Pre-packages snapshot profiles for `ComfyUI-VideoHelperSuite`, `ComfyUI-WanVideoWrapper`, and `ComfyUI-Frame-Interpolation` (RIFE) so video nodes never fail with "Missing Node Type".
* *Test Case T4:* Execute an Image-to-Video generation using `--init-image`, verify the `.mp4` downloads locally with valid frame rate/duration, and verify both `/input` and `/output` directories on the Colab VM are scrubbed.

### Epic 5: Self-Updating Lifecycle & Workspace Snapshots

* **F5.1 — Version Pinning & Rollback (`comfy-colab update`):** Supports updating `comfy-cli`, ComfyUI core (`stable` vs `nightly`), and custom nodes, plus saving/restoring environment snapshots on Drive (`comfy-colab snapshot save/restore`) in case a bleeding-edge ComfyUI update breaks a video node.
* *Test Case T5:* Run `comfy-colab update --target all`, verify the updated version strings in `--json`, and restore a previous snapshot.

### Epic 6: AI Agent Skill & Zero-Token-Waste Interface

* **F6.1 — Strict `--json` Envelope Mode:** Every command suppresses spinners, pip logs, and tqdm progress bars when `--json` is passed, returning a compact schema: `{ ok, command, session_id, compute_units_spent_est, outputs: [...], cloud_wiped: true, runtime_status: "terminated" }`.
* **F6.2 — One-Command Skill Installer (`comfy-colab skill install`):** Automatically generates and installs the `SKILL.md` file into your active agent workspace (Cline, Claude Code, Cursor, or custom Agentic Work Package directories).
* *Test Case T6:* Trigger an AI agent prompt ("Generate 3 product hero images using my product-style LoRA and shut down Colab") and verify the total stdout returned to the LLM is under 150 tokens and `colab sessions` shows `0 active sessions` afterward.

---

### How Would You Like to Proceed?

Review this feature list—if there are any extra video or model-management capabilities you want added (or trimmed for v1.0), let me know. Once you approve the backlog, we will start **Phase 1 of Implementation**: writing the `package.json`, the `doctor` / `auth` module wrapping `google-colab-cli`, and the Google Drive storage bootstrap script.
