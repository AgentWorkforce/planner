import { readdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ScenarioSchema, type Scenario, type Difficulty } from './schema.js';

export class ScenarioLoader {
  private readonly scenariosDir: string;
  private cache: Scenario[] | null = null;

  constructor(scenariosDir: string) {
    this.scenariosDir = scenariosDir;
  }

  /**
   * Load all scenarios from the scenarios directory.
   */
  async loadAll(): Promise<Scenario[]> {
    if (this.cache) return this.cache;

    const entries = await readdir(this.scenariosDir);
    const scenarioFiles = entries.filter(
      (f) => (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json')) && !f.endsWith('.test.ts')
    );

    const scenarios: Scenario[] = [];

    for (const file of scenarioFiles) {
      const filepath = resolve(this.scenariosDir, file);
      const ext = extname(file);

      let raw: unknown;
      if (ext === '.json') {
        const { readFileSync } = await import('node:fs');
        raw = JSON.parse(readFileSync(filepath, 'utf-8'));
      } else {
        const mod = await import(pathToFileURL(filepath).href);
        raw = mod.default ?? mod;
      }

      const parsed = ScenarioSchema.parse(raw);
      scenarios.push(parsed);
    }

    this.cache = scenarios;
    return scenarios;
  }

  /**
   * Load a single scenario by ID.
   */
  async load(id: string): Promise<Scenario | undefined> {
    const all = await this.loadAll();
    return all.find((s) => s.id === id);
  }

  /**
   * Load scenarios filtered by difficulty.
   */
  async loadByDifficulty(difficulty: Difficulty): Promise<Scenario[]> {
    const all = await this.loadAll();
    return all.filter((s) => s.difficulty === difficulty);
  }

  /**
   * Clear the cache to force reload on next access.
   */
  clearCache(): void {
    this.cache = null;
  }
}
