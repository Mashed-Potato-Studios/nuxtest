import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";
import { execa } from "execa";
import { findNuxtRoot } from "../utils/projectUtils";

export class RunAllTestsWithCoverageCommand extends BaseCommand {
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

      // Show progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Running all tests with coverage",
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

            // Check if vitest is installed
            const hasVitest = fs.existsSync(
              path.join(projectRoot, "node_modules", "vitest")
            );
            if (!hasVitest) {
              const installVitest = await vscode.window.showWarningMessage(
                "Vitest is not installed in this project. Install it now?",
                "Yes",
                "No"
              );

              if (installVitest === "Yes") {
                progress.report({ message: "Installing Vitest..." });
                await execa(
                  "npm",
                  ["install", "--save-dev", "vitest", "@vitest/coverage-v8"],
                  { cwd: projectRoot }
                );
              } else {
                this.showError("Vitest is required to run tests with coverage");
                return;
              }
            }

            // Run all tests with coverage
            progress.report({ message: "Running tests with coverage..." });

            // First check if there's a custom coverage script in package.json
            let command = "npx";
            let args = [
              "vitest",
              "run",
              "--coverage",
              "--reporter=json",
              "--outputFile=coverage/coverage.json",
            ];

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

            const { stdout, stderr } = await execa(command, args, {
              cwd: projectRoot,
              reject: false,
            });

            // Show success message
            this.showInfo("All tests completed with coverage");

            // Open coverage view
            vscode.commands.executeCommand("nuxtest.showCoverage");
          } catch (error) {
            // Check if coverage was generated despite test failures
            const coverageJsonPath = path.join(
              projectRoot,
              "coverage",
              "coverage.json"
            );
            if (fs.existsSync(coverageJsonPath)) {
              this.showWarning("Some tests failed but coverage was generated");
              vscode.commands.executeCommand("nuxtest.showCoverage");
            } else {
              this.showError(
                `Failed to run tests with coverage: ${error.message}`
              );

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
