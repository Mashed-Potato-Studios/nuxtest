import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Required dependencies for Nuxt testing based on documentation
 * @see https://nuxt.com/docs/getting-started/testing
 */
const REQUIRED_DEPENDENCIES = {
  unit: ["@nuxt/test-utils", "vitest", "@vue/test-utils", "happy-dom"],
  e2e: ["@nuxt/test-utils", "playwright-core"],
};

/**
 * Checks if the user's project has the necessary dependencies for Nuxt testing
 */
export async function checkNuxtTestingDependencies(
  workspaceRoot: string
): Promise<boolean> {
  try {
    // Check if package.json exists
    const packageJsonPath = path.join(workspaceRoot, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      vscode.window.showErrorMessage(
        "NuxTest: Could not find package.json in your project."
      );
      return false;
    }

    // Read package.json
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    // Combine dependencies and devDependencies
    const allDependencies = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    // Check for missing dependencies
    const missingUnitDeps = REQUIRED_DEPENDENCIES.unit.filter(
      (dep) => !allDependencies[dep]
    );
    const missingE2EDeps = REQUIRED_DEPENDENCIES.e2e.filter(
      (dep) => !allDependencies[dep]
    );

    // Check for vitest.config.ts or vitest.config.js
    const vitestConfigExists =
      fs.existsSync(path.join(workspaceRoot, "vitest.config.ts")) ||
      fs.existsSync(path.join(workspaceRoot, "vitest.config.js")) ||
      fs.existsSync(path.join(workspaceRoot, "vitest.config.mts")) ||
      fs.existsSync(path.join(workspaceRoot, "vitest.config.mjs"));

    if (
      missingUnitDeps.length > 0 ||
      missingE2EDeps.length > 0 ||
      !vitestConfigExists
    ) {
      const missingDeps = [...new Set([...missingUnitDeps, ...missingE2EDeps])];

      // Create installation instructions
      let message = "NuxTest: Missing required dependencies for Nuxt testing.";

      const installDepsAction = "Install Dependencies";
      const setupConfigAction = "Setup Vitest Config";
      const learnMoreAction = "Learn More";

      vscode.window
        .showWarningMessage(
          message,
          installDepsAction,
          setupConfigAction,
          learnMoreAction
        )
        .then(async (selection) => {
          if (selection === installDepsAction) {
            // Create terminal and run install command
            const terminal = vscode.window.createTerminal(
              "NuxTest Dependency Installation"
            );
            const installCmd = `npm install --save-dev ${missingDeps.join(
              " "
            )}`;
            terminal.sendText(installCmd);
            terminal.show();
          } else if (selection === setupConfigAction) {
            // Create vitest.config.ts file
            await createVitestConfig(workspaceRoot);
          } else if (selection === learnMoreAction) {
            vscode.env.openExternal(
              vscode.Uri.parse("https://nuxt.com/docs/getting-started/testing")
            );
          }
        });

      return false;
    }

    return true;
  } catch (error) {
    console.error("Error checking Nuxt testing dependencies:", error);
    vscode.window.showErrorMessage(
      `NuxTest: Error checking dependencies - ${error.message}`
    );
    return false;
  }
}

/**
 * Creates a basic vitest.config.ts file for Nuxt testing
 */
async function createVitestConfig(workspaceRoot: string): Promise<void> {
  const vitestConfigPath = path.join(workspaceRoot, "vitest.config.ts");

  // Don't overwrite existing config
  if (fs.existsSync(vitestConfigPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      "vitest.config.ts already exists. Overwrite?",
      "Yes",
      "No"
    );

    if (overwrite !== "Yes") {
      return;
    }
  }

  const configContent = `import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        // Nuxt specific options
        domEnvironment: 'happy-dom', // 'happy-dom' (default) or 'jsdom'
      }
    }
  }
})
`;

  fs.writeFileSync(vitestConfigPath, configContent, "utf8");
  vscode.window.showInformationMessage("NuxTest: Created vitest.config.ts");

  // Open the file
  const document = await vscode.workspace.openTextDocument(vitestConfigPath);
  vscode.window.showTextDocument(document);
}
