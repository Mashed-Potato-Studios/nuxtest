import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ComponentPreviewPanel } from "../panels/ComponentPreviewPanel";

/**
 * Command to show a preview of a Vue component
 */
export class ShowComponentPreviewCommand {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Execute the command to show a component preview
   * @param filePathOrUri The file path or URI of the component to preview
   */
  public async execute(filePathOrUri?: string | vscode.Uri): Promise<void> {
    try {
      // Get the component file path
      const componentPath = await this.getComponentPath(filePathOrUri);
      if (!componentPath) {
        vscode.window.showErrorMessage(
          "No Vue component file found to preview"
        );
        return;
      }

      // Check if the file exists and is a Vue component
      if (
        !fs.existsSync(componentPath) ||
        path.extname(componentPath) !== ".vue"
      ) {
        vscode.window.showErrorMessage(
          `${componentPath} is not a valid Vue component file`
        );
        return;
      }

      // Show the component preview panel
      ComponentPreviewPanel.createOrShow(this.context, componentPath);

      // Read the component file content
      const componentContent = fs.readFileSync(componentPath, "utf8");

      // Update the preview with the component content
      ComponentPreviewPanel.currentPanel?.update(
        componentPath,
        componentContent
      );

      vscode.window.showInformationMessage(
        `Previewing component: ${path.basename(componentPath)}`
      );
    } catch (error) {
      console.error("Error showing component preview:", error);
      vscode.window.showErrorMessage(
        `Failed to show component preview: ${error}`
      );
    }
  }

  /**
   * Get the component file path from the provided URI or the active editor
   * @param filePathOrUri The file path or URI of the component
   * @returns The absolute path to the component file
   */
  private async getComponentPath(
    filePathOrUri?: string | vscode.Uri
  ): Promise<string | undefined> {
    // If a file path or URI is provided, use it
    if (filePathOrUri) {
      if (typeof filePathOrUri === "string") {
        return filePathOrUri;
      } else {
        return filePathOrUri.fsPath;
      }
    }

    // Otherwise, use the active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === "vue") {
      return activeEditor.document.uri.fsPath;
    }

    // If no active editor with a Vue file, prompt the user to select a Vue file
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder found");
      return undefined;
    }

    // Find Vue component files in the workspace
    const vueFiles = await vscode.workspace.findFiles(
      "**/*.vue",
      "**/node_modules/**"
    );
    if (vueFiles.length === 0) {
      vscode.window.showErrorMessage(
        "No Vue component files found in the workspace"
      );
      return undefined;
    }

    // Ask the user to select a Vue file
    const items = vueFiles.map((uri) => ({
      label: path.basename(uri.fsPath),
      description: vscode.workspace.asRelativePath(uri),
      uri,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a Vue component to preview",
    });

    return selected?.uri.fsPath;
  }
}
