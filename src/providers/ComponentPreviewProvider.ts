import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Provider for the Component Test Preview webview panel
 */
export class ComponentPreviewProvider {
  public static readonly viewType = "nuxtest.componentPreview";

  private _panel: vscode.WebviewPanel | undefined;
  private _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentComponent: string | undefined;
  private _currentState: any | undefined;
  private _viewportSize: { width: number; height: number } = {
    width: 375,
    height: 667,
  }; // Default to mobile size

  constructor(private context: vscode.ExtensionContext) {
    this._extensionUri = context.extensionUri;
  }

  /**
   * Show the component preview panel
   */
  public show(componentPath?: string, initialState?: any) {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this._panel) {
      // If we already have a panel, show it in the target column
      this._panel.reveal(columnToShowIn);
    } else {
      // Otherwise, create a new panel
      this._panel = vscode.window.createWebviewPanel(
        ComponentPreviewProvider.viewType,
        "Component Preview",
        columnToShowIn || vscode.ViewColumn.Two,
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          // Restrict the webview to only load resources from the extension's directory
          localResourceRoots: [this._extensionUri],
          // Retain context when hidden
          retainContextWhenHidden: true,
        }
      );

      // Set the webview's initial html content
      this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

      // Listen for when the panel is disposed
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

      // Handle messages from the webview
      this._panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case "changeViewport":
              this._viewportSize = message.size;
              this.updatePreview(this._currentComponent, this._currentState);
              break;
            case "interactWithComponent":
              // Handle component interaction
              vscode.window.showInformationMessage(
                `Interacted with component: ${message.detail}`
              );
              break;
          }
        },
        null,
        this._disposables
      );
    }

    // Update the preview if a component path is provided
    if (componentPath) {
      this.updatePreview(componentPath, initialState);
    }
  }

  /**
   * Update the component preview
   */
  public updatePreview(componentPath?: string, state?: any) {
    if (!this._panel) {
      return;
    }

    this._currentComponent = componentPath || this._currentComponent;
    this._currentState = state || this._currentState;

    if (!this._currentComponent) {
      this._panel.webview.postMessage({
        command: "noComponent",
        message: "No component selected for preview",
      });
      return;
    }

    // Check if the component file exists
    if (!fs.existsSync(this._currentComponent)) {
      this._panel.webview.postMessage({
        command: "error",
        message: `Component file not found: ${this._currentComponent}`,
      });
      return;
    }

    // Read the component file
    const componentContent = fs.readFileSync(this._currentComponent, "utf8");

    // Extract the component name from the file path
    const componentName = path.basename(
      this._currentComponent,
      path.extname(this._currentComponent)
    );

    // Send the component data to the webview
    this._panel.webview.postMessage({
      command: "updateComponent",
      componentName,
      componentPath: this._currentComponent,
      componentContent,
      state: this._currentState,
      viewportSize: this._viewportSize,
    });
  }

  /**
   * Set the viewport size for the preview
   */
  public setViewportSize(width: number, height: number) {
    this._viewportSize = { width, height };
    this.updatePreview();
  }

  /**
   * Dispose of the resources
   */
  public dispose() {
    // Clean up resources
    if (this._panel) {
      this._panel.dispose();
      this._panel = undefined;
    }

    // Dispose of all disposables
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Get the HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the local path to main script run in the webview
    const scriptPathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "componentPreview.js"
    );
    const stylePathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "componentPreview.css"
    );
    const vueScriptPathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "vue.global.js"
    );

    // And the uri we'll use to load this script in the webview
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
    const styleUri = webview.asWebviewUri(stylePathOnDisk);
    const vueScriptUri = webview.asWebviewUri(vueScriptPathOnDisk);

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Component Preview</title>
      <link href="${styleUri}" rel="stylesheet">
      <script nonce="${nonce}" src="${vueScriptUri}"></script>
    </head>
    <body>
      <div id="app">
        <div class="toolbar">
          <div class="viewport-selector">
            <button @click="setViewport('mobile')" :class="{ active: currentViewport === 'mobile' }" title="Mobile (375x667)">
              <i class="codicon codicon-device-mobile"></i>
            </button>
            <button @click="setViewport('tablet')" :class="{ active: currentViewport === 'tablet' }" title="Tablet (768x1024)">
              <i class="codicon codicon-device-tablet"></i>
            </button>
            <button @click="setViewport('desktop')" :class="{ active: currentViewport === 'desktop' }" title="Desktop (1280x800)">
              <i class="codicon codicon-device-desktop"></i>
            </button>
          </div>
          <div class="component-info" v-if="componentName">
            <span class="component-name">{{ componentName }}</span>
            <span class="component-state" v-if="hasState">State: {{ stateDescription }}</span>
          </div>
        </div>
        <div class="preview-container" :style="previewContainerStyle">
          <div class="preview-frame" :style="previewFrameStyle">
            <div v-if="!componentName" class="no-component">
              <p>No component selected for preview</p>
              <p>Run a component test to see the preview</p>
            </div>
            <div v-else id="component-mount"></div>
          </div>
        </div>
      </div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
}

/**
 * Generate a nonce string
 */
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
