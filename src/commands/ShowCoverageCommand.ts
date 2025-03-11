import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";
import { findNuxtRoot } from "../utils/projectUtils";
import { execa } from "execa";

export class ShowCoverageCommand extends BaseCommand {
  async execute(): Promise<void> {
    try {
      // Get workspace root
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        this.showError("No workspace folder open");
        return;
      }

      // Find Nuxt project root
      let projectRoot = findNuxtRoot(workspaceRoot);

      // If we couldn't find a Nuxt project root, ask the user if they want to use the workspace root
      if (!projectRoot) {
        const useWorkspaceRoot = await vscode.window.showWarningMessage(
          "Could not automatically detect Nuxt project root. Use workspace root instead?",
          "Yes",
          "No"
        );

        if (useWorkspaceRoot === "Yes") {
          projectRoot = workspaceRoot;
        } else {
          return;
        }
      }

      // Check for missing dependencies before proceeding
      await this.checkAndInstallDependencies(projectRoot);

      // Check for coverage data in multiple possible locations
      const possibleCoveragePaths = [
        path.join(projectRoot, "coverage", "coverage.json"),
        path.join(projectRoot, "coverage", "coverage-final.json"),
        path.join(projectRoot, ".coverage", "coverage.json"),
        path.join(projectRoot, ".nuxt", "coverage", "coverage.json"),
      ];

      let coverageJsonPath = null;
      for (const coveragePath of possibleCoveragePaths) {
        if (fs.existsSync(coveragePath)) {
          coverageJsonPath = coveragePath;
          break;
        }
      }

      if (!coverageJsonPath) {
        // Ask if user wants to run tests with coverage
        const runTests = await vscode.window.showInformationMessage(
          "No coverage data found. Run tests with coverage?",
          "Yes",
          "No"
        );

        if (runTests === "Yes") {
          // Run tests with coverage directly
          await this.runTestsWithCoverage(projectRoot);
          return;
        } else {
          return;
        }
      }

      // Load coverage data
      const coverageLoaded = await vscode.commands.executeCommand(
        "nuxtest.loadCoverageData",
        coverageJsonPath
      );

      if (!coverageLoaded) {
        this.showError("Failed to load coverage data");

        // Try to show the raw coverage data
        try {
          const coverageData = fs.readFileSync(coverageJsonPath, "utf8");
          const outputChannel =
            vscode.window.createOutputChannel("NuxTest Coverage");
          outputChannel.appendLine("Raw coverage data:");
          outputChannel.appendLine(coverageData.substring(0, 10000) + "...");
          outputChannel.show();
        } catch (error) {
          console.error("Error showing raw coverage data:", error);
        }
      }
    } catch (error) {
      this.showError(`Error showing coverage: ${error.message}`);

      // Show detailed error information
      const outputChannel =
        vscode.window.createOutputChannel("NuxTest Coverage");
      outputChannel.appendLine("Error showing coverage:");
      outputChannel.appendLine(error.message);
      outputChannel.show();
    }
  }

  // Check for and install missing dependencies
  private async checkAndInstallDependencies(
    projectRoot: string
  ): Promise<void> {
    // Check for required dependencies
    const hasVitest = fs.existsSync(
      path.join(projectRoot, "node_modules", "vitest")
    );
    const hasCoverageV8 = fs.existsSync(
      path.join(projectRoot, "node_modules", "@vitest", "coverage-v8")
    );
    const hasPlaywright = fs.existsSync(
      path.join(projectRoot, "node_modules", "@playwright", "test")
    );

    const missingDeps = [];
    if (!hasVitest) missingDeps.push("vitest");
    if (!hasCoverageV8) missingDeps.push("@vitest/coverage-v8");

    // Check for Playwright config files
    const hasPlaywrightConfig =
      fs.existsSync(path.join(projectRoot, "playwright.config.ts")) ||
      fs.existsSync(path.join(projectRoot, "playwright.config.js"));

    // If there's a Playwright config but no dependency, add it to the list
    if (hasPlaywrightConfig && !hasPlaywright) {
      missingDeps.push("@playwright/test");

      // Show a specific message for Playwright
      const installPlaywright = await vscode.window.showWarningMessage(
        "Found Playwright configuration but '@playwright/test' is not installed. This may affect coverage reporting. Install it now?",
        "Yes",
        "No"
      );

      if (installPlaywright === "Yes") {
        await this.installDependencies(["@playwright/test"], projectRoot);
      }
    }

    // If there are other missing dependencies, prompt to install them
    if (missingDeps.length > 0 && !missingDeps.includes("@playwright/test")) {
      const installDeps = await vscode.window.showWarningMessage(
        `Missing dependencies for test coverage: ${missingDeps.join(
          ", "
        )}. Install them now?`,
        "Yes",
        "No"
      );

      if (installDeps === "Yes") {
        await this.installDependencies(missingDeps, projectRoot);
      }
    }
  }

  // Install dependencies and show progress
  private async installDependencies(
    dependencies: string[],
    projectRoot: string
  ): Promise<void> {
    try {
      // Show progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Installing ${dependencies.join(", ")}`,
          cancellable: false,
        },
        async (progress) => {
          // Show installation progress in output channel
          const outputChannel = vscode.window.createOutputChannel(
            "NuxTest Dependencies"
          );
          outputChannel.appendLine(
            `Installing dependencies: ${dependencies.join(", ")}...`
          );
          outputChannel.show();

          try {
            // Install dependencies
            const { stdout } = await execa(
              "npm",
              ["install", "--save-dev", ...dependencies],
              {
                cwd: projectRoot,
                stdio: "pipe",
              }
            );

            outputChannel.appendLine(stdout);
            outputChannel.appendLine("Dependencies installed successfully!");
            this.showInfo(`Successfully installed ${dependencies.join(", ")}`);
          } catch (error) {
            this.showError(`Failed to install dependencies: ${error.message}`);

            // Show detailed error information
            outputChannel.appendLine("Error installing dependencies:");
            outputChannel.appendLine(error.message);
            if (error.stdout) outputChannel.appendLine(error.stdout);
            if (error.stderr) outputChannel.appendLine(error.stderr);
            throw error;
          }
        }
      );
    } catch (error) {
      // Error is already handled in the progress callback
      console.error("Error installing dependencies:", error);
    }
  }

  // Run tests with coverage directly instead of calling the command
  private async runTestsWithCoverage(projectRoot: string): Promise<void> {
    try {
      // Check for missing dependencies before running tests
      await this.checkAndInstallDependencies(projectRoot);

      // Show progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Running tests with coverage",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Running tests..." });

          try {
            // Create coverage directory if it doesn't exist
            const coverageDir = path.join(projectRoot, "coverage");
            if (!fs.existsSync(coverageDir)) {
              fs.mkdirSync(coverageDir, { recursive: true });
            }

            // Run all tests with coverage
            progress.report({ message: "Running tests with coverage..." });

            // First check if there's a custom coverage script in package.json
            let command = "npx";
            let args = ["vitest", "run", "--coverage"];

            try {
              const packageJsonPath = path.join(projectRoot, "package.json");
              if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(
                  fs.readFileSync(packageJsonPath, "utf8")
                );
                if (
                  packageJson.scripts &&
                  packageJson.scripts["test:coverage"]
                ) {
                  // Use the project's own test:coverage script
                  command = "npm";
                  args = ["run", "test:coverage"];
                }
              }
            } catch (error) {
              console.log(`Error reading package.json: ${error.message}`);
            }

            // Create an output channel to show test output in real-time
            const outputChannel =
              vscode.window.createOutputChannel("NuxTest Coverage");
            outputChannel.appendLine("Running tests with coverage...");
            outputChannel.show();

            try {
              // Run the tests with coverage
              const childProcess = execa(command, args, {
                cwd: projectRoot,
                reject: false,
                stdio: "pipe",
              });

              // Stream output to the output channel
              if (childProcess.stdout) {
                childProcess.stdout.on("data", (data) => {
                  outputChannel.append(data.toString());
                });
              }

              if (childProcess.stderr) {
                childProcess.stderr.on("data", (data) => {
                  outputChannel.append(data.toString());
                });
              }

              const { stdout, stderr } = await childProcess;

              // Check for coverage files in multiple locations
              const possibleCoveragePaths = [
                path.join(projectRoot, "coverage", "coverage.json"),
                path.join(projectRoot, "coverage", "coverage-final.json"),
                path.join(projectRoot, ".coverage", "coverage.json"),
                path.join(projectRoot, ".nuxt", "coverage", "coverage.json"),
              ];

              let coverageJsonPath = null;
              for (const coveragePath of possibleCoveragePaths) {
                if (fs.existsSync(coveragePath)) {
                  coverageJsonPath = coveragePath;
                  break;
                }
              }

              if (coverageJsonPath) {
                // Show success message
                this.showInfo("All tests completed with coverage");

                // Load coverage data
                await vscode.commands.executeCommand(
                  "nuxtest.loadCoverageData",
                  coverageJsonPath
                );
              } else {
                // Try to create a vitest.config.ts file if it doesn't exist
                const vitestConfigPath = path.join(
                  projectRoot,
                  "vitest.config.ts"
                );
                if (!fs.existsSync(vitestConfigPath)) {
                  outputChannel.appendLine(
                    "\nNo coverage data generated. Creating vitest.config.ts file..."
                  );

                  const vitestConfig = `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage'
    }
  }
})
`;
                  fs.writeFileSync(vitestConfigPath, vitestConfig);
                  outputChannel.appendLine(
                    "Created vitest.config.ts file. Trying to run tests again..."
                  );

                  // Try running tests again with the new config
                  const { stdout: stdout2, stderr: stderr2 } = await execa(
                    command,
                    args,
                    {
                      cwd: projectRoot,
                      reject: false,
                    }
                  );

                  outputChannel.appendLine("\nSecond test run output:");
                  outputChannel.appendLine(stdout2);
                  if (stderr2) outputChannel.appendLine(stderr2);

                  // Check for coverage files again
                  for (const coveragePath of possibleCoveragePaths) {
                    if (fs.existsSync(coveragePath)) {
                      coverageJsonPath = coveragePath;
                      break;
                    }
                  }

                  if (coverageJsonPath) {
                    this.showInfo(
                      "All tests completed with coverage on second attempt"
                    );

                    // Load coverage data
                    await vscode.commands.executeCommand(
                      "nuxtest.loadCoverageData",
                      coverageJsonPath
                    );
                  } else {
                    this.showInfo(
                      "Tests ran but no coverage data was generated"
                    );
                    outputChannel.appendLine(
                      "\nNo coverage data was generated after two attempts."
                    );
                    outputChannel.appendLine(
                      "Please check your project configuration and make sure @vitest/coverage-v8 is properly installed."
                    );
                  }
                } else {
                  this.showInfo("Tests ran but no coverage data was generated");
                }
              }
            } catch (error) {
              // Check if coverage was generated despite test failures
              const coverageJsonPath = path.join(
                projectRoot,
                "coverage",
                "coverage.json"
              );
              if (fs.existsSync(coverageJsonPath)) {
                this.showInfo("Some tests failed but coverage was generated");

                // Load coverage data
                await vscode.commands.executeCommand(
                  "nuxtest.loadCoverageData",
                  coverageJsonPath
                );
              } else {
                this.showError(
                  `Failed to run tests with coverage: ${error.message}`
                );

                // Show detailed error information
                outputChannel.appendLine(
                  "\nError running tests with coverage:"
                );
                outputChannel.appendLine(error.message);
                if (error.stdout) outputChannel.appendLine(error.stdout);
                if (error.stderr) outputChannel.appendLine(error.stderr);
              }
            }
          } catch (error) {
            // Check if coverage was generated despite test failures
            const coverageJsonPath = path.join(
              projectRoot,
              "coverage",
              "coverage.json"
            );
            if (fs.existsSync(coverageJsonPath)) {
              this.showInfo("Some tests failed but coverage was generated");

              // Load coverage data
              await vscode.commands.executeCommand(
                "nuxtest.loadCoverageData",
                coverageJsonPath
              );
            } else {
              this.showError(
                `Failed to run tests with coverage: ${error.message}`
              );

              // Show detailed error information
              outputChannel.appendLine("\nError running tests with coverage:");
              outputChannel.appendLine(error.message);
              if (error.stdout) outputChannel.appendLine(error.stdout);
              if (error.stderr) outputChannel.appendLine(error.stderr);
            }
          }
        }
      );
    } catch (error) {
      this.showError(`Error running tests with coverage: ${error.message}`);

      // Show detailed error information
      const outputChannel =
        vscode.window.createOutputChannel("NuxTest Coverage");
      outputChannel.appendLine("Error running tests with coverage:");
      outputChannel.appendLine(error.message);
      if (error.stdout) outputChannel.appendLine(error.stdout);
      if (error.stderr) outputChannel.appendLine(error.stderr);
      outputChannel.show();
    }
  }
}
