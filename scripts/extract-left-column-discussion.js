#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';

const filePath = '/Users/flysikring/.claude/projects/-Users-flysikring-conductor-workspaces-plannr-auckland/9fc6a70a-f901-4df5-8be1-7ccd22f199f2.jsonl';

const keyPhrases = [
  'isnt that what the left side is for',
  'forming / cultivating',
  'forming and cultivating',
  'This looks nothing like what is declared in the vision doc',
  'why are the projects on the right side',
  'left column',
  'left side',
  'dashboard',
  'projects as blocks',
  'collapse',
  'always visible',
  'three columns',
  'inconsistent',
  'consistent',
  'FormingBlocksColumn',
  'CuratedBlocksColumn',
  'physics blocks',
  'forming blocks',
  'curated blocks',
  'blocks form on the left',
  'move to the right',
  'draft items',
  'zen garden'
];

async function parseJSONL() {
  const messages = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    try {
      const msg = JSON.parse(line);
      messages.push({ ...msg, lineNumber });
    } catch (e) {
      // Skip invalid lines
    }
  }

  return messages;
}

function extractMessageText(msg) {
  if (!msg.message) return '';

  const messageObj = msg.message;
  let text = '';

  if (typeof messageObj.content === 'string') {
    text = messageObj.content;
  } else if (Array.isArray(messageObj.content)) {
    text = messageObj.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join(' ');
  }

  return text;
}

function findRelevantMessages(messages) {
  const relevant = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Only look at user messages
    if (msg.type !== 'user') continue;

    const text = extractMessageText(msg);
    if (!text) continue;

    const lowerText = text.toLowerCase();

    // Check if this message contains any key phrases
    const matchedPhrases = keyPhrases.filter(phrase =>
      lowerText.includes(phrase.toLowerCase())
    );

    if (matchedPhrases.length > 0) {
      // Get previous assistant message
      let prevAssistant = null;
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].type === 'assistant') {
          prevAssistant = messages[j];
          break;
        }
      }

      // Get next assistant message
      let nextAssistant = null;
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].type === 'assistant') {
          nextAssistant = messages[j];
          break;
        }
      }

      relevant.push({
        lineNumber: msg.lineNumber,
        timestamp: msg.timestamp || 'unknown',
        matchedPhrases,
        humanMessage: text,
        prevAssistant: prevAssistant ? summarizeAssistantMessage(prevAssistant) : 'None',
        nextAssistant: nextAssistant ? summarizeAssistantMessage(nextAssistant) : 'None'
      });
    }
  }

  return relevant;
}

function summarizeAssistantMessage(msg) {
  const text = extractMessageText(msg);

  // Get first 300 chars
  return text.substring(0, 300) + (text.length > 300 ? '...' : '');
}

async function main() {
  console.log('Parsing JSONL file...');
  const messages = await parseJSONL();
  console.log(`Found ${messages.length} total messages`);

  console.log('\nFinding relevant messages about left column layout...');
  const relevant = findRelevantMessages(messages);

  console.log(`\nFound ${relevant.length} relevant messages\n`);
  console.log('=' .repeat(80));

  for (const item of relevant) {
    console.log(`\nLine ${item.lineNumber} | Timestamp: ${item.timestamp}`);
    console.log(`Matched phrases: ${item.matchedPhrases.join(', ')}`);
    console.log('\n--- PREVIOUS ASSISTANT MESSAGE (summary) ---');
    console.log(item.prevAssistant);
    console.log('\n--- USER MESSAGE (full) ---');
    console.log(item.humanMessage);
    console.log('\n--- NEXT ASSISTANT MESSAGE (summary) ---');
    console.log(item.nextAssistant);
    console.log('\n' + '=' .repeat(80));
  }

  // Also find the specific critical messages and show what came after
  console.log('\n\n' + '*' .repeat(80));
  console.log('CRITICAL MESSAGES WITH FOLLOWING CONVERSATION:');
  console.log('*' .repeat(80));

  const criticalPhrases = [
    'isnt that what the left side is for',
    'This looks nothing like what is declared in the vision doc'
  ];

  for (const item of relevant) {
    const hasCritical = criticalPhrases.some(phrase =>
      item.humanMessage.toLowerCase().includes(phrase.toLowerCase())
    );

    if (hasCritical) {
      console.log(`\n\n${'#'.repeat(80)}`);
      console.log(`CRITICAL DISCUSSION STARTING at Line ${item.lineNumber}:`);
      console.log(`${'#'.repeat(80)}\n`);
      console.log(item.humanMessage);

      // Find everything after this line
      const afterIndex = messages.findIndex(m => m.lineNumber === item.lineNumber);
      if (afterIndex !== -1) {
        console.log('\n--- ALL USER MESSAGES AFTER THIS POINT (next 30) ---\n');
        let count = 0;
        for (let i = afterIndex + 1; i < messages.length && count < 30; i++) {
          if (messages[i].type === 'user') {
            count++;
            const text = extractMessageText(messages[i]);
            console.log(`\n[${'='.repeat(76)}]`);
            console.log(`[Line ${messages[i].lineNumber}]`);
            console.log(`[${'='.repeat(76)}]`);
            console.log(text.substring(0, 1000) + (text.length > 1000 ? '\n... [TRUNCATED]' : ''));
          }
        }
      }
    }
  }
}

main().catch(console.error);
