import * as vscode from "vscode";
import { TestExplorerProvider } from "./providers/TestExplorerProvider";
import { TestResultsProvider } from "./providers/TestResultsProvider";
import { ActionsProvider } from "./providers/ActionsProvider";
import { CoverageProvider } from "./providers/CoverageProvider";
import { CreateTestCommand } from "./commands/CreateTestCommand";
import { CreateUnitTestCommand } from "./commands/CreateUnitTestCommand";
import { CreateE2ETestCommand } from "./commands/CreateE2ETestCommand";
import { SetupTestEnvironmentCommand } from "./commands/SetupTestEnvironmentCommand";
import { GenerateTestForComponentCommand } from "./commands/GenerateTestForComponentCommand";
import { InstallPlaywrightBrowsersCommand } from "./commands/InstallPlaywrightBrowsersCommand";
import { FixE2ETestsCommand } from "./commands/FixE2ETestsCommand";
import { ClearTestCacheCommand } from "./commands/ClearTestCacheCommand";
import { RunTestWithCoverageCommand } from "./commands/RunTestWithCoverageCommand";
import { RunAllTestsWithCoverageCommand } from "./commands/RunAllTestsWithCoverageCommand";
import { ShowCoverageCommand } from "./commands/ShowCoverageCommand";
import {
  runNuxtTest,
  runNuxtTestFile,
  runAllNuxtTests,
  initializeTestResultsProvider,
} from "./testRunner";
import { checkNuxtTestingDependencies } from "./utils/dependencyChecker";

let testExplorerProvider: TestExplorerProvider;
let testResultsProvider: TestResultsProvider;
let actionsProvider: ActionsProvider;
let coverageProvider: CoverageProvider;

export function activate(context: vscode.ExtensionContext) {
  // Initialize providers
  testExplorerProvider = new TestExplorerProvider(context);
  testResultsProvider = new TestResultsProvider();
  actionsProvider = new ActionsProvider(context);
  coverageProvider = new CoverageProvider();

  // Initialize test runner with the results provider
  initializeTestResultsProvider(testResultsProvider);

  // Register views
  vscode.window.registerTreeDataProvider(
    "nuxtest-test-explorer",
    testExplorerProvider
  );
  vscode.window.registerTreeDataProvider(
    "nuxtest-test-results",
    testResultsProvider
  );
  vscode.window.registerTreeDataProvider("nuxtest-actions", actionsProvider);
  vscode.window.registerTreeDataProvider("nuxtest-coverage", coverageProvider);

  // Check for required dependencies
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    checkNuxtTestingDependencies(workspaceRoot);
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "nuxtest.runTest",
      async (filePathOrItem: string | any, lineNumber?: number) => {
        await runNuxtTest(filePathOrItem, lineNumber || 1);
      }
    ),

    vscode.commands.registerCommand(
      "nuxtest.runTestFile",
      async (filePathOrItem: string | any) => {
        await runNuxtTestFile(filePathOrItem);
      }
    ),

    vscode.commands.registerCommand("nuxtest.runAllTests", async () => {
      await runAllNuxtTests();
    }),

    vscode.commands.registerCommand("nuxtest.refreshTests", () => {
      testExplorerProvider.refresh();
    }),

    vscode.commands.registerCommand(
      "nuxtest.createTest",
      (uri?: vscode.Uri) => {
        new CreateTestCommand(context).execute(uri);
      }
    ),

    // New commands for the Actions view
    vscode.commands.registerCommand("nuxtest.createUnitTest", () => {
      new CreateUnitTestCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.createE2ETest", () => {
      new CreateE2ETestCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.setupTestEnvironment", () => {
      new SetupTestEnvironmentCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.generateTestForComponent", () => {
      new GenerateTestForComponentCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.installPlaywrightBrowsers", () => {
      new InstallPlaywrightBrowsersCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.fixE2ETests", () => {
      new FixE2ETestsCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.clearTestCache", () => {
      new ClearTestCacheCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.refreshActions", () => {
      actionsProvider.refresh();
    }),

    // Coverage commands
    vscode.commands.registerCommand(
      "nuxtest.runTestWithCoverage",
      (filePathOrUri?: string | vscode.Uri) => {
        new RunTestWithCoverageCommand(context).execute(filePathOrUri);
      }
    ),

    vscode.commands.registerCommand("nuxtest.runAllTestsWithCoverage", () => {
      new RunAllTestsWithCoverageCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.showCoverage", () => {
      new ShowCoverageCommand(context).execute();
    }),

    vscode.commands.registerCommand(
      "nuxtest.loadCoverageData",
      (coverageFilePath: string) => {
        return coverageProvider.loadCoverageData(coverageFilePath);
      }
    ),

    vscode.commands.registerCommand("nuxtest.clearCoverageData", () => {
      coverageProvider.clearCoverageData();
    })
  );

  // Show welcome message
  vscode.window.showInformationMessage("NuxTest extension is now active!");
}

export function deactivate() {
  // Clean up resources if needed
}
