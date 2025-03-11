import * as vscode from "vscode";
import { TestOrganizationService } from "../services/TestOrganizationService";
import { TestFilterCriteria } from "../models/TestFilter";
import { SystemTags } from "../models/TestTag";

/**
 * Command to create a new filter preset
 */
export class CreateFilterPresetCommand {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Execute the command
   */
  public async execute(): Promise<void> {
    try {
      // Get the filter name
      const filterName = await vscode.window.showInputBox({
        prompt: "Enter a name for the new filter preset",
        placeHolder: "Filter preset name",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return "Filter name cannot be empty";
          }
          return null;
        },
      });

      if (!filterName) {
        return; // User cancelled
      }

      // Create filter criteria
      const criteria: TestFilterCriteria = {};

      // Select tags
      const service = TestOrganizationService.getInstance(this.context);
      const tags = service.getAllTags();

      const selectedTags = await vscode.window.showQuickPick(
        tags.map((tag) => ({
          label: tag.name,
          description: tag.description,
          id: tag.id,
        })),
        {
          placeHolder: "Select tags to include in the filter (optional)",
          canPickMany: true,
        }
      );

      if (selectedTags && selectedTags.length > 0) {
        criteria.tagIds = selectedTags.map((tag) => tag.id);
      }

      // Select status
      const statusOptions = [
        { label: "Passed", value: "passed" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" },
        { label: "Running", value: "running" },
        { label: "Not Run", value: "not-run" },
      ];

      const selectedStatus = await vscode.window.showQuickPick(statusOptions, {
        placeHolder: "Select test statuses to include in the filter (optional)",
        canPickMany: true,
      });

      if (selectedStatus && selectedStatus.length > 0) {
        criteria.status = selectedStatus.map((status) => status.value as any);
      }

      // Test name filter
      const testName = await vscode.window.showInputBox({
        prompt: "Filter by test name (optional)",
        placeHolder: "Enter a substring to match against test names",
      });

      if (testName) {
        criteria.testName = testName;
      }

      // File path filter
      const filePath = await vscode.window.showInputBox({
        prompt: "Filter by file path (optional)",
        placeHolder: "Enter a substring to match against file paths",
      });

      if (filePath) {
        criteria.filePath = filePath;
      }

      // Duration filters
      const minDuration = await vscode.window.showInputBox({
        prompt: "Minimum test duration in milliseconds (optional)",
        placeHolder: "Enter a number",
        validateInput: (value) => {
          if (value && !/^\d+$/.test(value)) {
            return "Please enter a valid number";
          }
          return null;
        },
      });

      if (minDuration) {
        criteria.minDuration = parseInt(minDuration, 10);
      }

      const maxDuration = await vscode.window.showInputBox({
        prompt: "Maximum test duration in milliseconds (optional)",
        placeHolder: "Enter a number",
        validateInput: (value) => {
          if (value && !/^\d+$/.test(value)) {
            return "Please enter a valid number";
          }
          return null;
        },
      });

      if (maxDuration) {
        criteria.maxDuration = parseInt(maxDuration, 10);
      }

      // Feature/Component filter
      const featureOrComponent = await vscode.window.showInputBox({
        prompt: "Filter by feature or component (optional)",
        placeHolder: "Enter a feature or component name",
      });

      if (featureOrComponent) {
        criteria.featureOrComponent = featureOrComponent;
      }

      // Category filter
      const category = await vscode.window.showInputBox({
        prompt: "Filter by category (optional)",
        placeHolder: "Enter a category name",
      });

      if (category) {
        criteria.category = category;
      }

      // Create the filter preset
      const filter = service.createFilterPreset(filterName, criteria);

      vscode.window.showInformationMessage(
        `Filter preset "${filter.name}" created successfully`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create filter preset: ${error}`
      );
    }
  }
}
