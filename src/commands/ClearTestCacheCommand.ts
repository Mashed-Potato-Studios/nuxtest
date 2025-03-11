import * as vscode from "vscode";
import * as path from "path";
import { BaseCommand } from "./base";
import * as testCache from "../utils/testCache";

export class ClearTestCacheCommand extends BaseCommand {
  async execute(): Promise<void> {
    try {
      // Ask user if they want to clear all cache or just for a specific file
      const clearOption = await vscode.window.showQuickPick(
        [
          {
            label: "Clear all test cache",
            description: "Clear cached results for all test files",
          },
          {
            label: "Clear cache for specific file",
            description: "Select a test file to clear its cache",
          },
        ],
        { placeHolder: "Select cache clearing option" }
      );

      if (!clearOption) {
        return; // User cancelled
      }

      if (clearOption.label === "Clear all test cache") {
        // Clear all cache
        testCache.clearCache();
        this.showInfo("Test cache cleared successfully");
      } else {
        // Find all test files
        const testFiles = await vscode.workspace.findFiles(
          "**/tests/**/*.spec.{js,ts}",
          "**/node_modules/**"
        );

        if (testFiles.length === 0) {
          this.showInfo("No test files found");
          return;
        }

        // Get workspace root
        const workspaceRoot =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
          this.showError("No workspace folder open");
          return;
        }

        // Create items for quick pick
        const items = testFiles.map((file) => {
          const relativePath = path.relative(workspaceRoot, file.fsPath);
          return {
            label: path.basename(file.fsPath),
            description: relativePath,
            filePath: file.fsPath,
          };
        });

        // Show quick pick
        const selectedFile = await vscode.window.showQuickPick(items, {
          placeHolder: "Select test file to clear cache",
        });

        if (!selectedFile) {
          return; // User cancelled
        }

        // Clear cache for selected file
        const cache = testCache.loadCache();
        testCache.clearCacheForFile(selectedFile.filePath, cache);
        this.showInfo(`Cache cleared for ${selectedFile.label}`);
      }
    } catch (error) {
      this.showError(`Failed to clear test cache: ${error.message}`);
    }
  }
}
