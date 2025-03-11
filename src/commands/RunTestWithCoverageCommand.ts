import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";
import { execa } from "execa";
import { findNuxtRoot } from "../utils/projectUtils";

export class RunTestWithCoverageCommand extends BaseCommand {
  async execute(filePathOrUri?: string | vscode.Uri): Promise<void> {
    try {
      let filePath: string;

      // Handle different input types
      if (filePathOrUri instanceof vscode.Uri) {
        filePath = filePathOrUri.fsPath;
      } else if (typeof filePathOrUri === "string") {
        filePath = filePathOrUri;
      } else {
        // If no file is provided, use the active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          this.showError("No active editor found");
          return;
        }
        filePath = activeEditor.document.uri.fsPath;
      }

      // Check if the file is a test file
      if (!filePath.includes(".spec.") && !filePath.includes(".test.")) {
        this.showError("Not a test file. Please select a test file.");
        return;
      }

      // Find Nuxt project root
      const nuxtRoot = findNuxtRoot(filePath);
      if (!nuxtRoot) {
        this.showError("Could not find Nuxt project root");
        return;
      }

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
            const coverageDir = path.join(nuxtRoot, "coverage");
            if (!fs.existsSync(coverageDir)) {
              fs.mkdirSync(coverageDir, { recursive: true });
            }

            // Get relative path to the test file
            const relativePath = path.relative(nuxtRoot, filePath);

            // Run the test with coverage
            const { stdout, stderr } = await execa(
              "npx",
              [
                "vitest",
                "run",
                relativePath,
                "--coverage",
                "--reporter=json",
                "--outputFile=coverage/coverage.json",
              ],
              { cwd: nuxtRoot }
            );

            // Show success message
            this.showInfo("Tests completed with coverage");

            // Open coverage view
            vscode.commands.executeCommand("nuxtest.showCoverage");
          } catch (error) {
            // Check if coverage was generated despite test failures
            const coverageJsonPath = path.join(
              nuxtRoot,
              "coverage",
              "coverage.json"
            );
            if (fs.existsSync(coverageJsonPath)) {
              this.showWarning("Tests failed but coverage was generated");
              vscode.commands.executeCommand("nuxtest.showCoverage");
            } else {
              this.showError(
                `Failed to run tests with coverage: ${error.message}`
              );
            }
          }
        }
      );
    } catch (error) {
      this.showError(`Error running tests with coverage: ${error.message}`);
    }
  }
}
