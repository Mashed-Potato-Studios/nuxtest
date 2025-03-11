import * as vscode from "vscode";
import * as path from "path";

export class TestItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: "file" | "test",
    public readonly command?: vscode.Command,
    public readonly filePath?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = type;

    if (type === "file") {
      this.iconPath = new vscode.ThemeIcon("file-text");
    } else {
      this.iconPath = new vscode.ThemeIcon("beaker");
    }
  }
}

export class TestExplorerProvider implements vscode.TreeDataProvider<TestItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TestItem | undefined | null | void
  > = new vscode.EventEmitter<TestItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TestItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || "";
  }

  private workspaceRoot: string;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TestItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TestItem): Promise<TestItem[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([]);
    }

    if (!element) {
      return this.getTestFiles();
    }

    if (element.type === "file" && element.filePath) {
      return this.getTestsInFile(element.filePath);
    }

    return [];
  }

  private async getTestFiles(): Promise<TestItem[]> {
    const testFiles = await vscode.workspace.findFiles(
      "**/*.spec.{ts,js,vue}",
      "{**/node_modules/**,**/.nuxt/**,**/dist/**,**/.git/**,**/coverage/**}"
    );

    return testFiles.map((file) => {
      const relativePath = path.relative(this.workspaceRoot, file.fsPath);
      return new TestItem(
        relativePath,
        vscode.TreeItemCollapsibleState.Collapsed,
        "file",
        {
          command: "nuxtest.runTestFile",
          title: "Run Test File",
          arguments: [file.fsPath],
        },
        file.fsPath
      );
    });
  }

  private async getTestsInFile(filePath: string): Promise<TestItem[]> {
    try {
      const content = await vscode.workspace.fs.readFile(
        vscode.Uri.file(filePath)
      );
      const text = Buffer.from(content).toString("utf8");
      const tests: TestItem[] = [];
      const lines = text.split("\n");

      // Find describe blocks and their tests
      let currentDescribe = "";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for describe blocks
        const describeMatch = line.match(/describe\s*\(\s*['"](.+?)['"]/);
        if (describeMatch) {
          currentDescribe = describeMatch[1];
          continue;
        }

        // Check for test blocks (it or test)
        const testMatch = line.match(/(?:it|test)\s*\(\s*['"](.+?)['"]/);
        if (testMatch) {
          const testName = testMatch[1];
          const displayName = currentDescribe
            ? `${currentDescribe} > ${testName}`
            : testName;

          tests.push(
            new TestItem(
              displayName,
              vscode.TreeItemCollapsibleState.None,
              "test",
              {
                command: "nuxtest.runTest",
                title: "Run Test",
                arguments: [filePath, i + 1],
              },
              filePath
            )
          );
        }
      }

      return tests;
    } catch (error) {
      console.error("Error parsing test file:", error);
      return [];
    }
  }
}
