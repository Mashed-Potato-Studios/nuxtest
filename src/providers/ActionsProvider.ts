import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { CreateTestCommand } from "../commands/CreateTestCommand";

/**
 * Action item for the Actions view
 */
export class ActionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly command?: vscode.Command,
    public readonly iconPath?: string | vscode.ThemeIcon
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.command = command;
    this.iconPath = iconPath || new vscode.ThemeIcon("play");
    this.tooltip = description;
  }
}

/**
 * Provider for the Actions view in the sidebar
 */
export class ActionsProvider implements vscode.TreeDataProvider<ActionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ActionItem | undefined | null | void
  > = new vscode.EventEmitter<ActionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ActionItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ActionItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ActionItem): Thenable<ActionItem[]> {
    if (!element) {
      return Promise.resolve(this.getActions());
    }
    return Promise.resolve([]);
  }

  /**
   * Get all available actions
   */
  private getActions(): ActionItem[] {
    const actions: ActionItem[] = [];

    // Unit Test Creation
    actions.push(
      new ActionItem(
        "Create Unit Test",
        "Create a new component unit test",
        {
          command: "nuxtest.createUnitTest",
          title: "Create Unit Test",
          arguments: [],
        },
        new vscode.ThemeIcon("beaker")
      )
    );

    // E2E Test Creation
    actions.push(
      new ActionItem(
        "Create E2E Test",
        "Create a new end-to-end test",
        {
          command: "nuxtest.createE2ETest",
          title: "Create E2E Test",
          arguments: [],
        },
        new vscode.ThemeIcon("globe")
      )
    );

    // Setup Test Environment
    actions.push(
      new ActionItem(
        "Setup Test Environment",
        "Configure Nuxt testing environment",
        {
          command: "nuxtest.setupTestEnvironment",
          title: "Setup Test Environment",
          arguments: [],
        },
        new vscode.ThemeIcon("gear")
      )
    );

    // Generate Test for Component
    actions.push(
      new ActionItem(
        "Generate Test for Component",
        "Auto-generate test for existing component",
        {
          command: "nuxtest.generateTestForComponent",
          title: "Generate Test for Component",
          arguments: [],
        },
        new vscode.ThemeIcon("wand")
      )
    );

    // Install Playwright Browsers
    actions.push(
      new ActionItem(
        "Install Playwright Browsers",
        "Install browsers required for E2E testing",
        {
          command: "nuxtest.installPlaywrightBrowsers",
          title: "Install Playwright Browsers",
          arguments: [],
        },
        new vscode.ThemeIcon("browser")
      )
    );

    // Fix E2E Tests
    actions.push(
      new ActionItem(
        "Fix E2E Tests",
        "Fix common issues in E2E tests",
        {
          command: "nuxtest.fixE2ETests",
          title: "Fix E2E Tests",
          arguments: [],
        },
        new vscode.ThemeIcon("wrench")
      )
    );

    // Clear Test Cache
    actions.push(
      new ActionItem(
        "Clear Test Cache",
        "Clear cached test results",
        {
          command: "nuxtest.clearTestCache",
          title: "Clear Test Cache",
          arguments: [],
        },
        new vscode.ThemeIcon("clear-all")
      )
    );

    // Run All Tests with Coverage
    actions.push(
      new ActionItem(
        "Run All Tests with Coverage",
        "Run all tests and generate coverage report",
        {
          command: "nuxtest.runAllTestsWithCoverage",
          title: "Run All Tests with Coverage",
          arguments: [],
        },
        new vscode.ThemeIcon("graph")
      )
    );

    // Show Coverage
    actions.push(
      new ActionItem(
        "Show Coverage",
        "Show test coverage report",
        {
          command: "nuxtest.showCoverage",
          title: "Show Coverage",
          arguments: [],
        },
        new vscode.ThemeIcon("graph")
      )
    );

    return actions;
  }
}
