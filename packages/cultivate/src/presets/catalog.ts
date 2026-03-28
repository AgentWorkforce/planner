/**
 * Preset catalog with stable string IDs
 *
 * Builds an ID-indexed map from all preset factory functions.
 * IDs are kebab-case slugs derived from the preset name
 * (e.g., "Support Tickets" -> "support-tickets").
 *
 * This module is the single source of truth for looking up presets by ID,
 * used by both the GET /presets endpoint and the quick-start handler.
 */

import type { SourcePreset } from '../schemas.js';
import {
  createSupportTicketPreset,
  createSurveyPreset,
  createInterviewPreset,
  createSlackPreset,
  createDiscordPreset,
  createTeamsPreset,
  createCRMNotesPreset,
  createSalesCallPreset,
  createRedditPreset,
  createHackerNewsPreset,
  createTwitterPreset,
  createRSSPreset,
  createWebScraperPreset,
} from './index.js';

export interface CatalogEntry {
  id: string;
  preset: SourcePreset;
}

/**
 * Convert a preset name to a stable kebab-case ID
 * e.g., "Support Tickets" -> "support-tickets"
 *       "CRM Notes (Salesforce)" -> "crm-notes-salesforce"
 *       "Twitter/X" -> "twitter-x"
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '') // remove parens
    .replace(/[/]/g, '-') // slashes to hyphens
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/-+/g, '-')  // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * Build the full preset catalog.
 * Returns an array of { id, preset } entries.
 */
function buildCatalog(): CatalogEntry[] {
  const factories = [
    // Tier 1: Direct feedback / structured sources
    createSupportTicketPreset,
    createSurveyPreset,
    createInterviewPreset,

    // Tier 3: Conversational context
    createSlackPreset,
    createDiscordPreset,
    createTeamsPreset,
    createCRMNotesPreset,
    createSalesCallPreset,

    // Tier 4: Public / aggregated sources
    createRedditPreset,
    createHackerNewsPreset,
    createTwitterPreset,
    createRSSPreset,
    createWebScraperPreset,
  ];

  return factories.map((factory) => {
    const preset = factory();
    return { id: toSlug(preset.name), preset };
  });
}

// Lazily cached catalog
let _catalog: CatalogEntry[] | null = null;
let _catalogMap: Map<string, CatalogEntry> | null = null;

/**
 * Get the full preset catalog as an array
 */
export function getPresetCatalog(): CatalogEntry[] {
  if (!_catalog) {
    _catalog = buildCatalog();
  }
  return _catalog;
}

/**
 * Get the preset catalog indexed by ID for O(1) lookup
 */
export function getPresetCatalogMap(): Map<string, CatalogEntry> {
  if (!_catalogMap) {
    _catalogMap = new Map(getPresetCatalog().map((entry) => [entry.id, entry]));
  }
  return _catalogMap;
}

/**
 * Look up a single preset by ID
 * Returns undefined if the ID is not found
 */
export function getPresetById(id: string): CatalogEntry | undefined {
  return getPresetCatalogMap().get(id);
}
