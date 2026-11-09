import { describe, expect, it } from 'vitest';
import { applyWorkflowOverrides } from '../src/workflow/overrides.js';
import type { ComfyApiWorkflow } from '../src/types/workflow.js';

describe('Workflow Dot-Notation Overrides', () => {
  const baseWorkflow: ComfyApiWorkflow = {
    '5': {
      class_type: 'KSampler',
      inputs: {
        steps: 20,
        cfg: 7.0,
        denoise: 1.0,
      },
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: 'original prompt',
      },
    },
  };

  it('applies numeric, string, and boolean overrides', () => {
    const overrides = [
      '5.inputs.steps=45',
      '5.inputs.cfg=8.5',
      '2.inputs.text=overridden prompt',
      '5.inputs.enabled=true',
    ];
    const modified = applyWorkflowOverrides(baseWorkflow, overrides);

    expect(modified['5']?.inputs['steps']).toBe(45);
    expect(modified['5']?.inputs['cfg']).toBe(8.5);
    expect(modified['2']?.inputs['text']).toBe('overridden prompt');
    expect(modified['5']?.inputs['enabled']).toBe(true);

    // Verify original workflow is not mutated
    expect(baseWorkflow['5']?.inputs['steps']).toBe(20);
  });

  it('ignores malformed overrides or non-existent nodes', () => {
    const overrides = ['invalid_no_equal_sign', '99.inputs.steps=50', '5.__proto__.polluted=true'];
    const modified = applyWorkflowOverrides(baseWorkflow, overrides);

    expect(modified['5']?.inputs['steps']).toBe(20);
    expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
