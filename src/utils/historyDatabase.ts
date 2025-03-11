import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface TestResult {
  id: string;
  testName: string;
  filePath: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  timestamp: number;
  errorMessage?: string;
}

export interface TestTrend {
  testName: string;
  filePath: string;
  passRate: number;
  totalRuns: number;
  flaky: boolean;
  averageDuration: number;
  lastRun: number;
}

class HistoryDatabase {
  private dbPath: string;
  private data: {
    testResults: TestResult[];
  };
  private initialized: boolean = false;

  constructor() {
    this.data = {
      testResults: [],
    };
  }

  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create the database file in the extension's global storage path
    this.dbPath = path.join(
      context.globalStorageUri.fsPath,
      "test-history.json"
    );

    try {
      // Ensure the directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Load existing data if available
      if (fs.existsSync(this.dbPath)) {
        const fileContent = fs.readFileSync(this.dbPath, "utf8");
        this.data = JSON.parse(fileContent);
      } else {
        // Create a new database file
        fs.writeFileSync(
          this.dbPath,
          JSON.stringify(this.data, null, 2),
          "utf8"
        );
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize history database:", error);
      vscode.window.showErrorMessage(
        "Failed to initialize test history database"
      );
    }
  }

  public async saveTestResult(
    result: Omit<TestResult, "id" | "timestamp">
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    // Generate a unique ID for the test result
    const id = `${result.filePath}:${result.testName}:${Date.now()}`;

    // Add the test result to the database
    this.data.testResults.push({
      ...result,
      id,
      timestamp: Date.now(),
    });

    // Limit the history to the last 1000 results to prevent the file from growing too large
    if (this.data.testResults.length > 1000) {
      this.data.testResults = this.data.testResults.slice(-1000);
    }

    // Save the database
    await this.saveDatabase();
  }

  public async saveTestResults(
    results: Omit<TestResult, "id" | "timestamp">[]
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    // Add all test results to the database
    const timestamp = Date.now();
    const newResults = results.map((result) => ({
      ...result,
      id: `${result.filePath}:${result.testName}:${timestamp}`,
      timestamp,
    }));

    this.data.testResults.push(...newResults);

    // Limit the history to the last 1000 results
    if (this.data.testResults.length > 1000) {
      this.data.testResults = this.data.testResults.slice(-1000);
    }

    // Save the database
    await this.saveDatabase();
  }

  public getTestHistory(filePath?: string, testName?: string): TestResult[] {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    let results = this.data.testResults;

    // Filter by file path if provided
    if (filePath) {
      results = results.filter((result) => result.filePath === filePath);
    }

    // Filter by test name if provided
    if (testName) {
      results = results.filter((result) => result.testName === testName);
    }

    // Sort by timestamp (newest first)
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getTestTrends(): TestTrend[] {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    // Group test results by test name and file path
    const testGroups: { [key: string]: TestResult[] } = {};

    for (const result of this.data.testResults) {
      const key = `${result.filePath}:${result.testName}`;
      if (!testGroups[key]) {
        testGroups[key] = [];
      }
      testGroups[key].push(result);
    }

    // Calculate trends for each test
    const trends: TestTrend[] = [];

    for (const key in testGroups) {
      const results = testGroups[key];
      if (results.length < 2) {
        continue; // Skip tests with only one run
      }

      // Sort by timestamp (oldest first)
      results.sort((a, b) => a.timestamp - b.timestamp);

      const { filePath, testName } = results[0];
      const totalRuns = results.length;
      const passCount = results.filter((r) => r.status === "pass").length;
      const passRate = passCount / totalRuns;

      // Calculate average duration
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      const averageDuration = totalDuration / totalRuns;

      // Determine if the test is flaky (alternates between pass and fail)
      let alternateCount = 0;
      for (let i = 1; i < results.length; i++) {
        if (results[i].status !== results[i - 1].status) {
          alternateCount++;
        }
      }
      const alternateRate = alternateCount / (totalRuns - 1);
      const flaky = alternateRate > 0.3; // If more than 30% of runs alternate between pass/fail

      trends.push({
        testName,
        filePath,
        passRate,
        totalRuns,
        flaky,
        averageDuration,
        lastRun: results[results.length - 1].timestamp,
      });
    }

    // Sort by flaky (flaky tests first), then by pass rate (lowest first)
    return trends.sort((a, b) => {
      if (a.flaky !== b.flaky) {
        return a.flaky ? -1 : 1;
      }
      return a.passRate - b.passRate;
    });
  }

  public clearHistory(): void {
    if (!this.initialized) {
      throw new Error("Database not initialized");
    }

    this.data.testResults = [];
    this.saveDatabase();
  }

  private async saveDatabase(): Promise<void> {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), "utf8");
    } catch (error) {
      console.error("Failed to save history database:", error);
      vscode.window.showErrorMessage("Failed to save test history");
    }
  }
}

// Singleton instance
export const historyDatabase = new HistoryDatabase();
