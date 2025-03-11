# Using NuxTest Extension with Nuxt 3

This guide will walk you through setting up and using the NuxTest extension with your Nuxt 3 project.

## Setting Up Testing in Nuxt 3

Before using the NuxTest extension, make sure your Nuxt project is properly set up for testing:

### 1. Install Testing Dependencies

```bash
npm i --save-dev @nuxt/test-utils vitest @vue/test-utils happy-dom
# Or with yarn
yarn add --dev @nuxt/test-utils vitest @vue/test-utils happy-dom
# Or with pnpm
pnpm add -D @nuxt/test-utils vitest @vue/test-utils happy-dom
```

### 2. Add the Test Module to Your Nuxt Configuration

This step is optional but recommended for better integration with Nuxt DevTools:

```js
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@nuxt/test-utils/module"],
});
```

### 3. Create a Vitest Configuration File

Create a `vitest.config.ts` file in your project root:

```typescript
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  // Any custom Vitest config you require
  test: {
    environment: "happy-dom",
    include: ["**/*.{test,spec}.{js,ts,jsx,tsx}"],
    globals: true,
  },
});
```

### 4. Add a Test Script to Your package.json

```json
"scripts": {
  "test": "vitest"
}
```

## Writing Tests for Nuxt 3

### Component Tests

Create test files with the `.spec.ts` or `.test.ts` extension:

```typescript
// components/MyComponent.spec.ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MyComponent from "./MyComponent.vue";

describe("MyComponent", () => {
  it("renders correctly", () => {
    const wrapper = mount(MyComponent);
    expect(wrapper.exists()).toBe(true);
  });
});
```

### Testing with Nuxt Environment

If you need to test code that relies on Nuxt composables or the Nuxt context:

```typescript
// @vitest-environment nuxt
import { describe, it, expect } from "vitest";
import { useNuxtApp } from "#app";

describe("Nuxt Composable", () => {
  it("can access Nuxt app", () => {
    const nuxtApp = useNuxtApp();
    expect(nuxtApp).toBeDefined();
  });
});
```

## Using the NuxTest Extension

Once your project is set up for testing, you can use the NuxTest extension to run tests directly from VS Code:

### Running a Specific Test

1. Open a test file (`.spec.ts` or `.test.ts`)
2. Place your cursor on or inside a test block
3. Right-click and select "NuxTest: Run Test at Cursor" from the context menu
4. Alternatively, use the command palette (Ctrl+Shift+P or Cmd+Shift+P) and search for "NuxTest: Run Test at Cursor"

### Running All Tests in a File

1. Open a test file
2. Right-click in the editor and select "NuxTest: Run Current Test File"
3. Or select the file in the explorer, right-click and select "NuxTest: Run Current Test File"

### Running All Tests in the Project

1. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Search for "NuxTest: Run All Tests"

## Viewing Test Results

Test results will be displayed in the VS Code output panel in the "NuxTest" channel.

## Troubleshooting

If you encounter any issues:

1. Make sure your test files follow the naming convention (`.spec.ts` or `.test.ts`)
2. Check that Vitest and @nuxt/test-utils are properly installed
3. Verify your vitest.config.ts file is correctly configured
4. Try running tests from the command line using `npm test` or `npx vitest` to see if the issue is with the extension or your test setup
