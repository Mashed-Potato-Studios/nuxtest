import * as vscode from "vscode";
import { TestExplorerProvider } from "./providers/TestExplorerProvider";
import { TestResultsProvider } from "./providers/TestResultsProvider";
import { ActionsProvider } from "./providers/ActionsProvider";
import { CoverageProvider } from "./providers/CoverageProvider";
import { TestHistoryProvider } from "./providers/TestHistoryProvider";
import { CreateTestCommand } from "./commands/CreateTestCommand";
import { CreateUnitTestCommand } from "./commands/CreateUnitTestCommand";
import { CreateE2ETestCommand } from "./commands/CreateE2ETestCommand";
import { SetupTestEnvironmentCommand } from "./commands/SetupTestEnvironmentCommand";
import { GenerateTestForComponentCommand } from "./commands/GenerateTestForComponentCommand";
import { InstallPlaywrightBrowsersCommand } from "./commands/InstallPlaywrightBrowsersCommand";
import { FixE2ETestsCommand } from "./commands/FixE2ETestsCommand";
import { ClearTestCacheCommand } from "./commands/ClearTestCacheCommand";
import { ClearTestHistoryCommand } from "./commands/ClearTestHistoryCommand";
import { RunTestWithCoverageCommand } from "./commands/RunTestWithCoverageCommand";
import { RunAllTestsWithCoverageCommand } from "./commands/RunAllTestsWithCoverageCommand";
import { ShowCoverageCommand } from "./commands/ShowCoverageCommand";
import { DebugTestCommand } from "./commands/DebugTestCommand";
import { DebugTestFileCommand } from "./commands/DebugTestFileCommand";
import { DebugAllTestsCommand } from "./commands/DebugAllTestsCommand";
import { ShowComponentPreviewCommand } from "./commands/ShowComponentPreviewCommand";
import { UpdateComponentPreviewCommand } from "./commands/UpdateComponentPreviewCommand";
import {
  runNuxtTest,
  runNuxtTestFile,
  runAllNuxtTests,
  initializeTestResultsProvider,
} from "./testRunner";
import { checkNuxtTestingDependencies } from "./utils/dependencyChecker";
import { initializeStoragePath } from "./utils/testCache";
import { historyDatabase } from "./utils/historyDatabase";
import * as path from "path";
import * as fs from "fs";
import { TestOrganizationProvider } from "./providers/TestOrganizationProvider";
import { CreateTagCommand } from "./commands/CreateTagCommand";
import { CreateFilterPresetCommand } from "./commands/CreateFilterPresetCommand";
import { AddTagToTestCommand } from "./commands/AddTagToTestCommand";
import { TestOrganizationService } from "./services/TestOrganizationService";

let testExplorerProvider: TestExplorerProvider;
let testResultsProvider: TestResultsProvider;
let actionsProvider: ActionsProvider;
let coverageProvider: CoverageProvider;
let testHistoryProvider: TestHistoryProvider;
let testOrganizationProvider: TestOrganizationProvider;

export function activate(context: vscode.ExtensionContext) {
  // Initialize storage path for test cache
  initializeStoragePath(context);

  // Initialize history database
  historyDatabase.initialize(context);

  // Ensure Vue.js library is available for the component preview
  ensureVueLibrary(context);

  // Initialize providers
  testExplorerProvider = new TestExplorerProvider(context);
  testResultsProvider = new TestResultsProvider();
  actionsProvider = new ActionsProvider(context);
  coverageProvider = new CoverageProvider();
  testHistoryProvider = new TestHistoryProvider(context);
  testOrganizationProvider = new TestOrganizationProvider(context);

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
  vscode.window.registerTreeDataProvider(
    "nuxtest-test-history",
    testHistoryProvider
  );
  vscode.window.registerTreeDataProvider(
    "nuxtest-test-organization",
    testOrganizationProvider
  );

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
    }),

    // Debug commands
    vscode.commands.registerCommand(
      "nuxtest.debugTest",
      async (filePathOrItem: string | any, lineNumber?: number) => {
        new DebugTestCommand(context).execute(filePathOrItem, lineNumber);
      }
    ),

    vscode.commands.registerCommand(
      "nuxtest.debugTestFile",
      async (filePathOrItem: string | any) => {
        new DebugTestFileCommand(context).execute(filePathOrItem);
      }
    ),

    vscode.commands.registerCommand("nuxtest.debugAllTests", async () => {
      new DebugAllTestsCommand(context).execute();
    }),

    // Test History commands
    vscode.commands.registerCommand("nuxtest.refreshTestHistory", () => {
      testHistoryProvider.refresh();
    }),

    vscode.commands.registerCommand("nuxtest.clearTestHistory", () => {
      new ClearTestHistoryCommand(context).execute();
    }),

    // Component Preview commands
    vscode.commands.registerCommand(
      "nuxtest.showComponentPreview",
      (filePathOrUri?: string | vscode.Uri) => {
        new ShowComponentPreviewCommand(context).execute(filePathOrUri);
      }
    ),

    vscode.commands.registerCommand(
      "nuxtest.updateComponentPreview",
      (componentPath: string, state?: any) => {
        new UpdateComponentPreviewCommand(context).execute(
          componentPath,
          state
        );
      }
    ),

    // Test Organization commands
    vscode.commands.registerCommand("nuxtest.createTag", () => {
      new CreateTagCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.createFilterPreset", () => {
      new CreateFilterPresetCommand(context).execute();
    }),

    vscode.commands.registerCommand("nuxtest.addTagToTest", (test) => {
      new AddTagToTestCommand(context).execute(test);
    }),

    vscode.commands.registerCommand(
      "nuxtest.setTestFilter",
      (filterId: string) => {
        testOrganizationProvider.setFilter(filterId);
      }
    ),

    vscode.commands.registerCommand("nuxtest.filterByTag", (tagId: string) => {
      // Create a temporary filter for this tag
      const service = TestOrganizationService.getInstance(context);
      const tag = Array.from(service.getAllTags()).find((t) => t.id === tagId);
      if (tag) {
        // Check if a filter for this tag already exists
        const filterName = `Filter by ${tag.name}`;
        const filterId = filterName.toLowerCase().replace(/\s+/g, "-");
        const existingFilters = service.getAllFilters();
        const existingFilter = existingFilters.find((f) => f.id === filterId);

        if (existingFilter) {
          // Use the existing filter
          testOrganizationProvider.setFilter(existingFilter.id);
        } else {
          // Create a new filter
          const filter = service.createFilterPreset(filterName, {
            tagIds: [tagId],
          });
          testOrganizationProvider.setFilter(filter.id);
        }
      }
    }),

    vscode.commands.registerCommand(
      "nuxtest.setTestGroupBy",
      (groupBy: string) => {
        testOrganizationProvider.setGroupBy(groupBy as any);
      }
    ),

    vscode.commands.registerCommand("nuxtest.refreshTestOrganization", () => {
      testOrganizationProvider.refresh();
    })
  );

  // Show welcome message
  vscode.window.showInformationMessage("NuxTest extension is now active!");
}

/**
 * Ensure Vue.js library is available for the component preview
 */
function ensureVueLibrary(context: vscode.ExtensionContext): void {
  const mediaFolder = path.join(context.extensionPath, "media");
  const vueLibPath = path.join(mediaFolder, "vue.global.js");

  // Create media folder if it doesn't exist
  if (!fs.existsSync(mediaFolder)) {
    fs.mkdirSync(mediaFolder, { recursive: true });
  }

  // Check if Vue.js library already exists
  if (!fs.existsSync(vueLibPath)) {
    // Copy Vue.js library from node_modules or download it
    try {
      // Try to find Vue in node_modules
      const nodeModulesVuePath = path.join(
        context.extensionPath,
        "node_modules",
        "vue",
        "dist",
        "vue.global.js"
      );
      if (fs.existsSync(nodeModulesVuePath)) {
        fs.copyFileSync(nodeModulesVuePath, vueLibPath);
      } else {
        // If not found, create a placeholder that will show an error
        // In a real extension, you would download the file from a CDN
        const placeholderContent = `
          console.error('Vue.js library not found. Please download Vue.js and place it in the media folder.');
          window.Vue = { createApp: () => ({ mount: () => {} }) };
        `;
        fs.writeFileSync(vueLibPath, placeholderContent);

        // Show a warning to the user
        vscode.window.showWarningMessage(
          "Vue.js library not found. Component preview may not work correctly. Please download Vue.js and place it in the media folder."
        );
      }
    } catch (error) {
      console.error("Failed to copy Vue.js library:", error);
      vscode.window.showErrorMessage(
        "Failed to set up Vue.js for component preview"
      );
    }
  }
}

export function deactivate() {
  // Clean up resources if needed
}
