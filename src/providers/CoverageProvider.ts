import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// Interface for coverage data
export interface FileCoverage {
  path: string;
  statements: CoverageStats;
  branches: CoverageStats;
  functions: CoverageStats;
  lines: CoverageStats;
  uncoveredLines: number[];
}

export interface CoverageStats {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageSummary {
  total: {
    statements: CoverageStats;
    branches: CoverageStats;
    functions: CoverageStats;
    lines: CoverageStats;
  };
  files: FileCoverage[];
}

// Tree item for coverage view
export class CoverageItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly coverage?: FileCoverage,
    public readonly type: "file" | "summary" | "category" = "file"
  ) {
    super(label, collapsibleState);

    if (coverage && type === "file") {
      // Set description to show coverage percentage
      this.description = `${coverage.lines.pct.toFixed(2)}% lines covered`;

      // Set icon based on coverage percentage
      if (coverage.lines.pct >= 80) {
        this.iconPath = new vscode.ThemeIcon(
          "check",
          new vscode.ThemeColor("testing.iconPassed")
        );
      } else if (coverage.lines.pct >= 50) {
        this.iconPath = new vscode.ThemeIcon(
          "warning",
          new vscode.ThemeColor("testing.iconSkipped")
        );
      } else {
        this.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("testing.iconFailed")
        );
      }

      // Add command to open file
      this.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(coverage.path)],
      };
    } else if (type === "summary") {
      this.iconPath = new vscode.ThemeIcon("graph");
    } else if (type === "category") {
      this.iconPath = new vscode.ThemeIcon("folder");
    }
  }
}

// Provider for coverage view
export class CoverageProvider implements vscode.TreeDataProvider<CoverageItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    CoverageItem | undefined | null | void
  > = new vscode.EventEmitter<CoverageItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    CoverageItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private coverageData: CoverageSummary | null = null;
  private coverageDecorationTypes: {
    covered: vscode.TextEditorDecorationType;
    uncovered: vscode.TextEditorDecorationType;
  };

  constructor() {
    // Create decoration types for covered and uncovered lines
    this.coverageDecorationTypes = {
      covered: vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor("testing.runAction"),
        isWholeLine: true,
        overviewRulerColor: new vscode.ThemeColor("testing.iconPassed"),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      }),
      uncovered: vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor(
          "testing.message.error.decorationBackground"
        ),
        isWholeLine: true,
        overviewRulerColor: new vscode.ThemeColor("testing.iconFailed"),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
      }),
    };

    // Listen for active editor changes to update decorations
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        this.updateEditorDecorations(editor);
      }
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CoverageItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CoverageItem): Thenable<CoverageItem[]> {
    if (!this.coverageData) {
      return Promise.resolve([
        new CoverageItem(
          "No coverage data available",
          vscode.TreeItemCollapsibleState.None
        ),
      ]);
    }

    if (!element) {
      // Root level - show summary and categories
      const items: CoverageItem[] = [];

      // Add summary item
      const summaryItem = new CoverageItem(
        "Coverage Summary",
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        "summary"
      );
      items.push(summaryItem);

      // Add statements category
      const statementsItem = new CoverageItem(
        `Statements: ${this.coverageData.total.statements.pct.toFixed(2)}%`,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        "category"
      );
      items.push(statementsItem);

      // Add branches category
      const branchesItem = new CoverageItem(
        `Branches: ${this.coverageData.total.branches.pct.toFixed(2)}%`,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        "category"
      );
      items.push(branchesItem);

      // Add functions category
      const functionsItem = new CoverageItem(
        `Functions: ${this.coverageData.total.functions.pct.toFixed(2)}%`,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        "category"
      );
      items.push(functionsItem);

      // Add lines category
      const linesItem = new CoverageItem(
        `Lines: ${this.coverageData.total.lines.pct.toFixed(2)}%`,
        vscode.TreeItemCollapsibleState.Collapsed,
        undefined,
        "category"
      );
      items.push(linesItem);

      // Add files category
      const filesItem = new CoverageItem(
        "Files",
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        "category"
      );
      items.push(filesItem);

      return Promise.resolve(items);
    } else if (element.type === "category") {
      if (element.label === "Files") {
        // Show all files with coverage data
        return Promise.resolve(
          this.coverageData.files.map((file) => {
            const fileName = path.basename(file.path);
            return new CoverageItem(
              fileName,
              vscode.TreeItemCollapsibleState.None,
              file
            );
          })
        );
      } else {
        // For other categories, no children for now
        return Promise.resolve([]);
      }
    }

    return Promise.resolve([]);
  }

  // Load coverage data from a JSON file
  loadCoverageData(coverageFilePath: string): boolean {
    try {
      if (!fs.existsSync(coverageFilePath)) {
        return false;
      }

      const coverageJson = fs.readFileSync(coverageFilePath, "utf8");
      const rawData = JSON.parse(coverageJson);

      // Create output channel for debugging
      const outputChannel = vscode.window.createOutputChannel(
        "NuxTest Coverage Debug"
      );

      // Log the raw coverage data structure for debugging
      outputChannel.appendLine("Raw coverage data structure:");
      outputChannel.appendLine(
        JSON.stringify(rawData, null, 2).substring(0, 1000) + "..."
      );

      // Handle different coverage formats (Istanbul/NYC vs Vitest v8)
      let parsedData: CoverageSummary;

      if (rawData.total) {
        // Format is already compatible with our expected structure
        parsedData = rawData;
      } else if (rawData.result && rawData.result.coverage) {
        // Vitest v8 format with result.coverage
        const vitestData = rawData.result.coverage;

        // Log the Vitest coverage data structure
        outputChannel.appendLine("\nVitest coverage data structure:");
        outputChannel.appendLine(
          JSON.stringify(vitestData, null, 2).substring(0, 1000) + "..."
        );

        // Convert Vitest format to our expected format
        const files: FileCoverage[] = [];
        let totalStatements = { total: 0, covered: 0, skipped: 0, pct: 0 };
        let totalBranches = { total: 0, covered: 0, skipped: 0, pct: 0 };
        let totalFunctions = { total: 0, covered: 0, skipped: 0, pct: 0 };
        let totalLines = { total: 0, covered: 0, skipped: 0, pct: 0 };

        // Process each file in the coverage data
        for (const filePath in vitestData) {
          const fileData = vitestData[filePath];

          if (!fileData || !fileData.s) {
            // Skip files with invalid data
            outputChannel.appendLine(
              `Skipping file with invalid data: ${filePath}`
            );
            continue;
          }

          // Calculate statement coverage
          const statementTotal = Object.keys(fileData.s || {}).length;
          const statementCovered = Object.values(fileData.s || {}).filter(
            (v) => v > 0
          ).length;
          const statementPct =
            statementTotal > 0 ? (statementCovered / statementTotal) * 100 : 0;

          // Calculate branch coverage
          const branchTotal = Object.keys(fileData.b || {}).length * 2; // Each branch has two paths
          const branchCovered = Object.values(fileData.b || {}).reduce(
            (sum, arr) => sum + arr.filter((v) => v > 0).length,
            0
          );
          const branchPct =
            branchTotal > 0 ? (branchCovered / branchTotal) * 100 : 0;

          // Calculate function coverage
          const functionTotal = Object.keys(fileData.f || {}).length;
          const functionCovered = Object.values(fileData.f || {}).filter(
            (v) => v > 0
          ).length;
          const functionPct =
            functionTotal > 0 ? (functionCovered / functionTotal) * 100 : 0;

          // Calculate line coverage
          const lineTotal = Object.keys(fileData.l || {}).length;
          const lineCovered = Object.values(fileData.l || {}).filter(
            (v) => v > 0
          ).length;
          const linePct = lineTotal > 0 ? (lineCovered / lineTotal) * 100 : 0;

          // Find uncovered lines
          const uncoveredLines = Object.entries(fileData.l || {})
            .filter(([_, count]) => count === 0)
            .map(([line, _]) => parseInt(line));

          // Create file coverage object
          const fileCoverage: FileCoverage = {
            path: filePath,
            statements: {
              total: statementTotal,
              covered: statementCovered,
              skipped: 0,
              pct: statementPct,
            },
            branches: {
              total: branchTotal,
              covered: branchCovered,
              skipped: 0,
              pct: branchPct,
            },
            functions: {
              total: functionTotal,
              covered: functionCovered,
              skipped: 0,
              pct: functionPct,
            },
            lines: {
              total: lineTotal,
              covered: lineCovered,
              skipped: 0,
              pct: linePct,
            },
            uncoveredLines: uncoveredLines,
          };

          files.push(fileCoverage);

          // Update totals
          totalStatements.total += statementTotal;
          totalStatements.covered += statementCovered;
          totalBranches.total += branchTotal;
          totalBranches.covered += branchCovered;
          totalFunctions.total += functionTotal;
          totalFunctions.covered += functionCovered;
          totalLines.total += lineTotal;
          totalLines.covered += lineCovered;
        }

        // Calculate percentages for totals
        totalStatements.pct =
          totalStatements.total > 0
            ? (totalStatements.covered / totalStatements.total) * 100
            : 0;
        totalBranches.pct =
          totalBranches.total > 0
            ? (totalBranches.covered / totalBranches.total) * 100
            : 0;
        totalFunctions.pct =
          totalFunctions.total > 0
            ? (totalFunctions.covered / totalFunctions.total) * 100
            : 0;
        totalLines.pct =
          totalLines.total > 0
            ? (totalLines.covered / totalLines.total) * 100
            : 0;

        // Create the final coverage summary
        parsedData = {
          total: {
            statements: totalStatements,
            branches: totalBranches,
            functions: totalFunctions,
            lines: totalLines,
          },
          files: files,
        };

        outputChannel.appendLine("\nConverted coverage data structure:");
        outputChannel.appendLine(
          JSON.stringify(parsedData, null, 2).substring(0, 1000) + "..."
        );
      } else if (rawData.coverageMap) {
        // Vitest coverageMap format (from the error message)
        outputChannel.appendLine("\nDetected Vitest coverageMap format");
        const coverageMap = rawData.coverageMap;

        // Convert coverageMap format to our expected format
        const files: FileCoverage[] = [];
        let totalStatements = { total: 0, covered: 0, skipped: 0, pct: 0 };
        let totalBranches = { total: 0, covered: 0, skipped: 0, pct: 0 };
        let totalFunctions = { total: 0, covered: 0, skipped: 0, pct: 0 };
        let totalLines = { total: 0, covered: 0, skipped: 0, pct: 0 };

        // Process each file in the coverage data
        for (const filePath in coverageMap) {
          const fileData = coverageMap[filePath];

          if (!fileData) {
            // Skip files with invalid data
            outputChannel.appendLine(
              `Skipping file with invalid data: ${filePath}`
            );
            continue;
          }

          // Calculate statement coverage from statementMap and s
          const statementMap = fileData.statementMap || {};
          const statements = fileData.s || {};
          const statementTotal = Object.keys(statementMap).length;
          const statementCovered = Object.values(statements).filter(
            (v) => v > 0
          ).length;
          const statementPct =
            statementTotal > 0 ? (statementCovered / statementTotal) * 100 : 0;

          // Calculate branch coverage from branchMap and b
          const branchMap = fileData.branchMap || {};
          const branches = fileData.b || {};
          const branchTotal = Object.keys(branchMap).length;
          const branchCovered = Object.values(branches).filter((v) =>
            Array.isArray(v) ? v.some((b) => b > 0) : v > 0
          ).length;
          const branchPct =
            branchTotal > 0 ? (branchCovered / branchTotal) * 100 : 0;

          // Calculate function coverage from fnMap and f
          const fnMap = fileData.fnMap || {};
          const functions = fileData.f || {};
          const functionTotal = Object.keys(fnMap).length;
          const functionCovered = Object.values(functions).filter(
            (v) => v > 0
          ).length;
          const functionPct =
            functionTotal > 0 ? (functionCovered / functionTotal) * 100 : 0;

          // For lines, we'll use statements as an approximation since this format doesn't have explicit line coverage
          const lineTotal = statementTotal;
          const lineCovered = statementCovered;
          const linePct = statementPct;

          // Find uncovered lines (approximation based on statement locations)
          const uncoveredLines: number[] = [];
          for (const stmtId in statementMap) {
            if (statements[stmtId] === 0) {
              const line = statementMap[stmtId].start.line;
              if (!uncoveredLines.includes(line)) {
                uncoveredLines.push(line);
              }
            }
          }

          // Create file coverage object
          const fileCoverage: FileCoverage = {
            path: filePath,
            statements: {
              total: statementTotal,
              covered: statementCovered,
              skipped: 0,
              pct: statementPct,
            },
            branches: {
              total: branchTotal,
              covered: branchCovered,
              skipped: 0,
              pct: branchPct,
            },
            functions: {
              total: functionTotal,
              covered: functionCovered,
              skipped: 0,
              pct: functionPct,
            },
            lines: {
              total: lineTotal,
              covered: lineCovered,
              skipped: 0,
              pct: linePct,
            },
            uncoveredLines: uncoveredLines,
          };

          files.push(fileCoverage);

          // Update totals
          totalStatements.total += statementTotal;
          totalStatements.covered += statementCovered;
          totalBranches.total += branchTotal;
          totalBranches.covered += branchCovered;
          totalFunctions.total += functionTotal;
          totalFunctions.covered += functionCovered;
          totalLines.total += lineTotal;
          totalLines.covered += lineCovered;
        }

        // Calculate percentages for totals
        totalStatements.pct =
          totalStatements.total > 0
            ? (totalStatements.covered / totalStatements.total) * 100
            : 0;
        totalBranches.pct =
          totalBranches.total > 0
            ? (totalBranches.covered / totalBranches.total) * 100
            : 0;
        totalFunctions.pct =
          totalFunctions.total > 0
            ? (totalFunctions.covered / totalFunctions.total) * 100
            : 0;
        totalLines.pct =
          totalLines.total > 0
            ? (totalLines.covered / totalLines.total) * 100
            : 0;

        // Create the final coverage summary
        parsedData = {
          total: {
            statements: totalStatements,
            branches: totalBranches,
            functions: totalFunctions,
            lines: totalLines,
          },
          files: files,
        };

        outputChannel.appendLine("\nConverted coverageMap data structure:");
        outputChannel.appendLine(
          JSON.stringify(parsedData, null, 2).substring(0, 1000) + "..."
        );
      } else {
        // Unknown format, try to adapt it
        outputChannel.appendLine(
          "\nUnknown coverage format, attempting to adapt..."
        );

        // Create a minimal structure to avoid errors
        parsedData = {
          total: {
            statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
            branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
            functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
            lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
          },
          files: [],
        };

        // Try to extract file data if available
        if (typeof rawData === "object") {
          for (const key in rawData) {
            if (typeof rawData[key] === "object" && rawData[key] !== null) {
              const fileData = rawData[key];

              // Check if this looks like a file coverage object
              if (
                fileData.path ||
                (typeof key === "string" && key.includes("/"))
              ) {
                const filePath = fileData.path || key;

                // Create a basic file coverage object with default values
                const fileCoverage: FileCoverage = {
                  path: filePath,
                  statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
                  branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
                  functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
                  lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
                  uncoveredLines: [],
                };

                // Try to extract coverage data if available
                if (fileData.statements)
                  fileCoverage.statements = fileData.statements;
                if (fileData.branches)
                  fileCoverage.branches = fileData.branches;
                if (fileData.functions)
                  fileCoverage.functions = fileData.functions;
                if (fileData.lines) fileCoverage.lines = fileData.lines;

                parsedData.files.push(fileCoverage);
              }
            }
          }
        }

        outputChannel.appendLine("\nAdapted coverage data structure:");
        outputChannel.appendLine(
          JSON.stringify(parsedData, null, 2).substring(0, 1000) + "..."
        );
      }

      // Set the coverage data and refresh the view
      this.coverageData = parsedData;
      this.refresh();

      // Update decorations for the active editor
      if (vscode.window.activeTextEditor) {
        this.updateEditorDecorations(vscode.window.activeTextEditor);
      }

      // Show the output channel if there were issues
      if (parsedData.files.length === 0) {
        outputChannel.appendLine(
          "\nWARNING: No files with coverage data were found!"
        );
        outputChannel.show();
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error loading coverage data:", error);

      // Show detailed error information
      const outputChannel = vscode.window.createOutputChannel(
        "NuxTest Coverage Error"
      );
      outputChannel.appendLine("Error loading coverage data:");
      outputChannel.appendLine(error.message);
      outputChannel.appendLine("\nStack trace:");
      outputChannel.appendLine(error.stack || "No stack trace available");

      if (error.message.includes("statements")) {
        outputChannel.appendLine(
          "\nThis appears to be an issue with the coverage data format."
        );
        outputChannel.appendLine(
          "The coverage data doesn't match the expected structure."
        );
        outputChannel.appendLine(
          "Please check the coverage file format and try again."
        );
      }

      outputChannel.show();
      return false;
    }
  }

  // Clear coverage data
  clearCoverageData(): void {
    this.coverageData = null;
    this.refresh();

    // Clear decorations from all editors
    vscode.window.visibleTextEditors.forEach((editor) => {
      editor.setDecorations(this.coverageDecorationTypes.covered, []);
      editor.setDecorations(this.coverageDecorationTypes.uncovered, []);
    });
  }

  // Update decorations for the given editor
  updateEditorDecorations(editor: vscode.TextEditor): void {
    if (!this.coverageData) {
      return;
    }

    // Find coverage data for the current file
    const filePath = editor.document.uri.fsPath;
    const fileCoverage = this.coverageData.files.find(
      (file) => file.path === filePath
    );

    if (!fileCoverage) {
      // Clear decorations if no coverage data for this file
      editor.setDecorations(this.coverageDecorationTypes.covered, []);
      editor.setDecorations(this.coverageDecorationTypes.uncovered, []);
      return;
    }

    // Create decorations for covered and uncovered lines
    const coveredDecorations: vscode.DecorationOptions[] = [];
    const uncoveredDecorations: vscode.DecorationOptions[] = [];

    // Check if the file has any dependency issues
    const fileContent = editor.document.getText();
    const hasMissingDependencies = this.checkForMissingDependencies(
      fileContent,
      filePath
    );

    // If the file has missing dependencies, show a warning
    if (hasMissingDependencies) {
      const warningMessage = new vscode.MarkdownString(
        "⚠️ **Warning**: This file has missing dependencies that may affect coverage reporting.\n\n" +
          "Run the 'Show Coverage' command again after installing the missing dependencies."
      );
      warningMessage.isTrusted = true;

      // Add a warning decoration at the top of the file
      uncoveredDecorations.push({
        range: new vscode.Range(0, 0, 0, 0),
        hoverMessage: warningMessage,
        renderOptions: {
          after: {
            contentText:
              " ⚠️ Missing dependencies may affect coverage reporting",
            color: new vscode.ThemeColor("editorWarning.foreground"),
          },
        },
      });
    }

    // Add decorations for each line based on coverage
    for (let i = 0; i < editor.document.lineCount; i++) {
      const line = editor.document.lineAt(i);
      const lineNumber = i + 1; // 1-indexed line number

      // Skip empty lines
      if (line.isEmptyOrWhitespace) {
        continue;
      }

      // Check if the line is uncovered
      if (fileCoverage.uncoveredLines.includes(lineNumber)) {
        uncoveredDecorations.push({
          range: line.range,
          hoverMessage: "This line is not covered by tests",
        });
      } else {
        coveredDecorations.push({
          range: line.range,
          hoverMessage: "This line is covered by tests",
        });
      }
    }

    // Apply decorations
    editor.setDecorations(
      this.coverageDecorationTypes.covered,
      coveredDecorations
    );
    editor.setDecorations(
      this.coverageDecorationTypes.uncovered,
      uncoveredDecorations
    );
  }

  // Check if a file has missing dependencies based on its content
  private checkForMissingDependencies(
    fileContent: string,
    filePath: string
  ): boolean {
    // Check for common missing dependency patterns
    const missingDependencyPatterns = [
      { pattern: /Cannot find module '([^']+)'/g, dependencyType: "module" },
      { pattern: /Cannot find name '([^']+)'/g, dependencyType: "type" },
      {
        pattern: /Module '([^']+)' has no exported member/g,
        dependencyType: "export",
      },
    ];

    // Check if the file is a configuration file with potential missing dependencies
    const fileName = path.basename(filePath);
    const isConfigFile =
      fileName.includes("config") &&
      (fileName.endsWith(".ts") || fileName.endsWith(".js"));

    // For playwright.config.ts specifically, check for @playwright/test
    if (
      fileName === "playwright.config.ts" ||
      fileName === "playwright.config.js"
    ) {
      const hasPlaywrightImport = fileContent.includes("@playwright/test");
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (workspaceRoot) {
        const hasPlaywrightDep = fs.existsSync(
          path.join(workspaceRoot, "node_modules", "@playwright", "test")
        );
        if (!hasPlaywrightDep && hasPlaywrightImport) {
          return true;
        }
      }
    }

    // Check for missing dependency patterns in the file content
    for (const { pattern } of missingDependencyPatterns) {
      if (pattern.test(fileContent)) {
        return true;
      }
    }

    return false;
  }
}
