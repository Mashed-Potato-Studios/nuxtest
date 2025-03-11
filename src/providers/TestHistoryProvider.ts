import * as vscode from "vscode";
import * as path from "path";
import {
  historyDatabase,
  TestResult,
  TestTrend,
} from "../utils/historyDatabase";

export class TestHistoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly result?: TestResult,
    public readonly trend?: TestTrend,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);

    // Set icon based on test status or trend
    if (result) {
      if (result.status === "pass") {
        this.iconPath = new vscode.ThemeIcon(
          "pass-filled",
          new vscode.ThemeColor("testing.iconPassed")
        );
      } else if (result.status === "fail") {
        this.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("testing.iconFailed")
        );
      } else {
        this.iconPath = new vscode.ThemeIcon(
          "circle-slash",
          new vscode.ThemeColor("testing.iconSkipped")
        );
      }

      // Format timestamp
      const date = new Date(result.timestamp);
      this.description = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (${
        result.duration
      }ms)`;
    } else if (trend) {
      if (trend.flaky) {
        this.iconPath = new vscode.ThemeIcon(
          "warning",
          new vscode.ThemeColor("testing.iconUnset")
        );
        this.description = `Flaky (${Math.round(
          trend.passRate * 100
        )}% pass rate, ${trend.totalRuns} runs)`;
      } else if (trend.passRate === 1) {
        this.iconPath = new vscode.ThemeIcon(
          "pass",
          new vscode.ThemeColor("testing.iconPassed")
        );
        this.description = `Stable (100% pass rate, ${trend.totalRuns} runs)`;
      } else if (trend.passRate >= 0.8) {
        this.iconPath = new vscode.ThemeIcon(
          "pass",
          new vscode.ThemeColor("testing.iconPassed")
        );
        this.description = `Mostly stable (${Math.round(
          trend.passRate * 100
        )}% pass rate, ${trend.totalRuns} runs)`;
      } else {
        this.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("testing.iconFailed")
        );
        this.description = `Unstable (${Math.round(
          trend.passRate * 100
        )}% pass rate, ${trend.totalRuns} runs)`;
      }
    }
  }
}

export class TestHistoryProvider
  implements vscode.TreeDataProvider<TestHistoryItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TestHistoryItem | undefined | null | void
  > = new vscode.EventEmitter<TestHistoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TestHistoryItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {
    // Initialize the history database
    historyDatabase.initialize(context);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TestHistoryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TestHistoryItem): Promise<TestHistoryItem[]> {
    if (!element) {
      // Root level - show categories
      return [
        new TestHistoryItem(
          "Trends",
          vscode.TreeItemCollapsibleState.Expanded,
          "trends"
        ),
        new TestHistoryItem(
          "Recent Test Runs",
          vscode.TreeItemCollapsibleState.Expanded,
          "history"
        ),
      ];
    } else if (element.contextValue === "trends") {
      // Trends level - show test trends
      const trends = historyDatabase.getTestTrends();

      if (trends.length === 0) {
        return [
          new TestHistoryItem(
            "No trend data available yet",
            vscode.TreeItemCollapsibleState.None,
            "message"
          ),
        ];
      }

      return trends.map((trend) => {
        const fileName = path.basename(trend.filePath);
        const label = `${trend.testName} (${fileName})`;

        return new TestHistoryItem(
          label,
          vscode.TreeItemCollapsibleState.Collapsed,
          "trend",
          undefined,
          trend,
          {
            command: "vscode.open",
            title: "Open Test File",
            arguments: [vscode.Uri.file(trend.filePath)],
          }
        );
      });
    } else if (element.contextValue === "history") {
      // History level - show recent test runs grouped by file
      const history = historyDatabase.getTestHistory();

      if (history.length === 0) {
        return [
          new TestHistoryItem(
            "No test history available yet",
            vscode.TreeItemCollapsibleState.None,
            "message"
          ),
        ];
      }

      // Group by file path
      const fileGroups: { [key: string]: TestResult[] } = {};
      for (const result of history) {
        if (!fileGroups[result.filePath]) {
          fileGroups[result.filePath] = [];
        }
        fileGroups[result.filePath].push(result);
      }

      // Create items for each file
      return Object.keys(fileGroups).map((filePath) => {
        const fileName = path.basename(filePath);
        const results = fileGroups[filePath];
        const passCount = results.filter((r) => r.status === "pass").length;
        const failCount = results.filter((r) => r.status === "fail").length;

        return new TestHistoryItem(
          fileName,
          vscode.TreeItemCollapsibleState.Collapsed,
          "file",
          undefined,
          undefined,
          {
            command: "vscode.open",
            title: "Open Test File",
            arguments: [vscode.Uri.file(filePath)],
          }
        );
      });
    } else if (element.contextValue === "file") {
      // File level - show test runs for this file
      const filePath = element.command?.arguments?.[0].fsPath;
      if (!filePath) {
        return [];
      }

      const history = historyDatabase.getTestHistory(filePath);

      // Group by test name
      const testGroups: { [key: string]: TestResult[] } = {};
      for (const result of history) {
        if (!testGroups[result.testName]) {
          testGroups[result.testName] = [];
        }
        testGroups[result.testName].push(result);
      }

      // Create items for each test
      return Object.keys(testGroups).map((testName) => {
        const results = testGroups[testName];
        const latestResult = results[0]; // Already sorted by timestamp (newest first)

        return new TestHistoryItem(
          testName,
          vscode.TreeItemCollapsibleState.Collapsed,
          "test",
          latestResult
        );
      });
    } else if (element.contextValue === "test") {
      // Test level - show all runs for this test
      const testName = element.label;
      const filePath = element.result?.filePath;

      if (!testName || !filePath) {
        return [];
      }

      const history = historyDatabase.getTestHistory(
        filePath,
        testName as string
      );

      return history.map((result) => {
        const date = new Date(result.timestamp);
        const label = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        return new TestHistoryItem(
          label,
          vscode.TreeItemCollapsibleState.None,
          "run",
          result
        );
      });
    } else if (element.contextValue === "trend" && element.trend) {
      // Trend level - show history for this test
      const testName = element.trend.testName;
      const filePath = element.trend.filePath;

      const history = historyDatabase.getTestHistory(filePath, testName);

      return history.map((result) => {
        const date = new Date(result.timestamp);
        const label = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        return new TestHistoryItem(
          label,
          vscode.TreeItemCollapsibleState.None,
          "run",
          result
        );
      });
    }

    return [];
  }
}
