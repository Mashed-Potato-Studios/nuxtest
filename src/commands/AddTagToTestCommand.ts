import * as vscode from "vscode";
import { TestOrganizationService } from "../services/TestOrganizationService";
import { Test } from "../models/Test";

/**
 * Command to add a tag to a test
 */
export class AddTagToTestCommand {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Execute the command
   * @param test The test to add a tag to
   */
  public async execute(test: Test): Promise<void> {
    try {
      if (!test) {
        vscode.window.showErrorMessage("No test selected");
        return;
      }

      // Get the service
      const service = TestOrganizationService.getInstance(this.context);

      // Get all available tags
      const tags = service.getAllTags();

      // Get tags already applied to the test
      const appliedTags = service.getTagsForTest(test);
      const appliedTagIds = appliedTags.map((tag) => tag.id);

      // Filter out already applied tags
      const availableTags = tags.filter(
        (tag) => !appliedTagIds.includes(tag.id)
      );

      if (availableTags.length === 0) {
        vscode.window.showInformationMessage(
          "All available tags are already applied to this test"
        );
        return;
      }

      // Let the user select a tag
      const selectedTag = await vscode.window.showQuickPick(
        availableTags.map((tag) => ({
          label: tag.name,
          description: tag.description,
          id: tag.id,
        })),
        {
          placeHolder: "Select a tag to add to the test",
        }
      );

      if (!selectedTag) {
        return; // User cancelled
      }

      // Add the tag to the test
      service.addTagToTest(test, selectedTag.id);

      vscode.window.showInformationMessage(
        `Tag "${selectedTag.label}" added to test "${test.name}"`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add tag to test: ${error}`);
    }
  }
}
