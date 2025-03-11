// @ts-check

// Get access to the VS Code API from the webview
const vscode = acquireVsCodeApi();

// Create Vue app
const app = Vue.createApp({
  data() {
    return {
      componentName: "",
      componentPath: "",
      componentContent: "",
      state: null,
      error: null,
      currentViewport: "mobile",
      viewports: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1280, height: 800 },
      },
    };
  },
  computed: {
    hasState() {
      return this.state !== null && Object.keys(this.state).length > 0;
    },
    stateDescription() {
      if (!this.hasState) return "";
      return JSON.stringify(this.state);
    },
    previewContainerStyle() {
      return {
        padding: "20px",
        overflow: "auto",
      };
    },
    previewFrameStyle() {
      const viewport = this.viewports[this.currentViewport];
      return {
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
        margin: "0 auto",
        border: "1px solid var(--vscode-panel-border)",
        overflow: "auto",
        position: "relative",
      };
    },
  },
  methods: {
    setViewport(type) {
      this.currentViewport = type;
      vscode.postMessage({
        command: "changeViewport",
        size: this.viewports[type],
      });
    },
    renderComponent() {
      if (!this.componentContent) return;

      try {
        // Clear previous component
        const mountEl = document.getElementById("component-mount");
        if (mountEl) {
          mountEl.innerHTML = "";
        }

        // Create a script element to compile the component
        const script = document.createElement("script");
        script.textContent = `
          try {
            // Extract the component options from the Vue SFC
            const template = ${JSON.stringify(this.extractTemplate())};
            const script = ${JSON.stringify(this.extractScript())};
            
            // Create a component definition
            const componentDef = {
              template,
              data() {
                return ${JSON.stringify(this.state || {})};
              }
            };
            
            // Evaluate the script content if available
            if (script) {
              try {
                const scriptFn = new Function('Vue', 'component', script);
                scriptFn(Vue, componentDef);
              } catch (e) {
                console.error('Error evaluating component script:', e);
              }
            }
            
            // Mount the component
            const app = Vue.createApp(componentDef);
            app.mount('#component-mount');
          } catch (e) {
            console.error('Error rendering component:', e);
          }
        `;

        document.body.appendChild(script);
        document.body.removeChild(script);
      } catch (err) {
        console.error("Failed to render component:", err);
        this.error = err.message;
      }
    },
    extractTemplate() {
      // Simple extraction of template from Vue SFC
      const templateMatch = this.componentContent.match(
        /<template>([\s\S]*?)<\/template>/i
      );
      return templateMatch
        ? templateMatch[1].trim()
        : "<div>No template found</div>";
    },
    extractScript() {
      // Simple extraction of script from Vue SFC
      const scriptMatch = this.componentContent.match(
        /<script>([\s\S]*?)<\/script>/i
      );
      return scriptMatch ? scriptMatch[1].trim() : "";
    },
  },
  mounted() {
    // Handle messages from the extension
    window.addEventListener("message", (event) => {
      const message = event.data;

      switch (message.command) {
        case "updateComponent":
          this.componentName = message.componentName;
          this.componentPath = message.componentPath;
          this.componentContent = message.componentContent;
          this.state = message.state;
          this.error = null;

          // Set viewport size if provided
          if (message.viewportSize) {
            // Find the closest viewport
            const sizes = Object.entries(this.viewports);
            let closestViewport = "mobile";
            let minDiff = Infinity;

            for (const [name, size] of sizes) {
              const diff =
                Math.abs(size.width - message.viewportSize.width) +
                Math.abs(size.height - message.viewportSize.height);
              if (diff < minDiff) {
                minDiff = diff;
                closestViewport = name;
              }
            }

            this.currentViewport = closestViewport;
          }

          // Render the component after a short delay to ensure the DOM is updated
          setTimeout(() => this.renderComponent(), 100);
          break;

        case "error":
          this.error = message.message;
          break;

        case "noComponent":
          this.componentName = "";
          this.componentPath = "";
          this.componentContent = "";
          this.state = null;
          break;
      }
    });

    // Tell the extension we're ready
    vscode.postMessage({ command: "ready" });
  },
});

// Mount the Vue app
app.mount("#app");
