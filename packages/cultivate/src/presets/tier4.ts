/**
 * Tier 4 Source Presets (channel_authority: 0.3-0.45)
 * Public and unvetted sources with lower authority
 *
 * These sources represent public platforms and web content with less editorial
 * control or verification. Signals from these sources require higher skepticism
 * and more rigorous validation. Polling intervals are longer to respect rate limits
 * and reduce unnecessary requests to external APIs.
 */

import type { SourcePreset } from '../domain/types.js';

/**
 * Reddit preset factory
 * Creates configuration for polling Reddit communities via API
 *
 * Authority: 0.35 - Community discussions with low editorial control
 *
 * Requirements:
 * - Reddit API credentials (app ID, app secret)
 * - Subreddit names to monitor
 * - Optional: filtering by post type, sort order, etc.
 */
export function createRedditPreset(): SourcePreset {
  return {
    name: 'Reddit',
    adapter_type: 'poll_api',
    description:
      'Monitor Reddit communities and discussions. Polls specified subreddits at configured intervals to retrieve new posts and comments. Supports filtering by post type, score threshold, and discussion context.',
    required_inputs: [
      {
        key: 'app_id',
        label: 'App ID',
        type: 'password',
        description: 'Reddit application ID from https://www.reddit.com/prefs/apps',
      },
      {
        key: 'app_secret',
        label: 'App Secret',
        type: 'password',
        description: 'Reddit application secret from https://www.reddit.com/prefs/apps',
      },
      {
        key: 'subreddit_names',
        label: 'Subreddit Names',
        type: 'string',
        description:
          'Comma-separated list of subreddit names to monitor (e.g., programming,typescript,webdev)',
      },
    ],
    optional_inputs: [
      {
        key: 'search_terms',
        label: 'Search Terms',
        type: 'string',
        description:
          'Optional comma-separated keywords to filter posts within subreddits (e.g., "AI,machine learning")',
      },
      {
        key: 'post_limit',
        label: 'Post Limit',
        type: 'number',
        description: 'Maximum number of recent posts to retrieve per subreddit (default: 25)',
        default: 25,
      },
      {
        key: 'min_score',
        label: 'Minimum Score',
        type: 'number',
        description: 'Only include posts with minimum upvote score (default: 0)',
        default: 0,
      },
      {
        key: 'include_comments',
        label: 'Include Comments',
        type: 'string',
        description: 'Whether to also monitor top-level comments on posts (true/false, default: false)',
        default: 'false',
      },
    ],
    defaults: {
      poll_interval_ms: 600000, // 10 minutes
      author_type: 'user',
    },
    channel_authority: 0.35,
  };
}

/**
 * Hacker News preset factory
 * Creates configuration for polling Hacker News via API
 *
 * Authority: 0.40 - Tech-focused community with moderate quality curation
 *
 * Requirements:
 * - Search terms or keywords for filtering stories
 * - Optional: Story ID filters, comment depth settings
 */
export function createHackerNewsPreset(): SourcePreset {
  return {
    name: 'Hacker News',
    adapter_type: 'poll_api',
    description:
      'Monitor Hacker News for technology and entrepreneurship discussions. Polls the API at configured intervals to retrieve new stories, comments, and discussions. Supports filtering by keyword and score threshold.',
    required_inputs: [
      {
        key: 'search_terms',
        label: 'Search Terms',
        type: 'string',
        description:
          'Comma-separated keywords to search for in stories and discussions (e.g., "AI,startups,cloud")',
      },
    ],
    optional_inputs: [
      {
        key: 'story_limit',
        label: 'Story Limit',
        type: 'number',
        description: 'Maximum number of recent stories to retrieve (default: 30)',
        default: 30,
      },
      {
        key: 'min_score',
        label: 'Minimum Score',
        type: 'number',
        description: 'Only include stories with minimum points (default: 10)',
        default: 10,
      },
      {
        key: 'include_comments',
        label: 'Include Comments',
        type: 'string',
        description: 'Whether to retrieve top comments for each story (true/false, default: true)',
        default: 'true',
      },
      {
        key: 'max_comment_depth',
        label: 'Comment Depth',
        type: 'number',
        description: 'Maximum nesting level for comment threads (default: 2)',
        default: 2,
      },
    ],
    defaults: {
      poll_interval_ms: 600000, // 10 minutes
      author_type: 'user',
    },
    channel_authority: 0.40,
  };
}

/**
 * Twitter preset factory
 * Creates configuration for polling Twitter (X) API for tweets and conversations
 *
 * Authority: 0.38 - Social media with real-time information but high noise
 *
 * Requirements:
 * - Twitter API v2 bearer token
 * - Search queries or hashtags to monitor
 * - Optional: language, retweet filters, verified account filtering
 */
export function createTwitterPreset(): SourcePreset {
  return {
    name: 'Twitter/X',
    adapter_type: 'poll_api',
    description:
      'Monitor Twitter/X for real-time discussions, news, and conversations. Uses Twitter API v2 to search tweets based on keywords, hashtags, and user mentions. Supports filtering by language, engagement metrics, and account verification.',
    required_inputs: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        description: 'Twitter API v2 Bearer Token with read permissions',
      },
      {
        key: 'search_queries',
        label: 'Search Queries',
        type: 'string',
        description:
          'Twitter search queries (semicolon-separated, e.g., "#AI OR #artificial-intelligence; from:elonmusk")',
      },
    ],
    optional_inputs: [
      {
        key: 'tweet_limit',
        label: 'Tweet Limit',
        type: 'number',
        description: 'Maximum number of recent tweets to retrieve per query (default: 50)',
        default: 50,
      },
      {
        key: 'language',
        label: 'Language Filter',
        type: 'string',
        description: 'Optional language code to filter tweets (e.g., "en" for English)',
      },
      {
        key: 'exclude_retweets',
        label: 'Exclude Retweets',
        type: 'string',
        description: 'Whether to exclude retweets (true/false, default: true)',
        default: 'true',
      },
      {
        key: 'min_followers',
        label: 'Minimum Followers',
        type: 'number',
        description: 'Only include tweets from accounts with minimum followers (default: 0)',
        default: 0,
      },
      {
        key: 'include_replies',
        label: 'Include Replies',
        type: 'string',
        description: 'Whether to include reply tweets (true/false, default: false)',
        default: 'false',
      },
    ],
    defaults: {
      poll_interval_ms: 300000, // 5 minutes - higher frequency for real-time content
      author_type: 'user',
    },
    channel_authority: 0.38,
  };
}

/**
 * RSS Feed preset factory
 * Creates configuration for polling RSS and Atom feeds
 *
 * Authority: 0.45 - Depends on feed source but generally moderate
 *
 * Requirements:
 * - Feed URLs (RSS/Atom)
 * - Optional: keyword filtering, feed parsing options
 */
export function createRSSPreset(): SourcePreset {
  return {
    name: 'RSS Feed',
    adapter_type: 'poll_api',
    description:
      'Monitor RSS and Atom feeds from blogs, news sites, and content publishers. Polls feeds at configured intervals to retrieve new articles and posts. Supports multiple feed URLs and keyword-based content filtering.',
    required_inputs: [
      {
        key: 'feed_urls',
        label: 'Feed URLs',
        type: 'string',
        description:
          'Comma-separated list of RSS/Atom feed URLs to monitor (e.g., https://example.com/feed.xml,https://blog.example.com/rss)',
      },
    ],
    optional_inputs: [
      {
        key: 'item_limit',
        label: 'Item Limit',
        type: 'number',
        description: 'Maximum number of recent feed items to retrieve per feed (default: 25)',
        default: 25,
      },
      {
        key: 'keyword_filter',
        label: 'Keyword Filter',
        type: 'string',
        description: 'Optional comma-separated keywords to filter feed items by title/description',
      },
      {
        key: 'exclude_keywords',
        label: 'Exclude Keywords',
        type: 'string',
        description: 'Optional keywords to exclude from feed items',
      },
      {
        key: 'content_extraction',
        label: 'Extract Full Content',
        type: 'string',
        description:
          'Whether to extract full article content or use feed summary only (true/false, default: false)',
        default: 'false',
      },
      {
        key: 'timeout_ms',
        label: 'Feed Timeout',
        type: 'number',
        description: 'Timeout for fetching individual feeds in milliseconds (default: 5000)',
        default: 5000,
      },
    ],
    defaults: {
      poll_interval_ms: 1800000, // 30 minutes - typical feed update frequency
      author_type: 'unknown',
    },
    channel_authority: 0.45,
  };
}

/**
 * Web Scraper preset factory
 * Creates configuration for scraping web pages for content extraction
 *
 * Authority: 0.32 - Highly variable depending on target content
 *
 * Requirements:
 * - Target URLs to scrape
 * - CSS selectors for content extraction
 * - Optional: JavaScript rendering, authentication, rate limiting
 */
export function createWebScraperPreset(): SourcePreset {
  return {
    name: 'Web Scraper',
    adapter_type: 'poll_api',
    description:
      'Scrape web pages and extract content using CSS selectors. Polls specified URLs at configured intervals to retrieve and parse HTML content. Supports both static HTML and JavaScript-rendered pages.',
    required_inputs: [
      {
        key: 'target_urls',
        label: 'Target URLs',
        type: 'string',
        description:
          'Comma-separated list of URLs to scrape (e.g., https://example.com/news,https://blog.example.com)',
      },
      {
        key: 'css_selectors',
        label: 'CSS Selectors',
        type: 'string',
        description:
          'CSS selector(s) to extract content (e.g., "article.post" or ".content > .title" or "main > div:nth-child(3)")',
      },
    ],
    optional_inputs: [
      {
        key: 'javascript_enabled',
        label: 'Enable JavaScript Rendering',
        type: 'string',
        description: 'Whether to render JavaScript before scraping (true/false, default: false)',
        default: 'false',
      },
      {
        key: 'xpath_filters',
        label: 'XPath Filters',
        type: 'string',
        description: 'Optional XPath expressions to further filter extracted elements',
      },
      {
        key: 'follow_links',
        label: 'Follow Links',
        type: 'string',
        description: 'Whether to follow links found in extracted content (true/false, default: false)',
        default: 'false',
      },
      {
        key: 'max_depth',
        label: 'Max Link Depth',
        type: 'number',
        description: 'Maximum depth when following links (default: 1)',
        default: 1,
      },
      {
        key: 'user_agent',
        label: 'Custom User Agent',
        type: 'string',
        description: 'Custom User-Agent header for requests (optional)',
      },
      {
        key: 'respect_robots_txt',
        label: 'Respect robots.txt',
        type: 'string',
        description: 'Whether to respect robots.txt rules (true/false, default: true)',
        default: 'true',
      },
    ],
    defaults: {
      poll_interval_ms: 3600000, // 60 minutes - respectful polling interval
      author_type: 'unknown',
      timeout_ms: 30000,
    },
    channel_authority: 0.32,
  };
}
