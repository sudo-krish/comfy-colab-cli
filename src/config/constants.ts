import os from 'node:os';
import path from 'node:path';

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'comfy-colab-cli');
export const VAULT_FILE = path.join(CONFIG_DIR, 'vault.enc');
export const COLAB_CONFIG_DIR = path.join(os.homedir(), '.config', 'colab-cli');
export const DEFAULT_OUTPUTS_DIR = path.resolve('outputs');

export const REMOTE_DRIVE_STORE = '/content/drive/MyDrive/ComfyUI_Store';
export const REMOTE_COMFY_DIR = '/content/ComfyUI';
export const REMOTE_OUTPUT_DIR = '/content/ComfyUI/output';
export const REMOTE_STATUS_DIR = '/tmp';
export const COMFY_LOCAL_PORT = 8188;

export const DEFAULT_TTL_MINUTES = 20;
export const IN_VM_LONG_POLL_TIMEOUT_SEC = 24;
export const COLAB_EXEC_TIMEOUT_SEC = 29.0;

export const DEFAULT_GPU_IMAGE = 'T4';
export const DEFAULT_GPU_VIDEO = 'L4';
