import * as vscode from "vscode";
import { BaseCommand } from "./base";
import { historyDatabase } from "../utils/historyDatabase";

export class ClearTestHistoryCommand extends BaseCommand {
  async execute(): Promise<void> {
    try {
      // Ask for confirmation
      const confirmation = await vscode.window.showWarningMessage(
        "Are you sure you want to clear all test history data?",
        "Yes",
        "No"
      );

      if (confirmation !== "Yes") {
        return;
      }

      // Clear the history
      historyDatabase.clearHistory();

      // Refresh the test history view
      vscode.commands.executeCommand("nuxtest.refreshTestHistory");

      this.showInfo("Test history cleared successfully");
    } catch (error: any) {
      this.showError(`Failed to clear test history: ${error.message}`);
    }
  }
}
