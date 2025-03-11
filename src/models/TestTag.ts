/**
 * Represents a tag that can be applied to tests for categorization
 */
export interface TestTag {
  /** Unique identifier for the tag */
  id: string;

  /** Display name of the tag */
  name: string;

  /** Optional color for the tag (hex code) */
  color?: string;

  /** Optional description of the tag */
  description?: string;
}

/**
 * Predefined system tags
 */
export const SystemTags: { [key: string]: TestTag } = {
  UNIT: {
    id: "unit",
    name: "Unit",
    color: "#42b883",
    description: "Unit tests that test individual functions or components",
  },
  INTEGRATION: {
    id: "integration",
    name: "Integration",
    color: "#3eaf7c",
    description: "Tests that verify multiple components working together",
  },
  E2E: {
    id: "e2e",
    name: "E2E",
    color: "#2c3e50",
    description: "End-to-end tests that test the entire application",
  },
  COMPONENT: {
    id: "component",
    name: "Component",
    color: "#1d9bf0",
    description: "Tests that verify Vue component behavior",
  },
  API: {
    id: "api",
    name: "API",
    color: "#ff7e67",
    description: "Tests that verify API endpoints",
  },
  SLOW: {
    id: "slow",
    name: "Slow",
    color: "#ff5252",
    description: "Tests that take a long time to run",
  },
  FAST: {
    id: "fast",
    name: "Fast",
    color: "#4caf50",
    description: "Tests that run quickly",
  },
  FLAKY: {
    id: "flaky",
    name: "Flaky",
    color: "#ff9800",
    description: "Tests that sometimes pass and sometimes fail",
  },
};
