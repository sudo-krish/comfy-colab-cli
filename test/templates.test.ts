import { describe, it, expect } from 'vitest';
import { listGoldenTemplates, getGoldenTemplate } from '../src/workflow/templates.js';

describe('Golden Workflow Templates', () => {
  it('lists available golden templates', () => {
    const list = listGoldenTemplates();
    expect(list).toContain('flux');
    expect(list).toContain('sdxl');
    expect(list).toContain('wan21');
  });

  it('retrieves flux golden template with UNETLoader and DualCLIPLoader', () => {
    const flux = getGoldenTemplate('flux');
    expect(flux).toBeDefined();
    expect(flux?.['1']?.class_type).toBe('UNETLoader');
    expect(flux?.['2']?.class_type).toBe('DualCLIPLoader');
    expect(flux?.['8']?.class_type).toBe('SaveImage');
  });

  it('retrieves sdxl golden template with CheckpointLoaderSimple', () => {
    const sdxl = getGoldenTemplate('SDXL');
    expect(sdxl).toBeDefined();
    expect(sdxl?.['1']?.class_type).toBe('CheckpointLoaderSimple');
    expect(sdxl?.['7']?.class_type).toBe('SaveImage');
  });

  it('retrieves wan21 golden template with VHS_VideoCombine', () => {
    const wan = getGoldenTemplate('wan21');
    expect(wan).toBeDefined();
    expect(wan?.['6']?.class_type).toBe('VHS_VideoCombine');
  });

  it('returns null for unknown template', () => {
    expect(getGoldenTemplate('non_existent')).toBeNull();
  });
});
