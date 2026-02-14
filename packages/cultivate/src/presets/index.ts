/**
 * Source preset factories
 * Exports preset configuration factory functions for various data source integrations
 * Organized by tier (1, 2, 3, 4) representing signal authority and source credibility
 */

// Tier 1: Direct feedback / structured sources (authority: 0.8-1.0)
export {
  createSupportTicketPreset,
  createSurveyPreset,
  createInterviewPreset,
} from './tier-1.js';

// Tier 3: Conversational context (authority: 0.5-0.65)
export {
  createSlackPreset,
  createDiscordPreset,
  createTeamsPreset,
  createCRMNotesPreset,
  createSalesCallPreset,
} from './tier-3.js';

// Tier 4: Public / aggregated sources (authority: 0.3-0.5)
export {
  createRedditPreset,
  createHackerNewsPreset,
  createTwitterPreset,
  createRSSPreset,
  createWebScraperPreset,
} from './tier4.js';
