import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BaseCommand } from "./base";

export class GenerateTestForComponentCommand extends BaseCommand {
  async execute(): Promise<void> {
    try {
      // Get component file
      const componentFile = await this.promptForComponentFile();
      if (!componentFile) {
        return;
      }

      // Generate test file
      await this.generateTestFile(componentFile);
    } catch (error) {
      this.showError(`Failed to generate test: ${error.message}`);
    }
  }

  private async promptForComponentFile(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.showError("No workspace folder open");
      return undefined;
    }

    // Find Vue component files with expanded search patterns
    const rootPath = workspaceFolders[0].uri.fsPath;

    // First try the standard Nuxt directories
    let componentFiles = await vscode.workspace.findFiles(
      "{components,pages,layouts}/**/*.vue",
      "{node_modules,.nuxt,dist}/**"
    );

    // If no files found, try a broader search
    if (componentFiles.length === 0) {
      componentFiles = await vscode.workspace.findFiles(
        "**/*.vue",
        "{node_modules,.nuxt,dist}/**"
      );
    }

    if (componentFiles.length === 0) {
      // Show a more helpful error message with guidance
      const createComponent = await vscode.window.showErrorMessage(
        "No Vue component files found in your project. Would you like to create a new component?",
        "Yes",
        "No"
      );

      if (createComponent === "Yes") {
        // Prompt for component name and location
        const componentName = await vscode.window.showInputBox({
          prompt: "Enter a name for your new component",
          placeHolder: "MyComponent",
        });

        if (!componentName) {
          return undefined;
        }

        // Create components directory if it doesn't exist
        const componentsDir = path.join(rootPath, "components");
        if (!fs.existsSync(componentsDir)) {
          fs.mkdirSync(componentsDir, { recursive: true });
        }

        // Create the component file
        const componentFilePath = path.join(
          componentsDir,
          `${componentName}.vue`
        );
        const componentContent =
          this.generateVueComponentTemplate(componentName);
        fs.writeFileSync(componentFilePath, componentContent);

        // Open the new component file
        const document = await vscode.workspace.openTextDocument(
          componentFilePath
        );
        await vscode.window.showTextDocument(document);

        // Ask if the user wants to generate a test for this new component
        const generateTest = await vscode.window.showInformationMessage(
          `Component ${componentName}.vue created. Generate a test for it?`,
          "Yes",
          "No"
        );

        if (generateTest === "Yes") {
          return componentFilePath;
        }
      }

      return undefined;
    }

    // Format file paths for display
    const fileItems = componentFiles.map((file) => {
      const relativePath = path.relative(rootPath, file.fsPath);
      return {
        label: relativePath,
        description: file.fsPath,
      };
    });

    // Sort by label
    fileItems.sort((a, b) => a.label.localeCompare(b.label));

    // Show quick pick
    const selected = await vscode.window.showQuickPick(fileItems, {
      placeHolder: "Select a component to generate a test for",
    });

    return selected?.description;
  }

  private async generateTestFile(componentFilePath: string): Promise<void> {
    // Read component file
    const componentContent = fs.readFileSync(componentFilePath, "utf8");

    // Extract component name from file path
    const fileName = path.basename(componentFilePath, ".vue");
    const componentName = this.pascalCase(fileName);

    // Determine test file path
    const componentDir = path.dirname(componentFilePath);
    const testFileName = `${fileName}.spec.ts`;
    const testFilePath = path.join(componentDir, testFileName);

    // Check if test file already exists
    if (fs.existsSync(testFilePath)) {
      const overwrite = await vscode.window.showWarningMessage(
        `Test file ${testFileName} already exists. Overwrite?`,
        "Yes",
        "No"
      );

      if (overwrite !== "Yes") {
        return;
      }
    }

    // Generate test content based on component analysis
    const testContent = await this.generateTestContent(
      componentFilePath,
      componentContent,
      componentName
    );

    // Write test file
    fs.writeFileSync(testFilePath, testContent, "utf8");

    // Open the file
    const document = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.window.showTextDocument(document);

    this.showInfo(`Generated test file: ${testFileName}`);
  }

  private async generateTestContent(
    componentFilePath: string,
    componentContent: string,
    componentName: string
  ): Promise<string> {
    // Analyze component to extract props, events, slots, etc.
    const props = this.extractProps(componentContent);
    const hasSetup = componentContent.includes("<script setup");
    const hasTemplate = componentContent.includes("<template");
    const hasComposables = this.detectComposables(componentContent);
    const importPath = this.getRelativeImportPath(componentFilePath);

    // Generate test content
    let testContent = `// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import ${componentName} from '${importPath}';

describe('${componentName}', () => {
`;

    // Basic rendering test
    testContent += `  it('renders correctly', async () => {
    const wrapper = await mountSuspended(${componentName}${
      props.length > 0
        ? ", {\n      props: {\n        // Add required props here\n      }\n    }"
        : ""
    });
    
    expect(wrapper.exists()).toBe(true);
  });\n\n`;

    // Props tests if props found
    if (props.length > 0) {
      testContent += `  it('renders with props', async () => {
    const wrapper = await mountSuspended(${componentName}, {
      props: {
${props
  .map((prop) => `        ${prop}: ${this.getDefaultValueForProp(prop)}`)
  .join(",\n")}
      }
    });
    
    // Add assertions for props rendering
    // expect(wrapper.text()).toContain(...);
  });\n\n`;
    }

    // Event test if it's likely to emit events
    if (
      componentContent.includes("$emit") ||
      componentContent.includes("emit(")
    ) {
      testContent += `  it('emits events correctly', async () => {
    const wrapper = await mountSuspended(${componentName});
    
    // Trigger an action that should emit an event
    await wrapper.find('button').trigger('click');
    
    // Check that the event was emitted
    // expect(wrapper.emitted('event-name')).toBeTruthy();
  });\n\n`;
    }

    // Composables test if detected
    if (hasComposables) {
      testContent += `  it('uses composables correctly', async () => {
    const wrapper = await mountSuspended(${componentName});
    
    // Test composable functionality
    // For example, if using useState:
    // expect(wrapper.vm.state).toBeDefined();
  });\n\n`;
    }

    // Slots test if the component likely uses slots
    if (
      componentContent.includes("<slot") ||
      componentContent.includes("$slots")
    ) {
      testContent += `  it('renders slot content', async () => {
    const wrapper = await mountSuspended(${componentName}, {
      slots: {
        default: '<div class="slot-content">Slot Content</div>'
      }
    });
    
    expect(wrapper.find('.slot-content').exists()).toBe(true);
    expect(wrapper.find('.slot-content').text()).toBe('Slot Content');
  });\n`;
    }

    testContent += "});\n";

    return testContent;
  }

  private extractProps(componentContent: string): string[] {
    const props: string[] = [];

    // Extract props from defineProps
    const definePropsMatch = componentContent.match(
      /defineProps\s*\(\s*\{([^}]*)\}/
    );
    if (definePropsMatch && definePropsMatch[1]) {
      const propsBlock = definePropsMatch[1];
      const propMatches = propsBlock.matchAll(/(\w+)\s*:/g);
      for (const match of propMatches) {
        if (match[1]) {
          props.push(match[1]);
        }
      }
    }

    // Extract props from props option
    const propsOptionMatch = componentContent.match(/props\s*:\s*\{([^}]*)\}/);
    if (propsOptionMatch && propsOptionMatch[1]) {
      const propsBlock = propsOptionMatch[1];
      const propMatches = propsBlock.matchAll(/(\w+)\s*:/g);
      for (const match of propMatches) {
        if (match[1]) {
          props.push(match[1]);
        }
      }
    }

    return props;
  }

  private detectComposables(componentContent: string): boolean {
    const composablePatterns = [
      "useState",
      "useAsyncData",
      "useFetch",
      "useRoute",
      "useRouter",
      "useNuxtApp",
      "useRuntimeConfig",
      "useError",
      "useHead",
    ];

    return composablePatterns.some((pattern) =>
      componentContent.includes(pattern)
    );
  }

  private getDefaultValueForProp(propName: string): string {
    // Generate sensible default values based on prop name
    if (
      propName.toLowerCase().includes("enabled") ||
      propName.toLowerCase().includes("visible") ||
      propName.toLowerCase().includes("active")
    ) {
      return "true";
    } else if (
      propName.toLowerCase().includes("id") ||
      propName.toLowerCase().includes("name") ||
      propName.toLowerCase().includes("title") ||
      propName.toLowerCase().includes("label")
    ) {
      return `'Test ${propName}'`;
    } else if (
      propName.toLowerCase().includes("count") ||
      propName.toLowerCase().includes("index") ||
      propName.toLowerCase().includes("limit")
    ) {
      return "1";
    } else if (
      propName.toLowerCase().includes("items") ||
      propName.toLowerCase().includes("options") ||
      propName.toLowerCase().includes("data")
    ) {
      return "[]";
    } else {
      return `'test-${propName}'`;
    }
  }

  private getRelativeImportPath(componentFilePath: string): string {
    // Convert absolute path to relative import path
    const fileName = path.basename(componentFilePath);
    return `./${fileName}`;
  }

  private pascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  // Generate a template for a new Vue component
  private generateVueComponentTemplate(componentName: string): string {
    return `<template>
  <div class="${this.kebabCase(componentName)}">
    <h2>{{ title }}</h2>
    <slot></slot>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '${componentName}'
  }
});
</script>

<style scoped>
.${this.kebabCase(componentName)} {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
`;
  }

  // Convert a string to kebab-case
  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }
}
