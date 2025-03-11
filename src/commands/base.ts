import * as vscode from "vscode";

export abstract class BaseCommand {
  constructor(protected context: vscode.ExtensionContext) {}

  abstract execute(...args: any[]): Promise<void>;

  protected showError(message: string): void {
    vscode.window.showErrorMessage(`NuxTest: ${message}`);
  }

  protected showInfo(message: string): void {
    vscode.window.showInformationMessage(`NuxTest: ${message}`);
  }

  protected async showProgress<T>(
    title: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>
    ) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `NuxTest: ${title}`,
        cancellable: false,
      },
      task
    );
  }
}
