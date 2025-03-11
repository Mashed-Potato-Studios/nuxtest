import * as vscode from 'vscode';
import { TestOrganizationService } from '../services/TestOrganizationService';

/**
 * Command to create a new tag
 */
export class CreateTagCommand {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Execute the command
   */
  public async execute(): Promise<void> {
    try {
      // Get the tag name
      const tagName = await vscode.window.showInputBox({
        prompt: 'Enter a name for the new tag',
        placeHolder: 'Tag name',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Tag name cannot be empty';
          }
          return null;
        }
      });

      if (!tagName) {
        return; // User cancelled
      }

      // Get the tag color
      const colorOptions = [
        { label: 'Red', color: '#ff5252' },
        { label: 'Green', color: '#4caf50' },
        { label: 'Blue', color: '#2196f3' },
        { label: 'Yellow', color: '#ffeb3b' },
        { label: 'Purple', color: '#9c27b0' },
        { label: 'Orange', color: '#ff9800' },
        { label: 'Teal', color: '#009688' },
        { label: 'Pink', color: '#e91e63' },
        { label: 'Custom...', color: '' }
      ];

      const colorSelection = await vscode.window.showQuickPick(
        colorOptions.map(option => ({
          label: option.label,
          description: option.color,
          color: option.color
        })),
        {
          placeHolder: 'Select a color for the tag'
        }
      );

      if (!colorSelection) {
        return; // User cancelled
      }

      let tagColor = colorSelection.color;

      // If custom color was selected, prompt for hex code
      if (colorSelection.label === 'Custom...') {
        tagColor = await vscode.window.showInputBox({
          prompt: 'Enter a hex color code for the tag',
          placeHolder: '#rrggbb',
          validateInput: (value) => {
            if (!value || !value.match(/^#[0-9a-fA-F]{6}$/)) {
              return 'Please enter a valid hex color code (e.g., #ff0000)';
            }
            return null;
          }
        }) || '';

        if (!tagColor) {
          return; // User cancelled
        }
      }

      // Get the tag description
      const tagDescription = await vscode.window.showInputBox({
        prompt: 'Enter a description for the tag (optional)',
        placeHolder: 'Tag description'
      });

      // Create the tag
      const service = TestOrganizationService.getInstance(this.context);
      const tag = service.createTag(tagName, tagColor, tagDescription || undefined);

      vscode.window.showInformationMessage(`Tag "${tag.name}" created successfully`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create tag: ${error}`);
    }
  }
} 