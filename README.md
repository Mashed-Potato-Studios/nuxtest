# NuxTest - Nuxt Testing Extension for VS Code

NuxTest is a VS Code extension designed to simplify running tests for Nuxt.js applications. It integrates with Vitest to provide a seamless testing experience directly within your editor.

## Features

- 🧪 Run a single test at the cursor position
- 📂 Run all tests in the current file
- 🚀 Run all tests in the project
- 🐞 Debug tests directly in VS Code
- 📋 View test results directly in the editor's output panel
- 📊 Test coverage visualization with line-by-line highlighting
- 📈 Test history and trends tracking to identify flaky tests
- ⚡ Test result caching for faster test runs
- 🔧 Automatic E2E test fixes for common issues
- 🧩 Create unit and E2E tests with templates
- 🔄 Clear test cache when needed

## Requirements

- VS Code `^v1.71.0`
- Nuxt.js project using Vitest for testing
- Node.js

## Usage

### Commands

The extension provides the following commands:

- `NuxTest: Run Test at Cursor` - Run the test at the current cursor position
- `NuxTest: Run Current Test File` - Run all tests in the current file
- `NuxTest: Run All Tests` - Run all tests in the project
- `NuxTest: Debug Test at Cursor` - Debug the test at the current cursor position
- `NuxTest: Debug Current Test File` - Debug all tests in the current file
- `NuxTest: Debug All Tests` - Debug all tests in the project
- `NuxTest: Create Unit Test` - Create a new unit test with a template
- `NuxTest: Create E2E Test` - Create a new end-to-end test with a template
- `NuxTest: Fix E2E Tests` - Fix common issues in E2E tests
- `NuxTest: Clear Test Cache` - Clear cached test results
- `NuxTest: Run Test with Coverage` - Run the current test with coverage
- `NuxTest: Run All Tests with Coverage` - Run all tests with coverage
- `NuxTest: Show Coverage` - Show the coverage report
- `NuxTest: Clear Coverage Data` - Clear coverage data
- `NuxTest: Refresh Test History` - Refresh the test history view
- `NuxTest: Clear Test History` - Clear all test history data

### Context Menu

Right-click in a test file to access NuxTest commands:

- In the editor: Run or debug the test at cursor position, run the current test file, or run with coverage
- In the explorer: Run or debug the selected test file or run with coverage

### Test Debugging

NuxTest provides integrated debugging for your tests:

- Debug a specific test at the cursor position
- Debug all tests in a file
- Debug all tests in the project
- Automatically creates and updates VS Code launch configurations
- Checks for required dependencies and offers to install them if missing
- Provides a seamless debugging experience with breakpoints, variable inspection, and more

### Test History and Trends

NuxTest now includes test history and trends tracking:

- Automatically records test results in a local database
- View test run history with pass/fail status and duration
- Identify flaky tests that alternate between passing and failing
- See trends in test performance over time
- Visualize pass rates and stability metrics for each test
- Quickly navigate to problematic tests that need attention

The Test History & Trends view categorizes tests as:

- **Flaky**: Tests that frequently alternate between passing and failing
- **Unstable**: Tests with low pass rates
- **Mostly Stable**: Tests that pass most of the time but occasionally fail
- **Stable**: Tests that consistently pass

### Test Caching

NuxTest includes test result caching to speed up your test runs:

- Test results are cached automatically after each run
- Subsequent runs use cached results if the test file hasn't changed
- Cache expires after 24 hours to ensure tests are periodically re-run
- Clear the cache manually using the "Clear Test Cache" command

When running all tests, you'll be asked if you want to use cached results where available.

### E2E Test Fixes

The "Fix E2E Tests" command helps resolve common issues in E2E tests:

- Adds appropriate timeouts
- Improves element selection strategies
- Handles navigation issues
- Makes assertions more robust
- Adds error handling

### Test Coverage Visualization

NuxTest now includes test coverage visualization:

- Run tests with coverage to generate coverage data
- View coverage statistics in the Coverage view
- See line-by-line coverage highlighting in your code
- Covered lines are highlighted in green, uncovered in red
- Hover over lines to see coverage status

## Extension Settings

This extension doesn't require any specific settings.

## Recommended Testing Setup for Nuxt

For the best experience with this extension, set up your Nuxt project with Vitest:

1. Install dependencies:

```bash
npm i --save-dev @nuxt/test-utils vitest @vue/test-utils happy-dom @vitest/coverage-v8
```

2. Create a `vitest.config.ts`:

```typescript
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
```

3. Add a test script to your `package.json`:

```json
"scripts": {
  "test": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

MIT

## Credits

This extension was inspired by the Nuxtr VS Code extension.
