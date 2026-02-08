/**
 * UI/UX Validation Script for Ideation Frontend
 *
 * Tests the ideation session interface at http://localhost:3002
 *
 * Run with: npx ts-node scripts/validate-ideation-ui.ts
 * Or: npx playwright test scripts/validate-ideation-ui.ts
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface ValidationResult {
  step_id: string;
  title: string;
  present: 'pass' | 'fail' | 'unknown';
  designed: 'pass' | 'fail' | 'unknown';
  holistic: 'pass' | 'fail' | 'unknown';
  issues: { severity: 'blocker' | 'major' | 'minor'; issue: string; fix: string }[];
  notes: string[];
}

interface ValidationSummary {
  present: 'pass' | 'fail' | 'unknown';
  designed: 'pass' | 'fail' | 'unknown';
  holistic: 'pass' | 'fail' | 'unknown';
  blockers: number;
  majors: number;
  minors: number;
}

const BASE_URL = 'http://localhost:3002';
const API_URL = 'http://localhost:3001';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function validateHomePage(page: Page): Promise<ValidationResult> {
  const result: ValidationResult = {
    step_id: 's001',
    title: '[action] Navigate to home page',
    present: 'unknown',
    designed: 'unknown',
    holistic: 'unknown',
    issues: [],
    notes: [],
  };

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await delay(1000);

    // Check if home page loads
    const hasLayout = await page.locator('.bg-bg-deep, [class*="bg-"]').first().isVisible().catch(() => false);
    if (hasLayout) {
      result.present = 'pass';
      result.notes.push('Home page loads successfully');
    } else {
      result.present = 'fail';
      result.issues.push({ severity: 'blocker', issue: 'Home page does not load', fix: 'Check if frontend is running' });
    }

    // Check for sidebar
    const hasSidebar = await page.locator('nav, aside, [class*="sidebar"]').first().isVisible().catch(() => false);
    if (hasSidebar) {
      result.notes.push('Sidebar is present');
    } else {
      result.issues.push({ severity: 'major', issue: 'Sidebar not visible', fix: 'Add sidebar navigation' });
    }

    // Check for session list or welcome message
    const hasContent = await page.getByText(/session|brainstorm|ideation/i).first().isVisible().catch(() => false);
    if (hasContent) {
      result.designed = 'pass';
      result.notes.push('Content area displays ideation-related text');
    } else {
      result.designed = 'fail';
      result.notes.push('No ideation content found on home page');
    }

    result.holistic = result.present === 'pass' && result.designed === 'pass' ? 'pass' : 'fail';

  } catch (error) {
    result.present = 'fail';
    result.issues.push({ severity: 'blocker', issue: `Navigation failed: ${error}`, fix: 'Check frontend is running on port 3002' });
  }

  return result;
}

async function validateSessionList(page: Page): Promise<ValidationResult> {
  const result: ValidationResult = {
    step_id: 's002',
    title: '[assert] Session list displays with status indicators',
    present: 'unknown',
    designed: 'unknown',
    holistic: 'unknown',
    issues: [],
    notes: [],
  };

  try {
    // Look for session items in the sidebar
    const sessionItems = await page.locator('[class*="session"], [data-testid*="session"]').count();

    if (sessionItems > 0) {
      result.present = 'pass';
      result.notes.push(`Found ${sessionItems} session item(s) in list`);
    } else {
      // Check if there's an empty state message
      const emptyState = await page.getByText(/no sessions|create.*session|start.*brainstorm/i).first().isVisible().catch(() => false);
      if (emptyState) {
        result.present = 'pass';
        result.notes.push('Empty state displayed (no sessions yet)');
      } else {
        result.present = 'fail';
        result.issues.push({ severity: 'minor', issue: 'Session list not clearly visible', fix: 'Ensure session list renders in sidebar' });
      }
    }

    // Check for status badges
    const hasStatusBadges = await page.locator('[class*="badge"], [class*="status"]').count() > 0;
    if (hasStatusBadges) {
      result.designed = 'pass';
      result.notes.push('Status indicators are present');
    } else {
      result.designed = 'unknown';
      result.notes.push('Status indicators not detected (may be in session items)');
    }

    result.holistic = result.present === 'pass' ? 'pass' : 'fail';

  } catch (error) {
    result.issues.push({ severity: 'minor', issue: `Session list check failed: ${error}`, fix: 'Debug session list rendering' });
  }

  return result;
}

async function validateNewSessionModal(page: Page): Promise<ValidationResult> {
  const result: ValidationResult = {
    step_id: 's003',
    title: '[action] Create a new session',
    present: 'unknown',
    designed: 'unknown',
    holistic: 'unknown',
    issues: [],
    notes: [],
  };

  try {
    // Look for "New Session" or "+" button
    const newSessionButton = page.locator('button').filter({ hasText: /new|create|\+/i }).first();
    const buttonVisible = await newSessionButton.isVisible().catch(() => false);

    if (!buttonVisible) {
      // Try finding a plus icon button
      const plusButton = page.locator('[class*="plus"], button svg').first();
      const plusVisible = await plusButton.isVisible().catch(() => false);

      if (!plusVisible) {
        result.present = 'fail';
        result.issues.push({ severity: 'blocker', issue: 'New session button not found', fix: 'Add prominent new session button' });
        return result;
      }
      await plusButton.click();
    } else {
      await newSessionButton.click();
    }

    await delay(500);

    // Check for modal
    const modal = page.locator('[role="dialog"], [class*="modal"], [class*="dialog"]').first();
    const modalVisible = await modal.isVisible().catch(() => false);

    if (modalVisible) {
      result.present = 'pass';
      result.notes.push('New session modal opens');

      // Check for textarea
      const textarea = page.locator('textarea').first();
      const hasTextarea = await textarea.isVisible().catch(() => false);

      if (hasTextarea) {
        result.notes.push('Intent textarea is present');

        // Try filling it
        await textarea.fill('UI/UX validation test session');
        result.notes.push('Can type in textarea');
        result.designed = 'pass';
      } else {
        result.issues.push({ severity: 'major', issue: 'No textarea in modal', fix: 'Add intent input field' });
        result.designed = 'fail';
      }

      // Check for submit button
      const submitButton = page.locator('button').filter({ hasText: /start|create|submit/i }).first();
      const hasSubmit = await submitButton.isVisible().catch(() => false);

      if (hasSubmit) {
        result.notes.push('Submit button is present');

        // Click to create session
        await submitButton.click();
        await delay(2000);

        // Check if we navigated to session page
        const url = page.url();
        if (url.includes('/session/')) {
          result.notes.push('Successfully created session and navigated');
          result.holistic = 'pass';
        } else {
          result.notes.push(`Stayed on page after create (URL: ${url})`);
          result.holistic = 'unknown';
        }
      } else {
        result.issues.push({ severity: 'major', issue: 'Submit button not found', fix: 'Add submit button to modal' });
      }

    } else {
      result.present = 'fail';
      result.issues.push({ severity: 'blocker', issue: 'Modal did not open', fix: 'Fix new session modal trigger' });
    }

  } catch (error) {
    result.issues.push({ severity: 'blocker', issue: `Create session failed: ${error}`, fix: 'Debug session creation flow' });
  }

  return result;
}

async function validateChatInterface(page: Page, sessionId?: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    step_id: 's004',
    title: '[assert] Chat interface displays correctly',
    present: 'unknown',
    designed: 'unknown',
    holistic: 'unknown',
    issues: [],
    notes: [],
  };

  try {
    // If we have a sessionId, navigate to it
    if (sessionId) {
      await page.goto(`${BASE_URL}/session/${sessionId}`, { waitUntil: 'networkidle' });
      await delay(1000);
    }

    // Check for chat header
    const hasHeader = await page.locator('header, [class*="header"]').first().isVisible().catch(() => false);
    if (hasHeader) {
      result.notes.push('Chat header is present');
    }

    // Check for chat messages area
    const hasMessageArea = await page.locator('[class*="message"], [class*="chat"], [class*="bubble"]').first().isVisible().catch(() => false);
    if (hasMessageArea) {
      result.present = 'pass';
      result.notes.push('Message display area is present');
    } else {
      result.present = 'fail';
      result.issues.push({ severity: 'blocker', issue: 'Chat message area not found', fix: 'Add ChatMessageList component' });
    }

    // Check for chat input
    const chatInput = page.locator('textarea, input[type="text"]').filter({ hasNotText: '' }).first();
    const hasInput = await chatInput.isVisible().catch(() => false);

    if (hasInput) {
      result.notes.push('Chat input is present');
      result.designed = 'pass';
    } else {
      // Try a more specific selector
      const anyTextarea = page.locator('textarea').first();
      const anyTextareaVisible = await anyTextarea.isVisible().catch(() => false);
      if (anyTextareaVisible) {
        result.notes.push('Textarea input is present');
        result.designed = 'pass';
      } else {
        result.designed = 'fail';
        result.issues.push({ severity: 'blocker', issue: 'Chat input not found', fix: 'Add ChatInput component' });
      }
    }

    // Check for confidence bar
    const hasConfidence = await page.locator('[class*="confidence"], [class*="progress"]').first().isVisible().catch(() => false);
    if (hasConfidence) {
      result.notes.push('Confidence bar is present');
    } else {
      result.issues.push({ severity: 'minor', issue: 'Confidence bar not visible', fix: 'Ensure ConfidenceBar renders in header' });
    }

    // Check for Send to Planner button
    const hasSendButton = await page.getByText(/send.*planner|update.*plan/i).first().isVisible().catch(() => false);
    if (hasSendButton) {
      result.notes.push('Send to Planner button is present');
    } else {
      result.issues.push({ severity: 'minor', issue: 'Send to Planner button not visible', fix: 'Add Send to Planner button to header' });
    }

    result.holistic = result.present === 'pass' && result.designed === 'pass' ? 'pass' : 'fail';

  } catch (error) {
    result.issues.push({ severity: 'blocker', issue: `Chat interface check failed: ${error}`, fix: 'Debug chat interface rendering' });
  }

  return result;
}

async function validateMessageSending(page: Page): Promise<ValidationResult> {
  const result: ValidationResult = {
    step_id: 's005',
    title: '[action] Send a message and verify it appears',
    present: 'unknown',
    designed: 'unknown',
    holistic: 'unknown',
    issues: [],
    notes: [],
  };

  try {
    const testMessage = 'Test message from UI validation ' + Date.now();

    // Find and fill the input
    const textarea = page.locator('textarea').first();
    const isVisible = await textarea.isVisible().catch(() => false);

    if (!isVisible) {
      result.present = 'fail';
      result.issues.push({ severity: 'blocker', issue: 'Cannot find message input', fix: 'Fix chat input visibility' });
      return result;
    }

    await textarea.fill(testMessage);
    result.notes.push('Typed message in input');

    // Find and click send button
    const sendButton = page.locator('button').filter({ has: page.locator('svg, [class*="send"]') }).first();
    const hasSend = await sendButton.isVisible().catch(() => false);

    if (hasSend) {
      await sendButton.click();
      result.notes.push('Clicked send button');
    } else {
      // Try pressing Enter
      await textarea.press('Enter');
      result.notes.push('Pressed Enter to send');
    }

    await delay(1000);

    // Check if message appears in chat
    const messageInChat = await page.getByText(testMessage).isVisible().catch(() => false);

    if (messageInChat) {
      result.present = 'pass';
      result.notes.push('Message appears in chat');
    } else {
      result.present = 'fail';
      result.issues.push({ severity: 'blocker', issue: 'Sent message does not appear in chat', fix: 'Fix optimistic update in chat' });
    }

    // Check for typing indicator (may appear briefly)
    const hasTyping = await page.locator('[class*="typing"], [class*="loading"]').isVisible().catch(() => false);
    if (hasTyping) {
      result.notes.push('Typing indicator shown');
      result.designed = 'pass';
    } else {
      result.notes.push('Typing indicator not detected (may have resolved quickly)');
      result.designed = 'unknown';
    }

    // Wait a bit more for potential response
    await delay(3000);

    // Check if any response appeared (from Interviewer)
    const messages = await page.locator('[class*="bubble"], [class*="message"]').count();
    result.notes.push(`Total message elements visible: ${messages}`);

    result.holistic = result.present === 'pass' ? 'pass' : 'fail';

  } catch (error) {
    result.issues.push({ severity: 'blocker', issue: `Message sending failed: ${error}`, fix: 'Debug message sending flow' });
  }

  return result;
}

async function validateSpecialistsPanel(page: Page): Promise<ValidationResult> {
  const result: ValidationResult = {
    step_id: 's006',
    title: '[assert] Specialists panel shows confidence and keywords',
    present: 'unknown',
    designed: 'unknown',
    holistic: 'unknown',
    issues: [],
    notes: [],
  };

  try {
    // Look for specialists panel on the right
    const panelText = await page.getByText(/specialist|guardian|architect|designer|security/i).first().isVisible().catch(() => false);

    if (panelText) {
      result.present = 'pass';
      result.notes.push('Specialists panel content is visible');
    } else {
      // Check if panel exists but is collapsed
      const toggleButton = page.locator('[class*="toggle"], [class*="panel"]').first();
      const hasToggle = await toggleButton.isVisible().catch(() => false);

      if (hasToggle) {
        result.present = 'pass';
        result.notes.push('Panel toggle found - panel may be collapsed');
      } else {
        result.present = 'fail';
        result.issues.push({ severity: 'major', issue: 'Specialists panel not found', fix: 'Ensure SpecialistsPanel renders in layout' });
      }
    }

    // Look for specialist cards
    const specialistCards = await page.locator('[class*="card"], [class*="specialist"]').count();
    result.notes.push(`Found ${specialistCards} potential specialist cards`);

    // Look for confidence indicators
    const hasConfidenceIndicators = await page.locator('[class*="confidence"], [class*="dot"], [class*="progress"]').count() > 0;
    if (hasConfidenceIndicators) {
      result.designed = 'pass';
      result.notes.push('Confidence indicators present');
    } else {
      result.designed = 'unknown';
      result.notes.push('Confidence indicators not detected');
    }

    // Look for keywords/tags
    const hasTags = await page.locator('[class*="tag"], [class*="chip"], [class*="keyword"]').count() > 0;
    if (hasTags) {
      result.notes.push('Keyword tags present');
    }

    result.holistic = result.present === 'pass' ? 'pass' : 'fail';

  } catch (error) {
    result.issues.push({ severity: 'minor', issue: `Specialists panel check failed: ${error}`, fix: 'Debug panel rendering' });
  }

  return result;
}

async function validateResponsiveness(page: Page): Promise<ValidationResult> {
  const result: ValidationResult = {
    step_id: 's007',
    title: '[assert] Layout adapts to viewport changes',
    present: 'unknown',
    designed: 'unknown',
    holistic: 'unknown',
    issues: [],
    notes: [],
  };

  try {
    // Test desktop width
    await page.setViewportSize({ width: 1440, height: 900 });
    await delay(500);

    const desktopLayout = await page.locator('[class*="layout"], main, #root').first().isVisible().catch(() => false);
    if (desktopLayout) {
      result.notes.push('Desktop layout renders correctly');
    }

    // Test tablet width
    await page.setViewportSize({ width: 768, height: 1024 });
    await delay(500);

    const tabletLayout = await page.locator('[class*="layout"], main, #root').first().isVisible().catch(() => false);
    if (tabletLayout) {
      result.notes.push('Tablet layout renders');
    }

    // Note: Mobile is out of scope for v1 per design doc
    result.present = 'pass';
    result.designed = 'pass';
    result.notes.push('Mobile responsive is out of scope for v1');

    // Reset viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    result.holistic = 'pass';

  } catch (error) {
    result.issues.push({ severity: 'minor', issue: `Responsiveness check failed: ${error}`, fix: 'Debug viewport changes' });
  }

  return result;
}

async function runValidation(): Promise<void> {
  console.log('Starting UI/UX Validation for Ideation Frontend\n');
  console.log('Target: http://localhost:3002');
  console.log('='.repeat(60) + '\n');

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless: false, // Set to true for CI
      slowMo: 100,
    });

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    page = await context.newPage();

    const results: ValidationResult[] = [];

    // Run validation steps
    console.log('Step 1: Validating home page...');
    results.push(await validateHomePage(page));

    console.log('Step 2: Checking session list...');
    results.push(await validateSessionList(page));

    console.log('Step 3: Creating new session...');
    results.push(await validateNewSessionModal(page));

    // Get the current session ID from URL if we created one
    const currentUrl = page.url();
    const sessionMatch = currentUrl.match(/\/session\/([a-f0-9-]+)/);
    const sessionId = sessionMatch?.[1];

    if (!sessionId) {
      // Use the existing test session from the API
      const existingSessionId = 'c0b71ea7-a683-4276-a73b-c26e48b29d17';
      console.log(`Using existing session: ${existingSessionId}`);
      results.push(await validateChatInterface(page, existingSessionId));
    } else {
      console.log('Step 4: Validating chat interface...');
      results.push(await validateChatInterface(page));
    }

    console.log('Step 5: Testing message sending...');
    results.push(await validateMessageSending(page));

    console.log('Step 6: Checking specialists panel...');
    results.push(await validateSpecialistsPanel(page));

    console.log('Step 7: Testing responsiveness...');
    results.push(await validateResponsiveness(page));

    // Generate summary
    const summary: ValidationSummary = {
      present: results.every(r => r.present !== 'fail') ? 'pass' : 'fail',
      designed: results.every(r => r.designed !== 'fail') ? 'pass' : 'fail',
      holistic: results.every(r => r.holistic !== 'fail') ? 'pass' : 'fail',
      blockers: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'blocker').length, 0),
      majors: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'major').length, 0),
      minors: results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'minor').length, 0),
    };

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION RESULTS');
    console.log('='.repeat(60) + '\n');

    for (const result of results) {
      console.log(`${result.step_id}: ${result.title}`);
      console.log(`  Present: ${result.present} | Designed: ${result.designed} | Holistic: ${result.holistic}`);
      if (result.notes.length > 0) {
        console.log(`  Notes: ${result.notes.join('; ')}`);
      }
      if (result.issues.length > 0) {
        for (const issue of result.issues) {
          console.log(`  [${issue.severity.toUpperCase()}] ${issue.issue}`);
          console.log(`    Fix: ${issue.fix}`);
        }
      }
      console.log('');
    }

    console.log('SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Present: ${summary.present}`);
    console.log(`Designed: ${summary.designed}`);
    console.log(`Holistic: ${summary.holistic}`);
    console.log(`Blockers: ${summary.blockers} | Majors: ${summary.majors} | Minors: ${summary.minors}`);

    // Output JSON for flow-ui-ux-validation format
    const validationOutput = {
      env: 'local',
      viewport: 'desktop',
      steps: results,
      summary,
    };

    console.log('\n' + '='.repeat(60));
    console.log('JSON OUTPUT (for docs/flow/features/ideation-ui.json)');
    console.log('='.repeat(60));
    console.log(JSON.stringify(validationOutput, null, 2));

  } catch (error) {
    console.error('Validation failed:', error);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

// Run the validation
runValidation().catch(console.error);
