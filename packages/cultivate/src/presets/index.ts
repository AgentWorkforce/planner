/**
 * Source preset factories
 * Exports preset configuration factory functions for various data source integrations
 * Organized by tier (1, 2, 3, 4) representing signal authority and source credibility
 */

export {
  createSlackPreset,
  createDiscordPreset,
  createTeamsPreset,
  createCRMNotesPreset,
  createSalesCallPreset,
} from './tier-3.js';

export {
  createRedditPreset,
  createHackerNewsPreset,
  createTwitterPreset,
  createRSSPreset,
  createWebScraperPreset,
} from './tier4.js';
