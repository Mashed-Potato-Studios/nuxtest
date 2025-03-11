import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";
import { findNuxtRoot, ensureVitestInstalled } from "../utils/projectUtils";

export class DebugTestFileCommand extends BaseCommand {
  async execute(filePathOrItem?: string | any): Promise<void> {
    try {
      // Handle TestItem objects or file paths
      let filePath: string;

      if (typeof filePathOrItem === "string") {
        filePath = filePathOrItem;
      } else if (filePathOrItem && filePathOrItem.uri) {
        // Handle VS Code TestItem
        filePath = filePathOrItem.uri.fsPath;
      } else if (filePathOrItem && filePathOrItem.filePath) {
        // Handle our own test item format
        filePath = filePathOrItem.filePath;
      } else {
        // If no file is provided, try to get the active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
          this.showError("No test file selected");
          return;
        }

        filePath = activeEditor.document.uri.fsPath;
      }

      // Verify it's a test file
      if (!this.isTestFile(filePath)) {
        this.showError(
          "Not a test file. Please select a test file (*.spec.ts, *.test.ts)"
        );
        return;
      }

      // Find the Nuxt project root
      const nuxtRoot = findNuxtRoot(filePath);
      if (!nuxtRoot) {
        this.showError("Could not find Nuxt project root");
        return;
      }

      // Check if Vitest is installed
      const vitestInstalled = await ensureVitestInstalled(nuxtRoot);
      if (!vitestInstalled) {
        this.showError("Vitest is required for debugging tests");
        return;
      }

      // Create or update launch configuration
      await this.createOrUpdateLaunchConfig(nuxtRoot, filePath);

      // Start debugging
      await vscode.debug.startDebugging(
        vscode.workspace.getWorkspaceFolder(vscode.Uri.file(nuxtRoot)),
        "Debug Vitest Test File"
      );

      this.showInfo(`Debugging file: ${path.basename(filePath)}`);
    } catch (error) {
      this.showError(`Failed to debug test file: ${error.message}`);
    }
  }

  private isTestFile(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return (
      fileName.endsWith(".spec.ts") ||
      fileName.endsWith(".test.ts") ||
      fileName.endsWith(".spec.js") ||
      fileName.endsWith(".test.js")
    );
  }

  private async createOrUpdateLaunchConfig(
    nuxtRoot: string,
    testFilePath: string
  ): Promise<void> {
    // Get the relative path from the project root
    const relativePath = path.relative(nuxtRoot, testFilePath);

    // Create the launch configuration
    const launchConfig = {
      type: "node",
      request: "launch",
      name: "Debug Vitest Test File",
      autoAttachChildProcesses: true,
      skipFiles: ["<node_internals>/**", "**/node_modules/**"],
      program: "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      args: ["run", relativePath, "--no-coverage"],
      console: "integratedTerminal",
      cwd: "${workspaceFolder}",
    };

    // Get the workspace folder
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(nuxtRoot)
    );
    if (!workspaceFolder) {
      throw new Error("Could not find workspace folder");
    }

    // Check if .vscode directory exists, create if not
    const vscodePath = path.join(nuxtRoot, ".vscode");
    if (!fs.existsSync(vscodePath)) {
      fs.mkdirSync(vscodePath);
    }

    // Check if launch.json exists
    const launchJsonPath = path.join(vscodePath, "launch.json");
    let launchJson: any = {
      version: "0.2.0",
      configurations: [],
    };

    if (fs.existsSync(launchJsonPath)) {
      try {
        launchJson = JSON.parse(fs.readFileSync(launchJsonPath, "utf8"));
        if (!launchJson.configurations) {
          launchJson.configurations = [];
        }
      } catch (error) {
        console.error("Error parsing launch.json:", error);
      }
    }

    // Check if the configuration already exists
    const existingConfigIndex = launchJson.configurations.findIndex(
      (config: any) => config.name === "Debug Vitest Test File"
    );

    if (existingConfigIndex >= 0) {
      // Update existing configuration
      launchJson.configurations[existingConfigIndex] = launchConfig;
    } else {
      // Add new configuration
      launchJson.configurations.push(launchConfig);
    }

    // Write the updated launch.json
    fs.writeFileSync(
      launchJsonPath,
      JSON.stringify(launchJson, null, 2),
      "utf8"
    );
  }
}
