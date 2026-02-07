# Tend E2E Tests

End-to-end tests for the Tend application using Playwright.

## Running Tests

```bash
# Run all e2e tests (headless)
npm run test:e2e -w tend

# Run tests in headed mode (see browser)
npm run test:e2e:headed -w tend

# Run tests in debug mode (step through with Playwright Inspector)
npm run test:e2e:debug -w tend

# Run specific test file
npm run test:e2e -w tend -- e2e/dashboard.spec.ts

# Run tests matching a pattern
npm run test:e2e -w tend -- -g "should load dashboard"
```

## Test Structure

- **dashboard.spec.ts** - Dashboard page tests (project list, creation, navigation)
- **settings.spec.ts** - Settings page tests (theme toggle, preferences, sections)
- **navigation.spec.ts** - Navigation tests (routing, browser back/forward, URL state)
- **canvas.spec.ts** - Canvas/session page tests (three-column layout, loading, focus mode)

## Test Philosophy

These tests focus on:
- **UI rendering** - Does the page load without crashing?
- **User interactions** - Can users click, type, and navigate?
- **Resilience** - Does the app handle errors gracefully?

Tests intentionally:
- Use flexible selectors (data-testid preferred, fallback to text content)
- Handle missing API responses gracefully (backend may not be running)
- Avoid brittle assertions on exact text or CSS classes
- Focus on user-visible behavior, not implementation details

## Requirements

- Backend server running on port 3001 (auto-started by Playwright config)
- Vite dev server on port 3004 (auto-started by Playwright config)
- Test databases created automatically in temp directory

## Debugging Tips

1. **Visual debugging**: Use `npm run test:e2e:headed -w tend` to see tests run
2. **Step-by-step**: Use `npm run test:e2e:debug -w tend` to step through with inspector
3. **Screenshots**: Failed tests automatically capture screenshots (see `test-results/`)
4. **Trace viewer**: View traces for failed tests with `npx playwright show-trace test-results/.../trace.zip`

## CI/CD

In CI environments:
- Tests run in headless mode
- Retry failed tests up to 2 times
- HTML report generated (but not opened automatically)
- Screenshots and videos captured for failures
