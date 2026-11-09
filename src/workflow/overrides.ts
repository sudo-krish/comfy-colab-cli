import type { ComfyApiWorkflow } from '../types/workflow.js';

function parseValue(valStr: string): unknown {
  if (valStr === 'true') {
    return true;
  }
  if (valStr === 'false') {
    return false;
  }
  const num = Number(valStr);
  if (!isNaN(num) && valStr.trim() !== '') {
    return num;
  }
  return valStr;
}

export function applyWorkflowOverride(workflow: ComfyApiWorkflow, overrideStr: string): void {
  const eqIdx = overrideStr.indexOf('=');
  if (eqIdx === -1) {
    return;
  }
  const pathPart = overrideStr.slice(0, eqIdx).trim();
  const valPart = overrideStr.slice(eqIdx + 1).trim();
  const keys = pathPart.split('.');

  const nodeId = keys[0];
  if (!nodeId || !Object.prototype.hasOwnProperty.call(workflow, nodeId)) {
    return;
  }

  const node = workflow[nodeId];
  if (!node || typeof node !== 'object') {
    return;
  }

  const propName = keys[keys.length - 1];
  if (
    !propName ||
    propName === '__proto__' ||
    propName === 'constructor' ||
    propName === 'prototype'
  ) {
    return;
  }

  // Common pattern: "5.inputs.steps=30" or "5.steps=30"
  node.inputs[propName] = parseValue(valPart);
}

export function applyWorkflowOverrides(
  workflow: ComfyApiWorkflow,
  overrides: string[],
): ComfyApiWorkflow {
  const cloned: ComfyApiWorkflow = JSON.parse(JSON.stringify(workflow)) as ComfyApiWorkflow;
  for (const override of overrides) {
    applyWorkflowOverride(cloned, override);
  }
  return cloned;
}
