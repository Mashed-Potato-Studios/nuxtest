import * as vscode from "vscode";
import * as path from "path";

export interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped" | "running";
  duration?: number;
  message?: string;
  filePath: string;
  lineNumber?: number;
}

export class TestResultItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly result?: TestResult
  ) {
    super(label, collapsibleState);

    if (result) {
      // Set icon based on test status
      switch (result.status) {
        case "passed":
          this.iconPath = new vscode.ThemeIcon(
            "pass",
            new vscode.ThemeColor("testing.iconPassed")
          );
          break;
        case "failed":
          this.iconPath = new vscode.ThemeIcon(
            "error",
            new vscode.ThemeColor("testing.iconFailed")
          );
          break;
        case "skipped":
          this.iconPath = new vscode.ThemeIcon(
            "debug-step-over",
            new vscode.ThemeColor("testing.iconSkipped")
          );
          break;
        case "running":
          this.iconPath = new vscode.ThemeIcon(
            "loading~spin",
            new vscode.ThemeColor("testing.iconQueued")
          );
          break;
      }

      // Add description with duration if available
      if (result.duration) {
        this.description = `${result.duration}ms`;
      }

      // Add tooltip with error message if available
      if (result.message) {
        this.tooltip = result.message;
      }

      // Add command to navigate to test
      if (result.filePath && result.lineNumber) {
        this.command = {
          command: "vscode.open",
          title: "Go to Test",
          arguments: [
            vscode.Uri.file(result.filePath),
            {
              selection: new vscode.Range(
                result.lineNumber - 1,
                0,
                result.lineNumber - 1,
                0
              ),
            },
          ],
        };
      }
    }
  }
}

export class TestResultsProvider
  implements vscode.TreeDataProvider<TestResultItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TestResultItem | undefined | null | void
  > = new vscode.EventEmitter<TestResultItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TestResultItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private results: TestResult[] = [];
  private summary: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  } = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  };

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TestResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TestResultItem): Thenable<TestResultItem[]> {
    if (!element) {
      // Root level - show summary and results
      const items: TestResultItem[] = [];

      // Add summary item with clear success/failure indication
      const summaryLabel = this.getSummaryLabel();
      const summaryItem = new TestResultItem(
        summaryLabel,
        vscode.TreeItemCollapsibleState.None
      );

      if (this.summary.failed > 0) {
        summaryItem.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("testing.iconFailed")
        );
      } else if (this.summary.passed > 0) {
        summaryItem.iconPath = new vscode.ThemeIcon(
          "pass",
          new vscode.ThemeColor("testing.iconPassed")
        );
      }

      items.push(summaryItem);

      // Group results by file
      const fileGroups = this.groupResultsByFile();

      for (const [filePath, fileResults] of Object.entries(fileGroups)) {
        const fileName = path.basename(filePath);
        const fileItem = new TestResultItem(
          fileName,
          vscode.TreeItemCollapsibleState.Expanded
        );
        fileItem.contextValue = "file";
        fileItem.iconPath = new vscode.ThemeIcon("file-text");

        // Add status indicator to file name
        const passedCount = fileResults.filter(
          (r) => r.status === "passed"
        ).length;
        const totalCount = fileResults.length;
        fileItem.description = `${passedCount}/${totalCount} passed`;

        if (passedCount === totalCount) {
          fileItem.iconPath = new vscode.ThemeIcon(
            "check",
            new vscode.ThemeColor("testing.iconPassed")
          );
        } else {
          fileItem.iconPath = new vscode.ThemeIcon(
            "warning",
            new vscode.ThemeColor("testing.iconFailed")
          );
        }

        items.push(fileItem);

        // Add test results
        for (const result of fileResults) {
          const resultItem = new TestResultItem(
            result.name,
            vscode.TreeItemCollapsibleState.None,
            result
          );
          items.push(resultItem);
        }
      }

      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }

  addResult(result: TestResult): void {
    this.results.push(result);
    this.updateSummary();
    this.refresh();
  }

  addResults(results: TestResult[]): void {
    this.results.push(...results);
    this.updateSummary();
    this.refresh();
  }

  clearResults(): void {
    this.results = [];
    this.summary = { passed: 0, failed: 0, skipped: 0, total: 0 };
    this.refresh();
  }

  private updateSummary(): void {
    this.summary = {
      passed: this.results.filter((r) => r.status === "passed").length,
      failed: this.results.filter((r) => r.status === "failed").length,
      skipped: this.results.filter((r) => r.status === "skipped").length,
      total: this.results.length,
    };
  }

  private groupResultsByFile(): Record<string, TestResult[]> {
    const groups: Record<string, TestResult[]> = {};

    for (const result of this.results) {
      if (!groups[result.filePath]) {
        groups[result.filePath] = [];
      }

      groups[result.filePath].push(result);
    }

    return groups;
  }

  /**
   * Get a formatted summary label with clear success/failure indication
   */
  private getSummaryLabel(): string {
    if (this.summary.total === 0) {
      return "No tests run";
    }

    const allPassed = this.summary.passed === this.summary.total;
    const prefix = allPassed ? "✅ SUCCESS: " : "❌ FAILED: ";

    return `${prefix}${this.summary.passed} passed, ${this.summary.failed} failed, ${this.summary.skipped} skipped (${this.summary.total} total)`;
  }
}
