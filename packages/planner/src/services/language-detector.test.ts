import { describe, it, expect } from 'vitest';
import { createStep } from '../domain/step.js';
import {
  detectLanguageTier,
  analyzeLanguage,
  extractFileExtensions,
  extractLanguageKeywords,
  detectDomains,
  detectDomainAdjustment,
  getEffectiveMultiplier,
  enrichStepsWithLanguageTier,
  analyzeLanguageBatch,
} from './language-detector.js';

describe('extractFileExtensions', () => {
  it('should extract .py extension', () => {
    const exts = extractFileExtensions('Update main.py file');
    expect(exts).toContain('.py');
  });

  it('should extract multiple extensions', () => {
    const exts = extractFileExtensions('Modify src/app.ts and utils.js');
    expect(exts).toContain('.ts');
    expect(exts).toContain('.js');
  });

  it('should return empty for text without extensions', () => {
    const exts = extractFileExtensions('Just some plain text');
    expect(exts).toEqual([]);
  });

  it('should handle .cob extension', () => {
    const exts = extractFileExtensions('Fix legacy.cob program');
    expect(exts).toContain('.cob');
  });
});

describe('extractLanguageKeywords', () => {
  it('should detect typescript keyword', () => {
    const keywords = extractLanguageKeywords('Write TypeScript code');
    expect(keywords.length).toBeGreaterThanOrEqual(1);
    expect(keywords.some(([lang]) => lang === 'typescript')).toBe(true);
  });

  it('should detect python keyword', () => {
    const keywords = extractLanguageKeywords('Python script for data processing');
    expect(keywords.some(([lang]) => lang === 'python')).toBe(true);
  });

  it('should detect cobol keyword', () => {
    const keywords = extractLanguageKeywords('COBOL legacy modernization');
    expect(keywords.some(([lang]) => lang === 'cobol')).toBe(true);
  });

  it('should return empty for text without language keywords', () => {
    const keywords = extractLanguageKeywords('Just some general text');
    expect(keywords).toEqual([]);
  });
});

describe('detectDomains', () => {
  it('should detect mobile domain', () => {
    const domains = detectDomains('Build iOS app with React Native');
    expect(domains).toContain('mobile');
  });

  it('should detect embedded domain', () => {
    const domains = detectDomains('Firmware update for microcontroller');
    expect(domains).toContain('embedded');
  });

  it('should detect multiple domains', () => {
    const domains = detectDomains('Deploy ML model with kubernetes');
    expect(domains).toContain('ml');
    expect(domains).toContain('devops');
  });

  it('should return empty for generic text', () => {
    const domains = detectDomains('Simple web application');
    expect(domains).toEqual([]);
  });
});

describe('detectDomainAdjustment', () => {
  it('should return 0 for step without domain signals', () => {
    const step = createStep('Generic task', { description: 'Just code' });
    expect(detectDomainAdjustment(step)).toBe(0);
  });

  it('should return mobile adjustment', () => {
    const step = createStep('Mobile task', {
      description: 'Build iOS feature',
    });
    expect(detectDomainAdjustment(step)).toBe(0.25);
  });

  it('should return embedded adjustment', () => {
    const step = createStep('Embedded task', {
      description: 'Program the embedded firmware',
    });
    expect(detectDomainAdjustment(step)).toBe(1.0);
  });

  it('should return highest adjustment when multiple domains', () => {
    const step = createStep('Complex task', {
      description: 'Deploy ML model on embedded device with kubernetes',
    });
    // embedded = 1.0 is highest
    expect(detectDomainAdjustment(step)).toBe(1.0);
  });
});

describe('detectLanguageTier', () => {
  it('should detect tier S from .py extension', () => {
    const step = createStep('Python task', {
      description: 'Update main.py',
    });
    expect(detectLanguageTier(step)).toBe('s');
  });

  it('should detect tier A from .go extension', () => {
    const step = createStep('Go task', {
      description: 'Modify server.go',
    });
    expect(detectLanguageTier(step)).toBe('a');
  });

  it('should detect tier D from .cob extension', () => {
    const step = createStep('COBOL task', {
      description: 'Fix legacy.cob',
    });
    expect(detectLanguageTier(step)).toBe('d');
  });

  it('should detect tier S from typescript keyword', () => {
    const step = createStep('TS task', {
      description: 'Write TypeScript service',
    });
    expect(detectLanguageTier(step)).toBe('s');
  });

  it('should default to tier A for unknown content', () => {
    const step = createStep('Generic task', {
      description: 'Do something',
    });
    expect(detectLanguageTier(step)).toBe('a');
  });

  it('should use most optimistic tier with multiple extensions', () => {
    // .py (S) and .go (A) => S wins (lower multiplier)
    const step = createStep('Multi-lang', {
      description: 'Update main.py and server.go',
    });
    expect(detectLanguageTier(step)).toBe('s');
  });

  it('should detect from scope field', () => {
    const step = createStep('Scoped task', {
      scope: 'python-service',
      description: 'Deploy the service',
    });
    // "python" keyword in scope
    expect(detectLanguageTier(step)).toBe('s');
  });
});

describe('analyzeLanguage', () => {
  it('should return high confidence for extension detection', () => {
    const step = createStep('Task', { description: 'Edit main.py' });
    const result = analyzeLanguage(step);
    expect(result.confidence).toBe('high');
    expect(result.detectedFrom).toBe('extension');
  });

  it('should return medium confidence for keyword detection', () => {
    const step = createStep('Task', {
      description: 'Write TypeScript code',
    });
    const result = analyzeLanguage(step);
    expect(result.confidence).toBe('medium');
    expect(result.detectedFrom).toBe('keyword');
  });

  it('should return low confidence for default detection', () => {
    const step = createStep('Task', { description: 'Generic work' });
    const result = analyzeLanguage(step);
    expect(result.confidence).toBe('low');
    expect(result.detectedFrom).toBe('default');
    expect(result.tier).toBe('a');
  });

  it('should include detected domains', () => {
    const step = createStep('Task', {
      description: 'Build iOS app.swift',
    });
    const result = analyzeLanguage(step);
    expect(result.domains).toContain('mobile');
  });

  it('should include domain adjustment', () => {
    const step = createStep('Task', {
      description: 'Firmware update for embedded microcontroller in main.c',
    });
    const result = analyzeLanguage(step);
    expect(result.domainAdjustment).toBe(1.0);
  });
});

describe('getEffectiveMultiplier', () => {
  it('should return tier multiplier for step without domain', () => {
    const step = createStep('Task', { description: 'Edit main.py' });
    const multiplier = getEffectiveMultiplier(step);
    expect(multiplier).toBe(1.0); // Tier S = 1.0
  });

  it('should add domain adjustment to tier multiplier', () => {
    const step = createStep('Task', {
      description: 'Build iOS app.swift',
    });
    // Swift = tier B (2.0) + mobile (0.25) = 2.25
    const multiplier = getEffectiveMultiplier(step);
    expect(multiplier).toBe(2.25);
  });

  it('should use pre-set language_tier if available', () => {
    const step = createStep('Task', {
      description: 'Just code',
      language_tier: 'd',
    });
    // Tier D = 5.0, no domain
    const multiplier = getEffectiveMultiplier(step);
    expect(multiplier).toBe(5.0);
  });
});

describe('enrichStepsWithLanguageTier', () => {
  it('should add tier to steps without one', () => {
    const steps = [
      createStep('Task 1', { description: 'Edit main.py' }),
      createStep('Task 2', { description: 'Generic work' }),
    ];

    const enriched = enrichStepsWithLanguageTier(steps);
    expect(enriched[0].language_tier).toBe('s');
    expect(enriched[1].language_tier).toBe('a'); // default
  });

  it('should preserve existing tier', () => {
    const step = createStep('Task', {
      description: 'Edit main.py',
      language_tier: 'd', // Manual override
    });

    const enriched = enrichStepsWithLanguageTier([step]);
    expect(enriched[0].language_tier).toBe('d');
  });
});

describe('analyzeLanguageBatch', () => {
  it('should analyze multiple steps', () => {
    const steps = [
      createStep('Task 1', { description: 'Edit main.py' }),
      createStep('Task 2', { description: 'Build server.go' }),
    ];

    const results = analyzeLanguageBatch(steps);
    expect(results.size).toBe(2);

    for (const step of steps) {
      expect(results.has(step.step_id)).toBe(true);
    }
  });
});
