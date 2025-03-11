import * as vscode from "vscode";
import { BaseCommand } from "./base";

export class InstallPlaywrightBrowsersCommand extends BaseCommand {
  async execute(): Promise<void> {
    try {
      // Ask which browsers to install
      const browserOptions = [
        { label: "Chromium only (recommended)", value: "chromium" },
        { label: "All browsers (Chrome, Firefox, WebKit)", value: "all" },
        { label: "Custom selection", value: "custom" },
      ];

      const selectedOption = await vscode.window.showQuickPick(browserOptions, {
        placeHolder: "Select which Playwright browsers to install",
      });

      if (!selectedOption) {
        return;
      }

      let installCommand = "";

      if (selectedOption.value === "chromium") {
        installCommand = "npx playwright install chromium";
      } else if (selectedOption.value === "all") {
        installCommand = "npx playwright install";
      } else if (selectedOption.value === "custom") {
        const browsers = await vscode.window.showQuickPick(
          [
            { label: "Chromium", picked: true },
            { label: "Firefox" },
            { label: "WebKit" },
          ],
          {
            placeHolder: "Select browsers to install",
            canPickMany: true,
          }
        );

        if (!browsers || browsers.length === 0) {
          return;
        }

        const browserList = browsers
          .map((b) => b.label.toLowerCase())
          .join(" ");
        installCommand = `npx playwright install ${browserList}`;
      }

      if (installCommand) {
        const terminal = vscode.window.createTerminal(
          "NuxTest Playwright Setup"
        );
        terminal.show();
        terminal.sendText(installCommand);

        this.showInfo(
          "Installing Playwright browsers. This may take a few minutes."
        );
      }
    } catch (error) {
      this.showError(`Failed to install Playwright browsers: ${error.message}`);
    }
  }
}
