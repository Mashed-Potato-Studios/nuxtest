/**
 * Vue.js v3.3.4
 * (c) 2018-present Yuxi (Evan) You and Vue contributors
 * @license MIT
 *
 * This is a placeholder file. In a real extension, you would include the actual Vue.js library.
 * For development purposes, we're creating a minimal implementation that allows the preview to work.
 */

(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
    ? define(factory)
    : ((global =
        typeof globalThis !== "undefined" ? globalThis : global || self),
      (global.Vue = factory()));
})(this, function () {
  "use strict";

  // Minimal Vue implementation for component preview
  const Vue = {
    createApp(options) {
      console.log("Creating Vue app with options:", options);

      return {
        mount(el) {
          console.log("Mounting Vue app to element:", el);

          try {
            // Render the template
            if (options.template) {
              el.innerHTML = options.template;
            } else {
              el.innerHTML = "<div>No template provided</div>";
            }

            // Apply any data
            if (options.data && typeof options.data === "function") {
              const data = options.data();
              console.log("Component data:", data);
            }

            console.log("Vue component mounted successfully");
          } catch (error) {
            console.error("Error mounting Vue component:", error);
            el.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
          }

          return {
            unmount() {
              console.log("Unmounting Vue app");
              el.innerHTML = "";
            },
          };
        },
      };
    },
  };

  return Vue;
});
