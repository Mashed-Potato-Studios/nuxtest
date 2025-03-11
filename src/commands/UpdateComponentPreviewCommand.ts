import * as vscode from "vscode";
import * as fs from "fs";
import { ComponentPreviewPanel } from "../panels/ComponentPreviewPanel";

/**
 * Command to update the preview of a Vue component
 */
export class UpdateComponentPreviewCommand {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Execute the command to update a component preview
   * @param componentPath The file path of the component to update
   * @param state Optional state to pass to the component
   */
  public async execute(componentPath: string, state?: any): Promise<void> {
    try {
      // Check if the panel exists
      if (!ComponentPreviewPanel.currentPanel) {
        vscode.window.showErrorMessage("No component preview panel is open");
        return;
      }

      // Check if the file exists
      if (!fs.existsSync(componentPath)) {
        vscode.window.showErrorMessage(
          `Component file not found: ${componentPath}`
        );
        return;
      }

      // Read the component file content
      const componentContent = fs.readFileSync(componentPath, "utf8");

      // Update the preview with the component content and state
      ComponentPreviewPanel.currentPanel.update(
        componentPath,
        componentContent,
        state
      );
    } catch (error) {
      console.error("Error updating component preview:", error);
      vscode.window.showErrorMessage(
        `Failed to update component preview: ${error}`
      );
    }
  }
}
