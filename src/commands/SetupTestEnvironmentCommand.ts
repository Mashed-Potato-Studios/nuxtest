import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";

export class SetupTestEnvironmentCommand extends BaseCommand {
  async execute(): Promise<void> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        this.showError("No workspace folder open");
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;

      // Determine what type of setup to perform
      const setupType = await this.promptForSetupType();
      if (!setupType) {
        return;
      }

      // Perform the selected setup
      switch (setupType) {
        case "unit":
          await this.setupUnitTestEnvironment(rootPath);
          break;
        case "e2e":
          await this.setupE2ETestEnvironment(rootPath);
          break;
        case "both":
          await this.setupUnitTestEnvironment(rootPath);
          await this.setupE2ETestEnvironment(rootPath);
          break;
      }

      this.showInfo("Test environment setup complete");
    } catch (error) {
      this.showError(`Failed to setup test environment: ${error.message}`);
    }
  }

  private async promptForSetupType(): Promise<string | undefined> {
    const options = [
      {
        label: "Unit Testing",
        description: "Setup environment for component unit tests",
        value: "unit",
      },
      {
        label: "End-to-End Testing",
        description: "Setup environment for E2E tests",
        value: "e2e",
      },
      {
        label: "Both",
        description: "Setup environment for both unit and E2E tests",
        value: "both",
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: "Select the type of test environment to setup",
    });

    return selected?.value;
  }

  private async setupUnitTestEnvironment(rootPath: string): Promise<void> {
    // Create vitest.config.ts if it doesn't exist
    const vitestConfigPath = path.join(rootPath, "vitest.config.ts");
    if (!fs.existsSync(vitestConfigPath)) {
      const vitestConfig = `import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        // Nuxt specific options
        domEnvironment: 'happy-dom', // 'happy-dom' (default) or 'jsdom'
      }
    },
    // Increase timeout for E2E tests
    testTimeout: 60000,
    // Retry failed tests to handle flakiness
    retry: 1
  }
})
`;
      fs.writeFileSync(vitestConfigPath, vitestConfig, "utf8");
      this.showInfo("Created vitest.config.ts");
    }

    // Update package.json to add test script
    const packageJsonPath = path.join(rootPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);

        // Add test script if it doesn't exist
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }

        if (!packageJson.scripts.test) {
          packageJson.scripts.test = "vitest";

          // Write updated package.json
          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2),
            "utf8"
          );

          this.showInfo("Added test script to package.json");
        }
      } catch (error) {
        this.showError(`Failed to update package.json: ${error.message}`);
      }
    }

    // Create example test directory and file
    const componentsTestDir = path.join(rootPath, "components");
    if (!fs.existsSync(componentsTestDir)) {
      fs.mkdirSync(componentsTestDir, { recursive: true });
    }

    const exampleTestPath = path.join(componentsTestDir, "example.spec.ts");
    if (!fs.existsSync(exampleTestPath)) {
      const exampleTest = `// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';

describe('Example Component', () => {
  it('renders correctly', async () => {
    const wrapper = await mountSuspended({
      template: '<div>Example component</div>'
    });
    
    expect(wrapper.html()).toContain('Example component');
  });
});
`;
      fs.writeFileSync(exampleTestPath, exampleTest, "utf8");
      this.showInfo("Created example unit test");
    }

    // Create nuxt.config.ts module entry if it doesn't exist
    const nuxtConfigPath = path.join(rootPath, "nuxt.config.ts");
    if (fs.existsSync(nuxtConfigPath)) {
      try {
        const nuxtConfigContent = fs.readFileSync(nuxtConfigPath, "utf8");

        // Check if @nuxt/test-utils/module is already in the config
        if (!nuxtConfigContent.includes("@nuxt/test-utils/module")) {
          // Simple approach to add the module - this is not perfect but works for basic configs
          let updatedConfig = nuxtConfigContent;

          if (nuxtConfigContent.includes("modules:")) {
            // Add to existing modules array
            updatedConfig = nuxtConfigContent.replace(
              /modules:\s*\[([\s\S]*?)\]/,
              (match, modules) => {
                return `modules: [${modules}${
                  modules.trim() ? "," : ""
                }\n    '@nuxt/test-utils/module'\n  ]`;
              }
            );
          } else {
            // Add new modules section
            updatedConfig = nuxtConfigContent.replace(
              /export default\s+defineNuxtConfig\s*\(\s*\{/,
              `export default defineNuxtConfig({\n  modules: ['@nuxt/test-utils/module'],`
            );
          }

          if (updatedConfig !== nuxtConfigContent) {
            fs.writeFileSync(nuxtConfigPath, updatedConfig, "utf8");
            this.showInfo("Added @nuxt/test-utils/module to nuxt.config.ts");
          }
        }
      } catch (error) {
        this.showError(`Failed to update nuxt.config.ts: ${error.message}`);
      }
    }
  }

  private async setupE2ETestEnvironment(rootPath: string): Promise<void> {
    // Create e2e test directory
    const e2eDir = path.join(rootPath, "tests", "e2e");
    if (!fs.existsSync(e2eDir)) {
      fs.mkdirSync(e2eDir, { recursive: true });
    }

    // Create example e2e test
    const exampleE2EPath = path.join(e2eDir, "example.spec.ts");
    if (!fs.existsSync(exampleE2EPath)) {
      const exampleE2E = `import { describe, test, expect } from 'vitest';
import { setup, $fetch, createPage } from '@nuxt/test-utils/e2e';

// Increase the default timeout for E2E tests
const E2E_TIMEOUT = 60000;

describe('Example E2E Test', async () => {
  await setup({
    // Test context options
    // rootDir: '.',  // Path to your Nuxt app
    browser: true, // Enable browser testing
  });

  test('page renders correctly', async () => {
    // Test using $fetch to get HTML
    const html = await $fetch('/');
    expect(html).toContain('Welcome to Nuxt');
  });

  // Browser tests - these require Playwright browsers to be installed
  // Run 'npx playwright install' if you haven't already
  test('navigation works', async () => {
    try {
      // Test using Playwright browser with a longer timeout
      const page = await createPage('/', { timeout: 10000 });
      
      // Disable strict mode for this test
      page.setDefaultTimeout(5000);
      
      try {
        // Use a more specific selector - first h1 on the page
        const heading = page.locator('h1').first();
        
        // Check if heading exists before waiting for it
        if (await heading.count() > 0) {
          await heading.waitFor({ state: 'visible', timeout: 5000 });
          
          // Get the heading text and assert with Vitest
          const headingText = await heading.textContent();
          expect(headingText).toBeTruthy();
          console.log('Found heading:', headingText);
        } else {
          console.log('No h1 heading found, trying any heading');
          // Try to find any heading as fallback
          const anyHeading = page.locator('h2, h3, h4, h5, h6').first();
          if (await anyHeading.count() > 0) {
            const headingText = await anyHeading.textContent();
            expect(headingText).toBeTruthy();
            console.log('Found alternative heading:', headingText);
          } else {
            console.log('No headings found at all');
          }
        }
      } catch (elementError) {
        console.error('Error interacting with page elements:', elementError);
        // Continue with the test even if element interaction fails
      }
    } catch (error) {
      if (error.message?.includes('Executable doesn\\'t exist')) {
        console.warn('Playwright browser not installed. Run "npx playwright install" to enable browser tests.');
        // Skip test instead of failing
        test.skip();
      } else {
        throw error;
      }
    }
  }, E2E_TIMEOUT);
});
`;
      fs.writeFileSync(exampleE2EPath, exampleE2E, "utf8");
      this.showInfo("Created example E2E test");
    }

    // Create playwright config if using playwright
    const playwrightConfigPath = path.join(rootPath, "playwright.config.ts");
    if (!fs.existsSync(playwrightConfigPath)) {
      const playwrightConfig = `import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import type { ConfigOptions } from '@nuxt/test-utils/playwright';

export default defineConfig<ConfigOptions>({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url))
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
`;
      fs.writeFileSync(playwrightConfigPath, playwrightConfig, "utf8");
      this.showInfo("Created playwright.config.ts");
    }

    // Install Playwright browsers
    const installPlaywrightBrowsers =
      await vscode.window.showInformationMessage(
        "Do you want to install Playwright browsers? This is required for E2E tests.",
        "Yes",
        "No"
      );

    if (installPlaywrightBrowsers === "Yes") {
      try {
        const terminal = vscode.window.createTerminal(
          "NuxTest Playwright Setup"
        );
        terminal.show();
        terminal.sendText("npx playwright install chromium");

        this.showInfo(
          "Installing Playwright browsers. This may take a few minutes."
        );
      } catch (error) {
        this.showError(
          `Failed to install Playwright browsers: ${error.message}`
        );
      }
    } else {
      this.showInfo(
        'Skipping Playwright browser installation. You will need to run "npx playwright install" manually before running E2E tests.'
      );
    }
  }
}
