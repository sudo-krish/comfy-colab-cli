import fs from 'node:fs';
import path from 'node:path';

export function generateSkillMarkdown(): string {
  return `---
name: comfy-colab
description: Headless AI agent orchestrator to spin up ComfyUI on Google Colab GPU runtimes, execute image/video workflows, and auto-terminate GPU billing.
---

# ComfyUI on Google Colab (Headless CLI Skill)

Use \`comfy-colab\` to run ComfyUI generation jobs directly on Google Colab GPUs without requiring any browser interaction or public tunnels.

## Key Rules for AI Agents:
1. **Always use \`--json\`**: Guarantees concise, machine-parseable JSON envelopes (<150 tokens) and suppresses interactive spinners.
2. **Auto-Termination**: Use \`--auto-terminate\` or \`comfy-colab stop\` to avoid wasting GPU compute units when generation batches complete.
3. **Model Management**: Check available models via \`comfy-colab models list --json\` before generating.

## Common Agent Commands:
- Check environment:
  \`comfy-colab doctor --json\`
- List available models on Google Drive:
  \`comfy-colab models list --json\`
- Generate an image:
  \`comfy-colab image --prompt "a cybernetic wolf in neon rain" --model "v1-5-pruned-emaonly.safetensors" --json\`
- Chain multiple LoRAs:
  \`comfy-colab image --prompt "hero shot" --lora "style.safetensors:0.8,detail.safetensors:0.5" --json\`
- Stop VM session immediately:
  \`comfy-colab stop --json\`
`.trim();
}

export function installSkill(targetDir?: string): string {
  const dir = targetDir || path.resolve('.gemini', 'skills', 'comfy-colab');
  fs.mkdirSync(dir, { recursive: true });
  const skillFile = path.join(dir, 'SKILL.md');
  fs.writeFileSync(skillFile, generateSkillMarkdown(), 'utf8');
  return skillFile;
}

