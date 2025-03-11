import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Panel for previewing Vue components
 */
export class ComponentPreviewPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: ComponentPreviewPanel | undefined;

  private static readonly viewType = "componentPreview";
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _componentPath: string;

  /**
   * Create or show a component preview panel
   * @param extensionContext The extension context
   * @param componentPath The path to the component file
   */
  public static createOrShow(
    extensionContext: vscode.ExtensionContext,
    componentPath: string
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ComponentPreviewPanel.currentPanel) {
      ComponentPreviewPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      ComponentPreviewPanel.viewType,
      `Preview: ${path.basename(componentPath)}`,
      column || vscode.ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the extension's directory
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionContext.extensionPath, "media")),
        ],
        // Retain context when hidden
        retainContextWhenHidden: true,
      }
    );

    ComponentPreviewPanel.currentPanel = new ComponentPreviewPanel(
      panel,
      extensionContext.extensionUri,
      componentPath
    );
  }

  /**
   * Create a new ComponentPreviewPanel
   * @param panel The webview panel
   * @param extensionUri The extension URI
   * @param componentPath The path to the component file
   */
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    componentPath: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._componentPath = componentPath;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "error":
            vscode.window.showErrorMessage(message.text);
            return;
          case "info":
            vscode.window.showInformationMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );

    // Set up file watcher to auto-update the preview when the component changes
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        path.dirname(componentPath),
        path.basename(componentPath)
      )
    );

    watcher.onDidChange((uri) => {
      if (uri.fsPath === this._componentPath) {
        const content = fs.readFileSync(uri.fsPath, "utf8");
        this.update(uri.fsPath, content);
      }
    });

    this._disposables.push(watcher);
  }

  /**
   * Update the preview with new component content
   * @param componentPath The path to the component file
   * @param content The component file content
   * @param state Optional state to pass to the component
   */
  public update(componentPath: string, content: string, state?: any): void {
    this._componentPath = componentPath;
    this._panel.title = `Preview: ${path.basename(componentPath)}`;

    // Extract the template, script, and style sections from the Vue component
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    const scriptMatch = content.match(/<script.*?>([\s\S]*?)<\/script>/);
    const styleMatch = content.match(/<style.*?>([\s\S]*?)<\/style>/);

    const template = templateMatch ? templateMatch[1].trim() : "";
    const script = scriptMatch ? scriptMatch[1].trim() : "";
    const style = styleMatch ? styleMatch[1].trim() : "";

    // Send the component data to the webview
    this._panel.webview.postMessage({
      command: "updateComponent",
      componentPath,
      template,
      script,
      style,
      state: state || {},
    });
  }

  /**
   * Dispose and clean up panel resources
   */
  public dispose(): void {
    ComponentPreviewPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  /**
   * Update the webview content
   */
  private _update(): void {
    const webview = this._panel.webview;
    this._panel.title = `Preview: ${path.basename(this._componentPath)}`;
    this._panel.webview.html = this._getHtmlForWebview(webview);

    // Read the component file content
    if (fs.existsSync(this._componentPath)) {
      const content = fs.readFileSync(this._componentPath, "utf8");
      this.update(this._componentPath, content);
    }
  }

  /**
   * Get the HTML for the webview
   * @param webview The webview
   * @returns The HTML content
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the local path to vue.js, which we'll use in the webview
    const vueScriptPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "vue.global.js"
    );
    const vueScriptUri = webview.asWebviewUri(vueScriptPath);

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src ${webview.cspSource};">
      <title>Component Preview</title>
      <style>
        body {
          padding: 0;
          margin: 0;
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
        }
        
        .toolbar {
          padding: 8px;
          background-color: var(--vscode-editor-background);
          border-bottom: 1px solid var(--vscode-panel-border);
          display: flex;
          align-items: center;
        }
        
        .toolbar-title {
          font-weight: bold;
          margin-right: 16px;
        }
        
        .preview-container {
          flex: 1;
          padding: 16px;
          overflow: auto;
          display: flex;
          justify-content: center;
        }
        
        .component-container {
          min-width: 300px;
          border: 1px dashed var(--vscode-panel-border);
          padding: 16px;
          border-radius: 4px;
        }
        
        .error-container {
          color: var(--vscode-errorForeground);
          padding: 16px;
          border: 1px solid var(--vscode-errorForeground);
          border-radius: 4px;
          margin: 16px;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <span class="toolbar-title">Component Preview</span>
        <span id="component-name"></span>
      </div>
      
      <div class="preview-container">
        <div id="error-container" class="error-container" style="display: none;"></div>
        <div id="component-container" class="component-container"></div>
      </div>
      
      <script nonce="${nonce}" src="${vueScriptUri}"></script>
      <script nonce="${nonce}">
        (function() {
          const vscode = acquireVsCodeApi();
          let currentComponent = null;
          let currentState = {};
          
          // Handle messages from the extension
          window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
              case 'updateComponent':
                try {
                  updateComponent(
                    message.componentPath,
                    message.template,
                    message.script,
                    message.style,
                    message.state
                  );
                } catch (error) {
                  showError('Error rendering component: ' + error.message);
                  console.error(error);
                }
                break;
            }
          });
          
          function updateComponent(componentPath, template, script, style, state) {
            currentComponent = { path: componentPath, template, script, style };
            currentState = state || {};
            
            // Update component name in toolbar
            const componentName = componentPath.split('/').pop();
            document.getElementById('component-name').textContent = componentName;
            
            // Add component styles
            updateStyles(style);
            
            // Create component
            try {
              renderComponent(template, script, state);
              hideError();
            } catch (error) {
              showError('Error rendering component: ' + error.message);
              console.error(error);
            }
          }
          
          function updateStyles(styleContent) {
            // Remove any existing style element
            const existingStyle = document.getElementById('component-style');
            if (existingStyle) {
              existingStyle.remove();
            }
            
            // Add new style element
            if (styleContent) {
              const styleElement = document.createElement('style');
              styleElement.id = 'component-style';
              styleElement.textContent = styleContent;
              document.head.appendChild(styleElement);
            }
          }
          
          function renderComponent(template, scriptContent, state) {
            const container = document.getElementById('component-container');
            container.innerHTML = '';
            
            // Create a new div for mounting the component
            const mountPoint = document.createElement('div');
            container.appendChild(mountPoint);
            
            // Process the script content to extract component options
            let componentOptions = { template };
            
            if (scriptContent) {
              // Simple approach: extract the component definition
              // This is a simplified approach and may not work for all components
              try {
                // Extract the component definition
                const exportDefaultMatch = scriptContent.match(/export\\s+default\\s+({[\\s\\S]*})/);
                if (exportDefaultMatch) {
                  const componentDefString = exportDefaultMatch[1]
                    .replace(/export\\s+default/, '')
                    .replace(/defineComponent\\(([\\s\\S]*)\\)/, '$1');
                  
                  // Convert to valid JSON-like string (this is a simplification)
                  const jsonLike = componentDefString
                    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure property names are quoted
                    .replace(/'/g, '"') // Replace single quotes with double quotes
                    .replace(/,\\s*}/g, '}') // Remove trailing commas
                    .replace(/,\\s*]/g, ']'); // Remove trailing commas in arrays
                  
                  // Evaluate the component options
                  // Note: This is a simplified approach and has security implications
                  // In a real extension, you would use a proper parser
                  const evalOptions = Function('return ' + jsonLike)();
                  componentOptions = { ...componentOptions, ...evalOptions };
                }
              } catch (error) {
                console.error('Error parsing component script:', error);
                // Continue with just the template if script parsing fails
              }
            }
            
            // Add the template if not already in options
            if (!componentOptions.template) {
              componentOptions.template = template;
            }
            
            // Create and mount the Vue component
            const app = Vue.createApp(componentOptions);
            app.mount(mountPoint);
            
            // Apply state if provided
            if (state && Object.keys(state).length > 0) {
              // This is a simplified approach and may not work for all components
              console.log('Applying state:', state);
            }
          }
          
          function showError(message) {
            const errorContainer = document.getElementById('error-container');
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            
            // Also send the error to the extension
            vscode.postMessage({
              command: 'error',
              text: message
            });
          }
          
          function hideError() {
            const errorContainer = document.getElementById('error-container');
            errorContainer.style.display = 'none';
          }
        }());
      </script>
    </body>
    </html>`;
  }
}

/**
 * Generate a nonce string
 * @returns A random nonce string
 */
function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
