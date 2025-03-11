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
- **Test Explorer**: Browse and run your Nuxt.js tests directly from VSCode
- **Test Results**: View test results in a dedicated panel
- **Test History**: Track test runs and view trends over time
- **Coverage Reports**: View code coverage information
- **Component Preview**: Preview Vue components directly in VSCode
- **Test Organization**: Organize and filter tests with tags and custom categories

## Commands

- `NuxTest: Run Test at Cursor`: Run the test at the current cursor position
- `NuxTest: Run Current Test File`: Run all tests in the current file
- `NuxTest: Run All Tests`: Run all tests in the workspace
- `NuxTest: Debug Test at Cursor`: Debug the test at the current cursor position
- `NuxTest: Debug Current Test File`: Debug all tests in the current file
- `NuxTest: Debug All Tests`: Debug all tests in the workspace
- `NuxTest: Create Test File`: Create a new test file
- `NuxTest: Create Unit Test`: Create a new unit test
- `NuxTest: Create E2E Test`: Create a new E2E test
- `NuxTest: Setup Test Environment`: Set up the test environment
- `NuxTest: Generate Test for Component`: Generate a test for a component
- `NuxTest: Install Playwright Browsers`: Install Playwright browsers
- `NuxTest: Fix E2E Tests`: Fix common E2E test issues
- `NuxTest: Run Test with Coverage`: Run a test with coverage
- `NuxTest: Run All Tests with Coverage`: Run all tests with coverage
- `NuxTest: Show Coverage`: Show coverage information
- `NuxTest: Show Component Preview`: Preview a Vue component in VSCode
- `NuxTest: Create Tag`: Create a new tag for test organization
- `NuxTest: Create Filter Preset`: Create a new filter preset for tests
- `NuxTest: Add Tag to Test`: Add a tag to a test

## Context Menu

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

## Test Organization and Filtering

The Test Organization feature helps you manage large test suites by providing:

- **Tags**: Categorize tests with tags like "unit", "e2e", "component", etc.
- **Filters**: Filter tests by tags, status, duration, and more
- **Grouping**: Group tests by tag, status, feature/component, or custom category
- **Filter Presets**: Save filter configurations for quick access

### Using Tags

Tags help you categorize your tests:

1. Right-click on a test in the Test Explorer and select `Add Tag to Test`
2. Select from existing tags or create a new one
3. Use tags to filter and organize your tests

The system automatically detects and applies some tags based on test content and location:

- Tests in e2e folders get the "E2E" tag
- Tests using Vue Test Utils get the "Component" tag
- Tests in unit folders get the "Unit" tag

### Creating Custom Filters

Create custom filter presets to quickly access specific test subsets:

1. In the Test Organization view, click the "Create Filter Preset" button
2. Enter a name for your filter
3. Configure filter criteria (tags, status, duration, etc.)
4. Save the filter preset for future use

### Grouping Tests

Group tests by different criteria to better understand your test suite:

- **Tag**: Group tests by their tags
- **Status**: Group tests by their status (passed, failed, etc.)
- **Feature/Component**: Group tests by the feature or component they test
- **Category**: Group tests by custom categories

## Requirements

- VS Code `^v1.71.0`
- Nuxt.js project using Vitest for testing
- Node.js

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

## Component Preview

The Component Preview feature allows you to preview Vue components directly in VSCode. This is useful for:

- Quickly checking how a component looks without running the entire application
- Testing component appearance with different props and state
- Verifying component styling and layout

To use the Component Preview feature:

1. Open a Vue component file (`.vue`)
2. Right-click in the editor and select `NuxTest: Show Component Preview`
3. A preview panel will open showing the rendered component

The preview updates automatically when you save changes to the component file.

## Known Issues

- Component preview may not fully support all Vue.js features and complex components
- Some advanced test configurations may require manual setup

## Release Notes

### 0.7.1

- Fixed "Element with id unit is already registered" error in Test Organization view
- Improved error handling for test cache initialization
- Enhanced tree view item ID generation to prevent conflicts
- Added fallback to temporary directory when extension context is not available

### 0.7.0

- Added Test Organization and Filtering feature
- Added tag support for tests
- Added filter presets for quick access
- Added grouping options for tests

### 0.6.0

- Added Component Preview feature
- Fixed various bugs and improved performance

### 0.5.0

- Added Test History & Trends view
- Improved test result reporting

### 0.4.0

- Added Coverage Reports
- Added Debug support

### 0.3.0

- Added E2E test support
- Added test generation features

### 0.2.0

- Added Test Results view
- Added Actions view

### 0.1.0

- Initial release with basic test running capabilities
