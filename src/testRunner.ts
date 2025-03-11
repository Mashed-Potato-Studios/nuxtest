import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { execa } from "execa";
import {
  TestResultsProvider,
  TestResult,
} from "./providers/TestResultsProvider";
import { checkNuxtTestingDependencies } from "./utils/dependencyChecker";
import * as testCache from "./utils/testCache";
import { historyDatabase } from "./utils/historyDatabase";

// Global cache object
let globalTestCache = testCache.loadCache();

// Output channel for test results
let outputChannel: vscode.OutputChannel;

// Get or create the output channel
function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("NuxTest");
  }
  return outputChannel;
}

// Global test results provider
let testResultsProvider: TestResultsProvider;

// Initialize the test results provider
export function initializeTestResultsProvider(
  provider: TestResultsProvider
): void {
  testResultsProvider = provider;
}

/**
 * Find the Nuxt project root directory
 */
function findNuxtRoot(filePath: string): string | undefined {
  if (!filePath) {
    return undefined;
  }

  let currentDir = path.dirname(filePath);
  const maxDepth = 10; // Prevent infinite loop
  let depth = 0;

  while (currentDir && depth < maxDepth) {
    // Check for common Nuxt project indicators
    const hasNuxtConfig =
      fs.existsSync(path.join(currentDir, "nuxt.config.js")) ||
      fs.existsSync(path.join(currentDir, "nuxt.config.ts"));
    const hasPackageJson = fs.existsSync(path.join(currentDir, "package.json"));

    if (hasNuxtConfig) {
      return currentDir;
    }

    if (hasPackageJson) {
      try {
        const packageJsonPath = path.join(currentDir, "package.json");
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8")
        );

        // Check if it's a Nuxt project by looking for Nuxt dependencies
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
        if (
          dependencies.nuxt ||
          dependencies["@nuxt/core"] ||
          dependencies["@nuxt/kit"]
        ) {
          return currentDir;
        }
      } catch (error) {
        // Ignore errors reading package.json
      }
    }

    // Go up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // We've reached the root
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  // If we couldn't find a Nuxt root, return the workspace root
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

// Extract the test name at the given line
function findTestNameAtLine(
  filePath: string,
  lineNumber: number
): string | undefined {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const lines = fileContent.split("\n");

    // Starting from the current line, search upwards for a test or describe declaration
    for (let i = lineNumber; i >= 0; i--) {
      const line = lines[i];
      const testMatch = line.match(/(?:test|it)\s*\(\s*['"](.+?)['"]/);
      const describeMatch = line.match(/describe\s*\(\s*['"](.+?)['"]/);

      if (testMatch) {
        return testMatch[1];
      } else if (describeMatch) {
        return describeMatch[1];
      }
    }
  } catch (err) {
    console.error("Error reading test file:", err);
  }

  return undefined;
}

// After running a test and getting the results, add this code to save to history
async function saveTestResultsToHistory(
  results: any[],
  filePath: string
): Promise<void> {
  try {
    // Map the test results to our history format
    const historyResults = results.map((result) => ({
      testName: result.name || "Unknown Test",
      filePath,
      status: (result.status === "passed"
        ? "pass"
        : result.status === "skipped"
        ? "skip"
        : "fail") as "pass" | "skip" | "fail",
      duration: result.duration || 0,
      errorMessage: result.error?.message,
    }));

    // Save to history database
    await historyDatabase.saveTestResults(historyResults);

    // Refresh the test history view
    vscode.commands.executeCommand("nuxtest.refreshTestHistory");
  } catch (error: any) {
    console.error("Failed to save test results to history:", error);
  }
}

/**
 * Run a Nuxt test at a specific line
 */
export async function runNuxtTest(
  filePathOrItem: string | any,
  lineNumber?: number
): Promise<void> {
  try {
    // Handle TestItem objects
    let filePath: string;
    let testLineNumber: number = lineNumber || 1;
    let testName: string | undefined;

    if (typeof filePathOrItem === "string") {
      filePath = filePathOrItem;
    } else if (filePathOrItem && filePathOrItem.uri) {
      // Handle VS Code TestItem
      filePath = filePathOrItem.uri.fsPath;

      // If the item has a range, use its start line
      if (filePathOrItem.range) {
        testLineNumber = filePathOrItem.range.start.line + 1; // Convert to 1-based line number
      }

      // If the item has a label, use it as the test name
      if (filePathOrItem.label) {
        testName = filePathOrItem.label;
      }
    } else if (filePathOrItem && filePathOrItem.filePath) {
      // Handle our own test item format
      filePath = filePathOrItem.filePath;
      testLineNumber = filePathOrItem.lineNumber || testLineNumber;
      testName = filePathOrItem.name;
    } else {
      throw new Error(
        "Invalid test item. Expected a file path or a test item object."
      );
    }

    const nuxtRoot = findNuxtRoot(filePath);
    if (!nuxtRoot) {
      vscode.window.showErrorMessage(
        "Could not find Nuxt project root. Make sure you have a nuxt.config.js or nuxt.config.ts file in your project."
      );
      return;
    }

    // Check if dependencies are installed
    const dependenciesInstalled = await checkNuxtTestingDependencies(nuxtRoot);
    if (!dependenciesInstalled) {
      return;
    }

    // Find the test name at the specified line if not already provided
    if (!testName) {
      testName = findTestNameAtLine(filePath, testLineNumber);
      if (!testName) {
        vscode.window.showErrorMessage(
          "Could not find a test at the specified line."
        );
        return;
      }
    }

    // Check if we can use cached results
    const shouldRun = testCache.shouldRunTest(filePath, globalTestCache);
    if (!shouldRun) {
      const cachedResults = testCache.getCachedResults(
        filePath,
        globalTestCache
      );
      if (cachedResults) {
        // Filter results for the specific test
        const testResults = cachedResults.filter(
          (result) => result.name === testName
        );
        if (testResults.length > 0) {
          // Show notification that we're using cached results
          vscode.window.showInformationMessage(
            `Using cached results for test: ${testName}`
          );

          // Update the test results view
          testResultsProvider.addResults(testResults);

          // Show the results in the output channel
          const outputChannel = getOutputChannel();
          outputChannel.appendLine(
            `\n[NuxTest] Using cached results for test: ${testName}`
          );
          outputChannel.appendLine(`Status: ${testResults[0].status}`);
          if (testResults[0].message) {
            outputChannel.appendLine(`Message: ${testResults[0].message}`);
          }
          if (testResults[0].duration) {
            outputChannel.appendLine(`Duration: ${testResults[0].duration}ms`);
          }

          // After getting test results, add:
          if (testResults && testResults.length > 0) {
            await saveTestResultsToHistory(testResults, filePath);
          }

          return;
        }
      }
    }

    // Clear previous results
    testResultsProvider.clearResults();

    // Show status bar message
    const statusBarMessage = vscode.window.setStatusBarMessage(
      `$(testing-run-icon) Running test: ${testName}...`
    );

    // Get the relative path for display
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const relativePath = workspaceFolders
      ? path.relative(workspaceFolders[0].uri.fsPath, filePath)
      : path.basename(filePath);

    // Show notification
    vscode.window.showInformationMessage(`Running test: ${testName}`);

    // Get the output channel
    const outputChannel = getOutputChannel();
    outputChannel.clear();
    outputChannel.appendLine(`Running test: ${testName} in ${relativePath}`);
    outputChannel.show(true);

    // Add running status to the test results view
    testResultsProvider.addResult({
      name: testName,
      status: "running",
      filePath,
      lineNumber: testLineNumber,
    });

    // Run the test
    const command = "npx";
    const args = [
      "vitest",
      "run",
      filePath,
      "-t",
      testName,
      "--reporter=verbose",
    ];

    outputChannel.appendLine(`> ${command} ${args.join(" ")}`);

    // Execute the test
    const { stdout, stderr, exitCode } = await execa(command, args, {
      cwd: nuxtRoot,
      reject: false,
    });

    // Clear status bar message
    statusBarMessage.dispose();

    // Process the output
    if (exitCode === 0) {
      // Test passed
      const duration = getDurationFromOutput(stdout);
      const result: TestResult = {
        name: testName,
        status: "passed",
        duration,
        filePath,
        lineNumber: testLineNumber,
      };

      // Update test results view
      testResultsProvider.clearResults();
      testResultsProvider.addResult(result);

      // Show success message
      vscode.window.setStatusBarMessage(
        `$(testing-passed-icon) Test passed: ${testName}`,
        5000
      );

      // Update the cache
      globalTestCache = testCache.updateCache(
        filePath,
        [result],
        globalTestCache
      );

      // Show output
      outputChannel.appendLine("\nTest passed! 🎉");
      outputChannel.appendLine(stdout);

      // After getting test results, add:
      if (result) {
        await saveTestResultsToHistory([result], filePath);
      }
    } else {
      // Test failed
      const filteredStderr = filterNuxtWarnings(stderr);
      const result: TestResult = {
        name: testName,
        status: "failed",
        message: filteredStderr || stdout,
        filePath,
        lineNumber: testLineNumber,
      };

      // Update test results view
      testResultsProvider.clearResults();
      testResultsProvider.addResult(result);

      // Show error message
      vscode.window.setStatusBarMessage(
        `$(testing-failed-icon) Test failed: ${testName}`,
        5000
      );

      // Update the cache
      globalTestCache = testCache.updateCache(
        filePath,
        [result],
        globalTestCache
      );

      // Show output
      outputChannel.appendLine("\nTest failed! ❌");
      outputChannel.appendLine(stdout);
      if (filteredStderr) {
        outputChannel.appendLine("\nErrors:");
        outputChannel.appendLine(filteredStderr);
      }

      // After getting test results, add:
      if (result) {
        await saveTestResultsToHistory([result], filePath);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run test: ${error.message}`);
    getOutputChannel().appendLine(`Error: ${error.message}`);
  }
}

/**
 * Run all tests in a Nuxt test file
 */
export async function runNuxtTestFile(
  filePathOrItem: string | any
): Promise<void> {
  try {
    // Handle TestItem objects
    let filePath: string;

    if (typeof filePathOrItem === "string") {
      filePath = filePathOrItem;
    } else if (filePathOrItem && filePathOrItem.uri) {
      // Handle VS Code TestItem
      filePath = filePathOrItem.uri.fsPath;
    } else if (filePathOrItem && filePathOrItem.filePath) {
      // Handle our own test item format
      filePath = filePathOrItem.filePath;
    } else {
      throw new Error(
        "Invalid test item. Expected a file path or a test item object."
      );
    }

    const nuxtRoot = findNuxtRoot(filePath);
    if (!nuxtRoot) {
      vscode.window.showErrorMessage(
        "Could not find Nuxt project root. Make sure you have a nuxt.config.js or nuxt.config.ts file in your project."
      );
      return;
    }

    // Check if dependencies are installed
    const dependenciesInstalled = await checkNuxtTestingDependencies(nuxtRoot);
    if (!dependenciesInstalled) {
      return;
    }

    // Check if we can use cached results
    const shouldRun = testCache.shouldRunTest(filePath, globalTestCache);
    if (!shouldRun) {
      const cachedResults = testCache.getCachedResults(
        filePath,
        globalTestCache
      );
      if (cachedResults && cachedResults.length > 0) {
        // Show notification that we're using cached results
        vscode.window.showInformationMessage(
          `Using cached results for file: ${path.basename(filePath)}`
        );

        // Update the test results view
        testResultsProvider.addResults(cachedResults);

        // Show the results in the output channel
        const outputChannel = getOutputChannel();
        outputChannel.appendLine(
          `\n[NuxTest] Using cached results for file: ${path.basename(
            filePath
          )}`
        );
        outputChannel.appendLine(`Total tests: ${cachedResults.length}`);
        outputChannel.appendLine(
          `Passed: ${cachedResults.filter((r) => r.status === "passed").length}`
        );
        outputChannel.appendLine(
          `Failed: ${cachedResults.filter((r) => r.status === "failed").length}`
        );

        // After getting test results, add:
        if (cachedResults && cachedResults.length > 0) {
          await saveTestResultsToHistory(cachedResults, filePath);
        }

        return;
      }
    }

    // Clear previous results
    testResultsProvider.clearResults();

    // Show status bar message
    const statusBarMessage = vscode.window.setStatusBarMessage(
      `$(testing-run-icon) Running tests in ${path.basename(filePath)}...`
    );

    // Get the relative path for display
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const relativePath = workspaceFolders
      ? path.relative(workspaceFolders[0].uri.fsPath, filePath)
      : path.basename(filePath);

    // Show notification
    vscode.window.showInformationMessage(
      `Running tests in ${path.basename(filePath)}`
    );

    // Get the output channel
    const outputChannel = getOutputChannel();
    outputChannel.clear();
    outputChannel.appendLine(`Running tests in ${relativePath}`);
    outputChannel.show(true);

    // Run the test
    const command = "npx";
    const args = ["vitest", "run", filePath, "--reporter=verbose"];

    outputChannel.appendLine(`> ${command} ${args.join(" ")}`);

    // Execute the test
    const { stdout, stderr, exitCode } = await execa(command, args, {
      cwd: nuxtRoot,
      reject: false,
    });

    // Clear status bar message
    statusBarMessage.dispose();

    // Parse test results
    const results = parseTestResults(stdout, filePath);

    // Update test results view
    testResultsProvider.clearResults();
    testResultsProvider.addResults(results);

    // Update the cache
    globalTestCache = testCache.updateCache(filePath, results, globalTestCache);

    if (exitCode === 0) {
      // All tests passed
      vscode.window.setStatusBarMessage(
        `$(testing-passed-icon) All tests passed in ${path.basename(filePath)}`,
        5000
      );

      // Show output
      outputChannel.appendLine("\nAll tests passed! 🎉");
      outputChannel.appendLine(stdout);

      // After getting test results, add:
      if (results && results.length > 0) {
        await saveTestResultsToHistory(results, filePath);
      }
    } else {
      // Some tests failed
      const filteredStderr = filterNuxtWarnings(stderr);

      // Show error message
      vscode.window.setStatusBarMessage(
        `$(testing-failed-icon) Tests failed in ${path.basename(filePath)}`,
        5000
      );

      // Show output
      outputChannel.appendLine("\nTests failed! ❌");
      outputChannel.appendLine(stdout);
      if (filteredStderr) {
        outputChannel.appendLine("\nErrors:");
        outputChannel.appendLine(filteredStderr);
      }

      // After getting test results, add:
      if (results && results.length > 0) {
        await saveTestResultsToHistory(results, filePath);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run tests: ${error.message}`);
    getOutputChannel().appendLine(`Error: ${error.message}`);
  }
}

/**
 * Filter out common Nuxt warnings that aren't actual test failures
 */
function filterNuxtWarnings(stderr: string): string {
  if (!stderr) return "";

  const lines = stderr.split("\n");
  const filteredLines = lines.filter((line) => {
    // Filter out common Nuxt console.time warnings
    if (
      line.includes("Warning: Label") &&
      (line.includes("[nuxt-app]") || line.includes("console.time()"))
    ) {
      return false;
    }

    // Filter out Vitest deprecation warnings
    if (line.includes("Vitest") && line.includes("is deprecated")) {
      return false;
    }

    return true;
  });

  return filteredLines.join("\n");
}

/**
 * Run all Nuxt tests in the workspace
 */
export async function runAllNuxtTests(): Promise<void> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("No workspace folder open");
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const nuxtRoot = findNuxtRoot(rootPath);
    if (!nuxtRoot) {
      vscode.window.showErrorMessage(
        "Could not find Nuxt project root. Make sure you have a nuxt.config.js or nuxt.config.ts file in your project."
      );
      return;
    }

    // Check if dependencies are installed
    const dependenciesInstalled = await checkNuxtTestingDependencies(nuxtRoot);
    if (!dependenciesInstalled) {
      return;
    }

    // Ask if user wants to use cached results where available
    const useCachedResults = await vscode.window.showQuickPick(
      ["Yes, use cached results where available", "No, run all tests fresh"],
      { placeHolder: "Do you want to use cached results where available?" }
    );

    if (!useCachedResults) {
      return; // User cancelled
    }

    const useCache = useCachedResults.startsWith("Yes");

    // Clear previous results
    testResultsProvider.clearResults();

    // Show status bar message
    const statusBarMessage = vscode.window.setStatusBarMessage(
      `$(testing-run-icon) Running all tests...`
    );

    // Show notification
    vscode.window.showInformationMessage("Running all tests");

    // Get the output channel
    const outputChannel = getOutputChannel();
    outputChannel.clear();
    outputChannel.appendLine("Running all tests");
    outputChannel.show(true);

    // Find all test files
    const testFiles = await vscode.workspace.findFiles(
      "**/tests/**/*.spec.{js,ts}",
      "**/node_modules/**"
    );

    if (testFiles.length === 0) {
      vscode.window.showInformationMessage("No test files found");
      outputChannel.appendLine("No test files found");
      statusBarMessage.dispose();
      return;
    }

    outputChannel.appendLine(`Found ${testFiles.length} test files`);

    // Track overall results
    let allResults: TestResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let cachedCount = 0;

    // Run tests for each file
    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      const filePath = testFile.fsPath;
      const relativePath = path.relative(rootPath, filePath);

      outputChannel.appendLine(
        `\n[${i + 1}/${testFiles.length}] Running tests in ${relativePath}`
      );

      // Check if we can use cached results
      if (useCache && !testCache.shouldRunTest(filePath, globalTestCache)) {
        const cachedResults = testCache.getCachedResults(
          filePath,
          globalTestCache
        );
        if (cachedResults && cachedResults.length > 0) {
          outputChannel.appendLine(`Using cached results for ${relativePath}`);

          // Add cached results to overall results
          allResults = [...allResults, ...cachedResults];

          // Update counts
          passedCount += cachedResults.filter(
            (r) => r.status === "passed"
          ).length;
          failedCount += cachedResults.filter(
            (r) => r.status === "failed"
          ).length;
          skippedCount += cachedResults.filter(
            (r) => r.status === "skipped"
          ).length;
          cachedCount++;

          // After getting test results, add:
          if (cachedResults && cachedResults.length > 0) {
            await saveTestResultsToHistory(cachedResults, filePath);
          }

          continue;
        }
      }

      // Run the test
      const command = "npx";
      const args = ["vitest", "run", filePath, "--reporter=verbose"];

      outputChannel.appendLine(`> ${command} ${args.join(" ")}`);

      try {
        // Execute the test
        const { stdout, stderr, exitCode } = await execa(command, args, {
          cwd: nuxtRoot,
          reject: false,
        });

        // Parse test results
        const results = parseTestResults(stdout, filePath);

        // Add to overall results
        allResults = [...allResults, ...results];

        // Update counts
        passedCount += results.filter((r) => r.status === "passed").length;
        failedCount += results.filter((r) => r.status === "failed").length;
        skippedCount += results.filter((r) => r.status === "skipped").length;

        // Update the cache
        globalTestCache = testCache.updateCache(
          filePath,
          results,
          globalTestCache
        );

        if (exitCode === 0) {
          outputChannel.appendLine("✅ All tests passed");

          // After getting test results, add:
          if (results && results.length > 0) {
            await saveTestResultsToHistory(results, filePath);
          }
        } else {
          const filteredStderr = filterNuxtWarnings(stderr);
          outputChannel.appendLine("❌ Some tests failed");
          if (filteredStderr) {
            outputChannel.appendLine("Errors:");
            outputChannel.appendLine(filteredStderr);
          }

          // After getting test results, add:
          if (results && results.length > 0) {
            await saveTestResultsToHistory(results, filePath);
          }
        }
      } catch (error) {
        outputChannel.appendLine(`Error running tests: ${error.message}`);
        failedCount++;
      }
    }

    // Clear status bar message
    statusBarMessage.dispose();

    // Update test results view
    testResultsProvider.clearResults();
    testResultsProvider.addResults(allResults);

    // Show summary
    const totalTests = passedCount + failedCount + skippedCount;
    if (failedCount === 0) {
      vscode.window.setStatusBarMessage(
        `$(testing-passed-icon) All ${totalTests} tests passed`,
        5000
      );
      outputChannel.appendLine(`\n✅ All ${totalTests} tests passed!`);
    } else {
      vscode.window.setStatusBarMessage(
        `$(testing-failed-icon) ${failedCount} of ${totalTests} tests failed`,
        5000
      );
      outputChannel.appendLine(
        `\n❌ ${failedCount} of ${totalTests} tests failed`
      );
    }

    // Show cache usage summary
    if (useCache && cachedCount > 0) {
      outputChannel.appendLine(
        `\n📊 Cache usage: ${cachedCount} of ${testFiles.length} files used cached results`
      );
    }

    outputChannel.appendLine(`\n📊 Test summary:`);
    outputChannel.appendLine(`Total tests: ${totalTests}`);
    outputChannel.appendLine(`Passed: ${passedCount}`);
    outputChannel.appendLine(`Failed: ${failedCount}`);
    outputChannel.appendLine(`Skipped: ${skippedCount}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run tests: ${error.message}`);
    getOutputChannel().appendLine(`Error: ${error.message}`);
  }
}

/**
 * Parse test results from Vitest output
 */
function parseTestResults(output: string, filePath: string): TestResult[] {
  const results: TestResult[] = [];
  const lines = output.split("\n");

  // Read the file to get line numbers
  let fileContent: string[] = [];
  try {
    fileContent = fs.readFileSync(filePath, "utf8").split("\n");
  } catch (error) {
    console.error("Error reading test file:", error);
  }

  // Find test results in output
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for test result lines
    const passedMatch = line.match(/✓\s+(.+?)(?:\s+\(\d+ms\))?$/);
    const failedMatch = line.match(/✗\s+(.+?)(?:\s+\(\d+ms\))?$/);
    const skippedMatch = line.match(/○\s+(.+?)(?:\s+\(\d+ms\))?$/);

    // Also look for test file paths with test names
    const fileTestMatch = line.match(
      /(?:PASS|FAIL)\s+([^\s]+)\s+>\s+([^>]+)\s+>\s+(.+?)$/
    );

    if (passedMatch || failedMatch || skippedMatch) {
      let testName = "";
      let status: "passed" | "failed" | "skipped" = "passed";
      let duration: number | undefined;

      if (passedMatch) {
        testName = passedMatch[1].trim();
        status = "passed";
        const durationMatch = line.match(/\((\d+)ms\)/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        }
      } else if (failedMatch) {
        testName = failedMatch[1].trim();
        status = "failed";
        const durationMatch = line.match(/\((\d+)ms\)/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1], 10);
        }
      } else if (skippedMatch) {
        testName = skippedMatch[1].trim();
        status = "skipped";
      }

      // Find line number in file
      let lineNumber: number | undefined;
      for (let j = 0; j < fileContent.length; j++) {
        if (
          fileContent[j].includes(`it('${testName}'`) ||
          fileContent[j].includes(`it("${testName}"`) ||
          fileContent[j].includes(`test('${testName}'`) ||
          fileContent[j].includes(`test("${testName}"`)
        ) {
          lineNumber = j + 1;
          break;
        }
      }

      // Get error message for failed tests
      let message: string | undefined;
      if (status === "failed") {
        message = "";
        // Look for error message in the next lines
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/✓|✗|○/)) {
          if (lines[j].trim() !== "") {
            message += lines[j] + "\n";
          }
          j++;
        }
      }

      results.push({
        name: testName,
        status,
        duration,
        message,
        filePath,
        lineNumber,
      });
    } else if (fileTestMatch) {
      // Handle the file > describe > test format
      const testFilePath = fileTestMatch[1];
      const describeName = fileTestMatch[2].trim();
      const testName = fileTestMatch[3].trim();
      const fullTestName = `${describeName} > ${testName}`;

      // Determine status
      let status: "passed" | "failed" | "skipped" = "passed";
      if (line.startsWith("FAIL")) {
        status = "failed";
      } else if (line.includes("skipped")) {
        status = "skipped";
      }

      // Extract duration if available
      let duration: number | undefined;
      const durationMatch = line.match(/(\d+)ms$/);
      if (durationMatch) {
        duration = parseInt(durationMatch[1], 10);
      }

      // Find line number in file
      let lineNumber: number | undefined;
      for (let j = 0; j < fileContent.length; j++) {
        if (
          (fileContent[j].includes(`it('${testName}'`) ||
            fileContent[j].includes(`it("${testName}"`) ||
            fileContent[j].includes(`test('${testName}'`) ||
            fileContent[j].includes(`test("${testName}"`)) &&
          fileContent
            .slice(0, j)
            .some(
              (line) =>
                line.includes(`describe('${describeName}'`) ||
                line.includes(`describe("${describeName}"`)
            )
        ) {
          lineNumber = j + 1;
          break;
        }
      }

      // Get error message for failed tests
      let message: string | undefined;
      if (status === "failed") {
        message = "";
        // Look for error message in the next lines
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/PASS|FAIL/)) {
          if (lines[j].trim() !== "" && !lines[j].includes("⎯⎯⎯⎯⎯⎯⎯")) {
            message += lines[j] + "\n";
          }
          j++;
        }
      }

      // Only add if the file path matches
      if (testFilePath.includes(path.basename(filePath))) {
        results.push({
          name: fullTestName,
          status,
          duration,
          message,
          filePath,
          lineNumber,
        });
      }
    }
  }

  return results;
}

/**
 * Extract test duration from output
 */
function getDurationFromOutput(output: string): number | undefined {
  const durationMatch = output.match(/Duration:\s+(\d+)ms/);
  if (durationMatch) {
    return parseInt(durationMatch[1], 10);
  }
  return undefined;
}
