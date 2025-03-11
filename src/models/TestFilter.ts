import { TestStatus } from "./TestStatus";

/**
 * Represents a filter that can be applied to tests
 */
export interface TestFilter {
  /** Unique identifier for the filter */
  id: string;

  /** Display name of the filter */
  name: string;

  /** Whether this is a preset filter */
  isPreset: boolean;

  /** Filter criteria */
  criteria: TestFilterCriteria;
}

/**
 * Criteria for filtering tests
 */
export interface TestFilterCriteria {
  /** Filter by tag IDs */
  tagIds?: string[];

  /** Filter by test status */
  status?: TestStatus[];

  /** Filter by test name (substring match) */
  testName?: string;

  /** Filter by file path (substring match) */
  filePath?: string;

  /** Filter by minimum duration in ms */
  minDuration?: number;

  /** Filter by maximum duration in ms */
  maxDuration?: number;

  /** Filter by feature or component name */
  featureOrComponent?: string;

  /** Custom category name */
  category?: string;
}

/**
 * Predefined filter presets
 */
export const FilterPresets: TestFilter[] = [
  {
    id: "all",
    name: "All Tests",
    isPreset: true,
    criteria: {},
  },
  {
    id: "unit",
    name: "Unit Tests",
    isPreset: true,
    criteria: {
      tagIds: ["unit"],
    },
  },
  {
    id: "component",
    name: "Component Tests",
    isPreset: true,
    criteria: {
      tagIds: ["component"],
    },
  },
  {
    id: "e2e",
    name: "E2E Tests",
    isPreset: true,
    criteria: {
      tagIds: ["e2e"],
    },
  },
  {
    id: "failed",
    name: "Failed Tests",
    isPreset: true,
    criteria: {
      status: ["failed"],
    },
  },
  {
    id: "passed",
    name: "Passed Tests",
    isPreset: true,
    criteria: {
      status: ["passed"],
    },
  },
  {
    id: "slow",
    name: "Slow Tests (>500ms)",
    isPreset: true,
    criteria: {
      minDuration: 500,
    },
  },
  {
    id: "fast",
    name: "Fast Tests (<100ms)",
    isPreset: true,
    criteria: {
      maxDuration: 100,
    },
  },
  {
    id: "flaky",
    name: "Flaky Tests",
    isPreset: true,
    criteria: {
      tagIds: ["flaky"],
    },
  },
];
