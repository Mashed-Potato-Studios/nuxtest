import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";

export class CreateTestCommand extends BaseCommand {
  async execute(uri?: vscode.Uri): Promise<void> {
    try {
      // Get target directory
      const targetDir = uri?.fsPath || (await this.promptForDirectory());
      if (!targetDir) {
        return;
      }

      // Get component name
      const componentName = await this.promptForComponentName();
      if (!componentName) {
        return;
      }

      // Create test file
      await this.createTestFile(targetDir, componentName);
    } catch (error) {
      this.showError(`Failed to create test file: ${error.message}`);
    }
  }

  private async promptForDirectory(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.showError("No workspace folder open");
      return undefined;
    }

    // Get all directories in the workspace
    const rootPath = workspaceFolders[0].uri.fsPath;
    const dirs = this.getDirectories(rootPath);

    // Add common Nuxt directories if they don't exist
    const nuxtDirs = ["components", "pages", "layouts", "composables", "utils"];
    for (const dir of nuxtDirs) {
      const fullPath = path.join(rootPath, dir);
      if (!dirs.includes(fullPath) && fs.existsSync(fullPath)) {
        dirs.push(fullPath);
      }
    }

    // Format directory names for display
    const dirItems = dirs.map((dir) => {
      const relativePath = path.relative(rootPath, dir);
      return {
        label: relativePath || "/",
        description: dir,
      };
    });

    // Sort by label
    dirItems.sort((a, b) => a.label.localeCompare(b.label));

    // Show quick pick
    const selected = await vscode.window.showQuickPick(dirItems, {
      placeHolder: "Select a directory for the test file",
    });

    return selected?.description;
  }

  private async promptForComponentName(): Promise<string | undefined> {
    return vscode.window.showInputBox({
      placeHolder: "Enter component name (e.g., Button)",
      prompt: "The test file will be named [name].spec.ts",
      validateInput: (value) => {
        if (!value) {
          return "Component name is required";
        }
        if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
          return "Component name can only contain letters, numbers, hyphens, and underscores";
        }
        return null;
      },
    });
  }

  private async createTestFile(
    targetDir: string,
    componentName: string
  ): Promise<void> {
    // Create file path
    const fileName = `${componentName}.spec.ts`;
    const filePath = path.join(targetDir, fileName);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      const overwrite = await vscode.window.showWarningMessage(
        `Test file ${fileName} already exists. Overwrite?`,
        "Yes",
        "No"
      );

      if (overwrite !== "Yes") {
        return;
      }
    }

    // Create test file content
    const content = this.generateTestFileContent(componentName);

    // Write file
    fs.writeFileSync(filePath, content, "utf8");

    // Open the file
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);

    this.showInfo(`Created test file: ${fileName}`);
  }

  private generateTestFileContent(componentName: string): string {
    return `// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';

// Import your component
// import ${componentName} from './${componentName}.vue';

describe('${componentName}', () => {
  it('renders correctly', async () => {
    // Example test using mountSuspended
    const wrapper = await mountSuspended({
      template: '<div>Example component</div>'
      // Replace with your actual component
      // component: ${componentName}
    });
    
    expect(wrapper.html()).toContain('Example component');
  });

  it('handles user interaction', async () => {
    // Example test for user interaction
    const wrapper = await mountSuspended({
      template: '<button @click="count++">Clicked {{ count }} times</button>',
      setup() {
        const count = ref(0);
        return { count };
      }
    });
    
    expect(wrapper.text()).toContain('Clicked 0 times');
    
    // Trigger a click event
    await wrapper.find('button').trigger('click');
    
    // Check that the count was incremented
    expect(wrapper.text()).toContain('Clicked 1 times');
  });
});
`;
  }

  private getDirectories(rootPath: string): string[] {
    const dirs: string[] = [];

    const traverse = (dir: string) => {
      if (!fs.existsSync(dir)) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dir, entry.name);

          // Skip node_modules, .git, etc.
          if (
            entry.name.startsWith(".") ||
            entry.name === "node_modules" ||
            entry.name === "dist"
          ) {
            continue;
          }

          dirs.push(fullPath);
          traverse(fullPath);
        }
      }
    };

    traverse(rootPath);
    return dirs;
  }
}
