/**
 * Tier 1 Source Presets (channel_authority: 0.8-1.0)
 * Direct feedback and structured sources with highest authority
 *
 * These sources represent direct customer feedback channels with high
 * signal-to-noise ratio. Data from these sources is structured, intentional,
 * and typically solicited — making it the most reliable for insight extraction.
 */

import type { SourcePreset } from '../schemas';

/**
 * Support Ticket preset factory
 * Creates configuration for polling support ticket systems (Zendesk, Intercom, Freshdesk)
 *
 * Authority: 0.85 - Support tickets are direct customer-initiated feedback with clear intent.
 * Customers articulate specific problems, making these high-signal sources.
 * Slightly lower than surveys/interviews because tickets may include duplicates
 * and emotionally charged language that requires more filtering.
 *
 * Requirements:
 * - API credentials for the support platform
 * - Subdomain or instance URL
 * - Optional: ticket status filters, tag filters, lookback period
 */
export function createSupportTicketPreset(): SourcePreset {
  return {
    name: 'Support Tickets',
    adapter_type: 'poll_api',
    description:
      'Poll support ticket systems (Zendesk, Intercom, Freshdesk) for customer-reported issues and feedback. Retrieves ticket subjects, descriptions, and conversation threads at configured intervals. Supports filtering by status, tags, and priority to focus on high-signal tickets.',
    required_inputs: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        description: 'API key or OAuth token for the support platform (Zendesk API token, Intercom access token, etc.)',
      },
      {
        key: 'instance_url',
        label: 'Instance URL',
        type: 'url',
        description: 'Base URL for the support platform (e.g., https://yourcompany.zendesk.com)',
      },
    ],
    optional_inputs: [
      {
        key: 'status_filter',
        label: 'Status Filter',
        type: 'string',
        description: 'Comma-separated ticket statuses to include (e.g., open,pending,solved). Default: all statuses',
        default: 'open,pending,solved',
      },
      {
        key: 'tag_filter',
        label: 'Tag Filter',
        type: 'string',
        description: 'Comma-separated tags to filter tickets by (e.g., bug,feature-request). Default: no filter',
      },
      {
        key: 'lookback_days',
        label: 'Lookback Period (days)',
        type: 'number',
        description: 'Number of days to look back for updated tickets (default: 30)',
        default: 30,
      },
      {
        key: 'include_comments',
        label: 'Include Comments',
        type: 'string',
        description: 'Whether to include agent and customer comments in extraction (true/false, default: true)',
        default: 'true',
      },
    ],
    defaults: {
      poll_interval_ms: 600000, // 10 minutes
      author_type: 'customer',
    },
    channel_authority: 0.85,
  };
}

/**
 * Survey preset factory
 * Creates configuration for fetching survey responses from platforms like Typeform, SurveyMonkey, Google Forms
 *
 * Authority: 0.90 - Surveys are solicited, structured feedback with intentional responses.
 * Respondents answer specific questions, producing highly targeted signal.
 * Higher authority than support tickets because the feedback is structured
 * and respondents have context about what they're being asked.
 *
 * Requirements:
 * - API credentials for the survey platform
 * - Survey or form ID to retrieve responses from
 * - Optional: completion filter, date range, response limit
 */
export function createSurveyPreset(): SourcePreset {
  return {
    name: 'Surveys',
    adapter_type: 'structured_pull',
    description:
      'Fetch survey responses from platforms like Typeform, SurveyMonkey, or Google Forms. Retrieves structured question-answer pairs with respondent metadata. Supports filtering by completion status and date range for targeted analysis.',
    required_inputs: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        description: 'API key or OAuth token for the survey platform (Typeform personal access token, SurveyMonkey access token, etc.)',
      },
      {
        key: 'survey_id',
        label: 'Survey ID',
        type: 'string',
        description: 'Identifier of the survey or form to retrieve responses from',
      },
    ],
    optional_inputs: [
      {
        key: 'completed_only',
        label: 'Completed Only',
        type: 'string',
        description: 'Whether to only include completed responses (true/false, default: true)',
        default: 'true',
      },
      {
        key: 'lookback_days',
        label: 'Lookback Period (days)',
        type: 'number',
        description: 'Number of days to look back for new responses (default: 14)',
        default: 14,
      },
      {
        key: 'response_limit',
        label: 'Response Limit',
        type: 'number',
        description: 'Maximum number of responses to retrieve per fetch (default: 200)',
        default: 200,
      },
      {
        key: 'include_partial',
        label: 'Include Partial Responses',
        type: 'string',
        description: 'Whether to include partially completed responses (true/false, default: false)',
        default: 'false',
      },
    ],
    defaults: {
      author_type: 'customer',
    },
    channel_authority: 0.90,
  };
}

/**
 * Interview preset factory
 * Creates configuration for uploading and processing user research interview transcripts
 *
 * Authority: 0.95 - Interviews are the highest-fidelity feedback source. They represent
 * deep, contextual conversations with users where a researcher probes for understanding.
 * The richest signal source with the most context per data point.
 *
 * Uses push adapter — transcripts are uploaded as batch documents rather than polled.
 *
 * Requirements:
 * - Upload endpoint for receiving transcript files
 * - Optional: speaker labeling, segment tagging, transcript format
 */
export function createInterviewPreset(): SourcePreset {
  return {
    name: 'User Interviews',
    adapter_type: 'push',
    description:
      'Process user research interview transcripts uploaded as documents. Extracts insights, pain points, and opportunities from deep contextual conversations. Supports speaker-labeled transcripts with segment tagging for thematic analysis.',
    required_inputs: [
      {
        key: 'webhook_endpoint',
        label: 'Upload Endpoint',
        type: 'url',
        description: 'HTTPS endpoint where interview transcripts and metadata will be uploaded',
      },
    ],
    optional_inputs: [
      {
        key: 'transcript_format',
        label: 'Transcript Format',
        type: 'string',
        description: 'Expected transcript format: "plain" (unstructured text), "speaker-labeled" (with speaker turns), or "timestamped" (with timestamps). Default: speaker-labeled',
        default: 'speaker-labeled',
      },
      {
        key: 'segment_by_topic',
        label: 'Segment by Topic',
        type: 'string',
        description: 'Whether to auto-segment the transcript into topic blocks for analysis (true/false, default: true)',
        default: 'true',
      },
      {
        key: 'extract_quotes',
        label: 'Extract Quotes',
        type: 'string',
        description: 'Whether to extract notable direct quotes from participants (true/false, default: true)',
        default: 'true',
      },
      {
        key: 'participant_role',
        label: 'Participant Role',
        type: 'string',
        description: 'Default role label for the interviewee (e.g., "customer", "prospect", "churned-user"). Default: customer',
        default: 'customer',
      },
    ],
    defaults: {
      author_type: 'customer',
      batch_processing: true,
    },
    channel_authority: 0.95,
  };
}
