/**
 * Tier 3 Source Presets (channel_authority: 0.5-0.65)
 * Conversational context sources with moderate authority
 *
 * These sources represent discussion channels and conversational platforms
 * where signal may be present but requires higher confidence thresholds
 * due to potential noise and bias.
 */

import type { SourcePreset } from '../schemas';

/**
 * Slack preset factory
 * Creates configuration for polling Slack channels via API
 *
 * Authority: 0.55 - Team discussions carry moderate signal but require context awareness
 *
 * Requirements:
 * - Bot token with channels:read permissions
 * - Channel IDs or channel names to monitor
 * - Optional: conversation history limit, message type filtering
 */
export function createSlackPreset(): SourcePreset {
  return {
    name: 'Slack',
    adapter_type: 'poll_api',
    description:
      'Monitor Slack channels for discussions and conversations. Polls channels at configured intervals to retrieve new messages. Supports filtering by thread context and conversation participants.',
    required_inputs: [
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        description: 'Slack bot token with channels:read and users:read permissions (starts with xoxb-)',
      },
      {
        key: 'channel_ids',
        label: 'Channel IDs',
        type: 'string',
        description:
          'Comma-separated list of Slack channel IDs to monitor (e.g., C123456789,C987654321)',
      },
    ],
    optional_inputs: [
      {
        key: 'message_limit',
        label: 'Message Limit',
        type: 'number',
        description: 'Maximum number of recent messages to retrieve per channel (default: 100)',
        default: 100,
      },
      {
        key: 'exclude_bot_messages',
        label: 'Exclude Bot Messages',
        type: 'string',
        description: 'Whether to exclude messages from bots (true/false, default: true)',
        default: 'true',
      },
      {
        key: 'include_thread_replies',
        label: 'Include Thread Replies',
        type: 'string',
        description: 'Whether to include threaded replies as separate signals (true/false, default: false)',
        default: 'false',
      },
    ],
    defaults: {
      poll_interval_ms: 300000, // 5 minutes
      author_type: 'user',
    },
    channel_authority: 0.55,
  };
}

/**
 * Discord preset factory
 * Creates configuration for polling Discord channels via API
 *
 * Authority: 0.52 - Community discussions with moderate signal quality
 *
 * Requirements:
 * - Bot token with message.read permissions
 * - Server (guild) ID and channel IDs
 * - Optional: message filtering by role or user
 */
export function createDiscordPreset(): SourcePreset {
  return {
    name: 'Discord',
    adapter_type: 'poll_api',
    description:
      'Monitor Discord channels for community discussions. Polls channels at configured intervals to retrieve new messages. Supports filtering by channel type and message context.',
    required_inputs: [
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        description: 'Discord bot token with message.read and channel.read permissions',
      },
      {
        key: 'guild_id',
        label: 'Server ID',
        type: 'string',
        description: 'Discord server (guild) ID where channels are located',
      },
      {
        key: 'channel_ids',
        label: 'Channel IDs',
        type: 'string',
        description: 'Comma-separated list of Discord channel IDs to monitor',
      },
    ],
    optional_inputs: [
      {
        key: 'message_limit',
        label: 'Message Limit',
        type: 'number',
        description: 'Maximum number of recent messages to retrieve per channel (default: 50)',
        default: 50,
      },
      {
        key: 'exclude_bot_messages',
        label: 'Exclude Bot Messages',
        type: 'string',
        description: 'Whether to exclude messages from bots (true/false, default: true)',
        default: 'true',
      },
      {
        key: 'min_content_length',
        label: 'Minimum Content Length',
        type: 'number',
        description: 'Minimum message length to consider (default: 10 characters)',
        default: 10,
      },
    ],
    defaults: {
      poll_interval_ms: 600000, // 10 minutes
      author_type: 'user',
    },
    channel_authority: 0.52,
  };
}

/**
 * Microsoft Teams preset factory
 * Creates configuration for receiving Teams notifications via webhook
 *
 * Authority: 0.60 - Enterprise discussions with structured context
 *
 * Requirements:
 * - Incoming webhook URL for Teams channel
 * - Channel ID where signals are posted
 */
export function createTeamsPreset(): SourcePreset {
  return {
    name: 'Microsoft Teams',
    adapter_type: 'poll_api',
    description:
      'Monitor Microsoft Teams channels for discussions and notifications. Integrates via Teams webhooks and channel subscriptions to capture messages in real-time or near-real-time.',
    required_inputs: [
      {
        key: 'webhook_url',
        label: 'Webhook URL',
        type: 'url',
        description: 'Microsoft Teams incoming webhook URL for receiving messages',
      },
      {
        key: 'tenant_id',
        label: 'Tenant ID',
        type: 'string',
        description: 'Azure AD tenant ID for Teams organization',
      },
    ],
    optional_inputs: [
      {
        key: 'channel_name',
        label: 'Channel Name',
        type: 'string',
        description: 'Specific Teams channel name to monitor (if monitoring single channel)',
      },
      {
        key: 'adaptive_card_parsing',
        label: 'Parse Adaptive Cards',
        type: 'string',
        description: 'Whether to parse adaptive card content (true/false, default: true)',
        default: 'true',
      },
    ],
    defaults: {
      poll_interval_ms: 180000, // 3 minutes
      author_type: 'user',
    },
    channel_authority: 0.60,
  };
}

/**
 * CRM Notes preset factory
 * Creates configuration for polling CRM systems (Salesforce, HubSpot) for notes and activities
 *
 * Authority: 0.62 - Structured business context with high credibility but potential bias
 *
 * Requirements:
 * - CRM API credentials (varies by platform)
 * - Object types to monitor (Accounts, Opportunities, Contacts, etc.)
 * - Field mappings for signal extraction
 */
export function createCRMNotesPreset(crmType: 'salesforce' | 'hubspot' = 'salesforce'): SourcePreset {
  const isSalesforce = crmType === 'salesforce';

  return {
    name: `CRM Notes (${isSalesforce ? 'Salesforce' : 'HubSpot'})`,
    adapter_type: 'poll_api',
    description: `Monitor ${isSalesforce ? 'Salesforce' : 'HubSpot'} for account notes, activity comments, and deal updates. Polls CRM at configured intervals to retrieve structured business context and stakeholder signals.`,
    required_inputs: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        description: isSalesforce
          ? 'Salesforce OAuth token or API key for authenticated access'
          : 'HubSpot private app access token',
      },
      ...(isSalesforce
        ? [
            {
              key: 'instance_url',
              label: 'Salesforce Instance URL',
              type: 'url',
              description: 'Your Salesforce instance URL (e.g., https://your-instance.salesforce.com)',
            },
          ]
        : []),
    ],
    optional_inputs: [
      {
        key: 'object_types',
        label: 'Object Types',
        type: 'string',
        description: isSalesforce
          ? 'Comma-separated Salesforce objects to monitor (Account,Opportunity,Contact)'
          : 'Comma-separated HubSpot object types (companies,deals,contacts)',
        default: isSalesforce ? 'Account,Opportunity' : 'companies,deals',
      },
      {
        key: 'lookback_days',
        label: 'Lookback Period (days)',
        type: 'number',
        description: 'Number of days to look back for new notes/activities (default: 7)',
        default: 7,
      },
      {
        key: 'exclude_internal_notes',
        label: 'Exclude Internal Notes',
        type: 'string',
        description: 'Whether to exclude internal-only notes (true/false, default: false)',
        default: 'false',
      },
    ],
    defaults: {
      poll_interval_ms: 900000, // 15 minutes
      author_type: 'user',
    },
    channel_authority: 0.62,
  };
}

/**
 * Sales Call Transcript preset factory
 * Creates configuration for processing sales call transcripts
 *
 * Authority: 0.65 - Direct customer interaction context with high authority
 *
 * Uses push mechanism for batch processing of call recordings/transcripts
 * Includes speaker-aware chunking to preserve conversation context
 *
 * Requirements:
 * - Call recording/transcript source (Gong, Chorus, Otter, etc.)
 * - Speaker identification and role mapping
 * - Webhook endpoint for receiving transcripts
 */
export function createSalesCallPreset(): SourcePreset {
  return {
    name: 'Sales Call Transcripts',
    adapter_type: 'push',
    description:
      'Process sales call transcripts with speaker-aware chunking to preserve conversation context. Extracts key moments, objections, and opportunities from customer interactions. Supports integration with call recording platforms (Gong, Chorus, Otter.ai).',
    required_inputs: [
      {
        key: 'webhook_endpoint',
        label: 'Webhook Endpoint',
        type: 'url',
        description:
          'Public HTTPS endpoint where this service will receive call transcripts and metadata',
      },
      {
        key: 'api_key',
        label: 'Call Platform API Key',
        type: 'password',
        description: 'API key from call recording platform (Gong, Chorus, Otter, etc.)',
      },
    ],
    optional_inputs: [
      {
        key: 'speaker_role_mapping',
        label: 'Speaker Role Mapping',
        type: 'string',
        description: 'JSON mapping of speaker patterns to roles (sales, customer, other). Default auto-detects.',
      },
      {
        key: 'chunk_strategy',
        label: 'Chunking Strategy',
        type: 'string',
        description: 'How to chunk transcripts: "speaker-aware" (by speaker turns), "topic" (by topic), or "sentence" (fixed). Default: speaker-aware',
        default: 'speaker-aware',
      },
      {
        key: 'min_chunk_duration',
        label: 'Minimum Chunk Duration (seconds)',
        type: 'number',
        description: 'Minimum duration for a speaker turn to be considered a chunk (default: 5)',
        default: 5,
      },
      {
        key: 'extract_objections',
        label: 'Extract Objections',
        type: 'string',
        description: 'Whether to flag and extract customer objections (true/false, default: true)',
        default: 'true',
      },
    ],
    defaults: {
      author_type: 'user',
      batch_processing: true,
    },
    channel_authority: 0.65,
  };
}
