import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { execa } from "execa";

/**
 * Find the Nuxt project root directory
 */
export function findNuxtRoot(filePath: string): string | undefined {
  if (!filePath) {
    console.log("findNuxtRoot: No file path provided");
    return undefined;
  }

  console.log(`findNuxtRoot: Searching for Nuxt root from ${filePath}`);

  let currentDir = path.dirname(filePath);
  const maxDepth = 10; // Prevent infinite loop
  let depth = 0;

  while (currentDir && depth < maxDepth) {
    // Check for common Nuxt project indicators
    const nuxtConfigJs = path.join(currentDir, "nuxt.config.js");
    const nuxtConfigTs = path.join(currentDir, "nuxt.config.ts");
    const packageJsonPath = path.join(currentDir, "package.json");

    const hasNuxtConfigJs = fs.existsSync(nuxtConfigJs);
    const hasNuxtConfigTs = fs.existsSync(nuxtConfigTs);
    const hasPackageJson = fs.existsSync(packageJsonPath);

    console.log(`Checking directory: ${currentDir}`);
    console.log(`- nuxt.config.js exists: ${hasNuxtConfigJs}`);
    console.log(`- nuxt.config.ts exists: ${hasNuxtConfigTs}`);
    console.log(`- package.json exists: ${hasPackageJson}`);

    // First check: Look for nuxt.config.js or nuxt.config.ts
    if ((hasNuxtConfigJs || hasNuxtConfigTs) && hasPackageJson) {
      console.log(`Found Nuxt project root at ${currentDir}`);
      return currentDir;
    }

    // Second check: If no nuxt.config found, check package.json for Nuxt dependencies
    if (hasPackageJson) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8")
        );
        const dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Check if this is a Nuxt project by looking for Nuxt dependencies
        if (
          dependencies &&
          (dependencies.nuxt ||
            dependencies["@nuxt/kit"] ||
            dependencies["@nuxt/schema"] ||
            dependencies["nuxt3"])
        ) {
          console.log(
            `Found Nuxt project root at ${currentDir} (via package.json dependencies)`
          );
          return currentDir;
        }
      } catch (error) {
        console.log(`Error parsing package.json: ${error.message}`);
      }
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      console.log("Reached root directory, Nuxt project not found");
      break; // Reached the root directory
    }
    currentDir = parentDir;
    depth++;
  }

  // If we get here, we couldn't find a Nuxt project root
  if (depth >= maxDepth) {
    console.log(`Exceeded maximum search depth (${maxDepth})`);
  }

  // As a fallback, try to use the workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    console.log(`Using workspace root as fallback: ${workspaceRoot}`);
    return workspaceRoot;
  }

  console.log("Could not find Nuxt project root");
  return undefined;
}

/**
 * Check if a file is a test file
 */
export function isTestFile(filePath: string): boolean {
  return (
    filePath.includes(".spec.") ||
    filePath.includes(".test.") ||
    path.basename(filePath).startsWith("test-")
  );
}

/**
 * Get the relative path from the project root
 */
export function getRelativePath(filePath: string, rootPath: string): string {
  return path.relative(rootPath, filePath);
}

/**
 * Get the source file path for a test file
 */
export function getSourceFilePath(testFilePath: string): string | undefined {
  const fileName = path.basename(testFilePath);
  const dirName = path.dirname(testFilePath);

  // Remove .spec or .test from the file name
  let sourceFileName = fileName.replace(/\.spec\./g, ".");
  sourceFileName = sourceFileName.replace(/\.test\./g, ".");

  // If the test is in a __tests__ directory, move up one level
  const isInTestsDir =
    dirName.includes("__tests__") || dirName.includes("tests");

  if (isInTestsDir) {
    const parentDir = path.dirname(dirName);
    return path.join(parentDir, sourceFileName);
  }

  return path.join(dirName, sourceFileName);
}

/**
 * Check if Vitest is installed in the project
 * @param projectRoot The project root directory
 * @returns True if Vitest is installed, false otherwise
 */
export async function ensureVitestInstalled(
  projectRoot: string
): Promise<boolean> {
  const vitestPath = path.join(projectRoot, "node_modules", "vitest");

  if (fs.existsSync(vitestPath)) {
    return true;
  }

  // Vitest is not installed, ask the user if they want to install it
  const installVitest = await vscode.window.showWarningMessage(
    "Vitest is not installed in this project. Install it now?",
    "Yes",
    "No"
  );

  if (installVitest !== "Yes") {
    return false;
  }

  // Show progress notification
  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Installing Vitest",
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: "Installing Vitest..." });

        // Create an output channel to show installation progress
        const outputChannel = vscode.window.createOutputChannel(
          "NuxTest Vitest Installation"
        );
        outputChannel.appendLine("Installing Vitest...");
        outputChannel.show();

        // Install Vitest
        const { stdout, stderr } = await execa(
          "npm",
          ["install", "--save-dev", "vitest", "@vitest/coverage-v8"],
          { cwd: projectRoot }
        );

        outputChannel.appendLine(stdout);
        if (stderr) {
          outputChannel.appendLine(stderr);
        }

        outputChannel.appendLine("Vitest installed successfully!");
        vscode.window.showInformationMessage("Vitest installed successfully!");

        return true;
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to install Vitest: ${error.message}`
        );
        return false;
      }
    }
  );
}
