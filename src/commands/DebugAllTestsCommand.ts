import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";
import { findNuxtRoot, ensureVitestInstalled } from "../utils/projectUtils";

export class DebugAllTestsCommand extends BaseCommand {
  async execute(): Promise<void> {
    try {
      // Get workspace root
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        this.showError("No workspace folder open");
        return;
      }

      // Find the Nuxt project root
      const nuxtRoot = findNuxtRoot(workspaceRoot) || workspaceRoot;

      // Check if Vitest is installed
      const vitestInstalled = await ensureVitestInstalled(nuxtRoot);
      if (!vitestInstalled) {
        this.showError("Vitest is required for debugging tests");
        return;
      }

      // Create or update launch configuration
      await this.createOrUpdateLaunchConfig(nuxtRoot);

      // Start debugging
      await vscode.debug.startDebugging(
        vscode.workspace.getWorkspaceFolder(vscode.Uri.file(nuxtRoot)),
        "Debug All Vitest Tests"
      );

      this.showInfo("Debugging all tests");
    } catch (error) {
      this.showError(`Failed to debug tests: ${error.message}`);
    }
  }

  private async createOrUpdateLaunchConfig(nuxtRoot: string): Promise<void> {
    // Create the launch configuration
    const launchConfig = {
      type: "node",
      request: "launch",
      name: "Debug All Vitest Tests",
      autoAttachChildProcesses: true,
      skipFiles: ["<node_internals>/**", "**/node_modules/**"],
      program: "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      args: ["run", "--no-coverage"],
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
      (config: any) => config.name === "Debug All Vitest Tests"
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
