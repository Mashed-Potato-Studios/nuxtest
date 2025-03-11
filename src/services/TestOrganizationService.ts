import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TestTag, SystemTags } from "../models/TestTag";
import { TestFilter, FilterPresets } from "../models/TestFilter";
import { Test } from "../models/Test";

/**
 * Service for managing test organization features like tags and filters
 */
export class TestOrganizationService {
  private static instance: TestOrganizationService;
  private context: vscode.ExtensionContext;
  private tags: Map<string, TestTag> = new Map();
  private filters: Map<string, TestFilter> = new Map();
  private testTags: Map<string, string[]> = new Map(); // Map of test ID to tag IDs
  private testCategories: Map<string, string> = new Map(); // Map of test ID to category
  private testFeatureComponents: Map<string, string> = new Map(); // Map of test ID to feature/component

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initialize();
  }

  /**
   * Get the singleton instance of the service
   */
  public static getInstance(
    context: vscode.ExtensionContext
  ): TestOrganizationService {
    if (!TestOrganizationService.instance) {
      TestOrganizationService.instance = new TestOrganizationService(context);
    }
    return TestOrganizationService.instance;
  }

  /**
   * Initialize the service
   */
  private initialize(): void {
    // Load system tags
    Object.values(SystemTags).forEach((tag) => {
      this.tags.set(tag.id, tag);
    });

    // Load custom tags from storage
    const customTags = this.context.globalState.get<TestTag[]>(
      "nuxtest.customTags",
      []
    );
    customTags.forEach((tag) => {
      this.tags.set(tag.id, tag);
    });

    // Load filter presets
    FilterPresets.forEach((filter) => {
      this.filters.set(filter.id, filter);
    });

    // Load custom filters from storage
    const customFilters = this.context.globalState.get<TestFilter[]>(
      "nuxtest.customFilters",
      []
    );
    customFilters.forEach((filter) => {
      this.filters.set(filter.id, filter);
    });

    // Load test tags from storage
    const savedTestTags = this.context.globalState.get<{
      [key: string]: string[];
    }>("nuxtest.testTags", {});
    Object.entries(savedTestTags).forEach(([testId, tagIds]) => {
      this.testTags.set(testId, tagIds);
    });

    // Load test categories from storage
    const savedTestCategories = this.context.globalState.get<{
      [key: string]: string;
    }>("nuxtest.testCategories", {});
    Object.entries(savedTestCategories).forEach(([testId, category]) => {
      this.testCategories.set(testId, category);
    });

    // Load test feature/components from storage
    const savedTestFeatureComponents = this.context.globalState.get<{
      [key: string]: string;
    }>("nuxtest.testFeatureComponents", {});
    Object.entries(savedTestFeatureComponents).forEach(
      ([testId, featureComponent]) => {
        this.testFeatureComponents.set(testId, featureComponent);
      }
    );

    // Auto-detect tags for tests based on file content and path
    this.autoDetectTags();
  }

  /**
   * Auto-detect tags for tests based on file content and path
   */
  private autoDetectTags(): void {
    // This would scan test files and automatically assign tags based on patterns
    // For example, tests in e2e/ folders would get the E2E tag
    // Tests that use mount() would get the COMPONENT tag
    // This is a simplified implementation
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return;
    }

    // Find test files
    vscode.workspace
      .findFiles("**/*.spec.{ts,js,vue}", "**/node_modules/**")
      .then((uris) => {
        uris.forEach((uri) => {
          const filePath = uri.fsPath;

          // Auto-detect test type based on path
          if (
            filePath.includes("e2e") ||
            filePath.includes("cypress") ||
            filePath.includes("playwright")
          ) {
            // E2E test
            this.addTagToFile(filePath, SystemTags.E2E.id);
          } else if (
            filePath.includes("unit") ||
            filePath.includes("utils") ||
            filePath.includes("helpers")
          ) {
            // Unit test
            this.addTagToFile(filePath, SystemTags.UNIT.id);
          } else if (
            filePath.includes("api") ||
            filePath.includes("endpoints")
          ) {
            // API test
            this.addTagToFile(filePath, SystemTags.API.id);
          }

          // Read file content to detect component tests
          try {
            const content = fs.readFileSync(filePath, "utf8");
            if (
              content.includes("mount(") ||
              content.includes("shallowMount(") ||
              content.includes("@vue/test-utils") ||
              content.includes("render(")
            ) {
              // Component test
              this.addTagToFile(filePath, SystemTags.COMPONENT.id);
            }

            // Auto-detect feature or component
            const componentMatch = content.match(
              /import\s+(\w+)\s+from\s+['"](.+?\.vue)['"]/
            );
            if (componentMatch) {
              const componentName = componentMatch[1];
              // Store component name for all tests in this file
              this.addFeatureComponentToFile(filePath, componentName);
            }
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
          }
        });
      });
  }

  /**
   * Add a tag to all tests in a file
   */
  private addTagToFile(filePath: string, tagId: string): void {
    // This would add the tag to all tests in the file
    // In a real implementation, you would parse the file to find individual tests
    // For simplicity, we're just using the file path as a key
    const existingTags = this.testTags.get(filePath) || [];
    if (!existingTags.includes(tagId)) {
      existingTags.push(tagId);
      this.testTags.set(filePath, existingTags);
      this.saveTestTags();
    }
  }

  /**
   * Add a feature/component to all tests in a file
   */
  private addFeatureComponentToFile(
    filePath: string,
    featureComponent: string
  ): void {
    this.testFeatureComponents.set(filePath, featureComponent);
    this.saveTestFeatureComponents();
  }

  /**
   * Get all available tags
   */
  public getAllTags(): TestTag[] {
    return Array.from(this.tags.values());
  }

  /**
   * Get all available filters
   */
  public getAllFilters(): TestFilter[] {
    return Array.from(this.filters.values());
  }

  /**
   * Get tags for a test
   */
  public getTagsForTest(test: Test): TestTag[] {
    const tagIds = this.testTags.get(test.id) || [];
    return tagIds
      .map((id) => this.tags.get(id))
      .filter((tag) => tag !== undefined) as TestTag[];
  }

  /**
   * Add a tag to a test
   */
  public addTagToTest(test: Test, tagId: string): void {
    const existingTags = this.testTags.get(test.id) || [];
    if (!existingTags.includes(tagId)) {
      existingTags.push(tagId);
      this.testTags.set(test.id, existingTags);
      this.saveTestTags();
    }
  }

  /**
   * Remove a tag from a test
   */
  public removeTagFromTest(test: Test, tagId: string): void {
    const existingTags = this.testTags.get(test.id) || [];
    const updatedTags = existingTags.filter((id) => id !== tagId);
    this.testTags.set(test.id, updatedTags);
    this.saveTestTags();
  }

  /**
   * Create a new custom tag
   */
  public createTag(
    name: string,
    color?: string,
    description?: string
  ): TestTag {
    let id = name.toLowerCase().replace(/\s+/g, "-");

    // Check if the ID already exists and add a suffix if needed
    if (this.tags.has(id)) {
      let suffix = 1;
      while (this.tags.has(`${id}-${suffix}`)) {
        suffix++;
      }
      id = `${id}-${suffix}`;
    }

    const tag: TestTag = {
      id,
      name,
      color,
      description,
    };
    this.tags.set(id, tag);
    this.saveCustomTags();
    return tag;
  }

  /**
   * Delete a custom tag
   */
  public deleteTag(tagId: string): boolean {
    // Can't delete system tags
    if (Object.values(SystemTags).some((tag) => tag.id === tagId)) {
      return false;
    }

    const result = this.tags.delete(tagId);
    if (result) {
      // Remove the tag from all tests
      this.testTags.forEach((tagIds, testId) => {
        this.testTags.set(
          testId,
          tagIds.filter((id) => id !== tagId)
        );
      });
      this.saveCustomTags();
      this.saveTestTags();
    }
    return result;
  }

  /**
   * Create a new filter preset
   */
  public createFilterPreset(name: string, criteria: any): TestFilter {
    let id = name.toLowerCase().replace(/\s+/g, "-");

    // Check if the ID already exists and add a suffix if needed
    if (this.filters.has(id)) {
      let suffix = 1;
      while (this.filters.has(`${id}-${suffix}`)) {
        suffix++;
      }
      id = `${id}-${suffix}`;
    }

    const filter: TestFilter = {
      id,
      name,
      isPreset: false,
      criteria,
    };
    this.filters.set(id, filter);
    this.saveCustomFilters();
    return filter;
  }

  /**
   * Delete a filter preset
   */
  public deleteFilterPreset(filterId: string): boolean {
    // Can't delete system presets
    const filter = this.filters.get(filterId);
    if (!filter || filter.isPreset) {
      return false;
    }

    const result = this.filters.delete(filterId);
    if (result) {
      this.saveCustomFilters();
    }
    return result;
  }

  /**
   * Set the category for a test
   */
  public setCategoryForTest(test: Test, category: string): void {
    this.testCategories.set(test.id, category);
    this.saveTestCategories();
  }

  /**
   * Get the category for a test
   */
  public getCategoryForTest(test: Test): string | undefined {
    return this.testCategories.get(test.id);
  }

  /**
   * Set the feature/component for a test
   */
  public setFeatureComponentForTest(
    test: Test,
    featureComponent: string
  ): void {
    this.testFeatureComponents.set(test.id, featureComponent);
    this.saveTestFeatureComponents();
  }

  /**
   * Get the feature/component for a test
   */
  public getFeatureComponentForTest(test: Test): string | undefined {
    return this.testFeatureComponents.get(test.id);
  }

  /**
   * Apply a filter to a list of tests
   */
  public applyFilter(tests: Test[], filterId: string): Test[] {
    const filter = this.filters.get(filterId);
    if (!filter) {
      return tests;
    }

    return this.filterTests(tests, filter.criteria);
  }

  /**
   * Filter tests based on criteria
   */
  public filterTests(tests: Test[], criteria: any): Test[] {
    return tests.filter((test) => {
      // Filter by tags
      if (criteria.tagIds && criteria.tagIds.length > 0) {
        const testTagIds = this.testTags.get(test.id) || [];
        if (
          !criteria.tagIds.some((tagId: string) => testTagIds.includes(tagId))
        ) {
          return false;
        }
      }

      // Filter by status
      if (criteria.status && criteria.status.length > 0) {
        if (!criteria.status.includes(test.status)) {
          return false;
        }
      }

      // Filter by test name
      if (
        criteria.testName &&
        !test.name.toLowerCase().includes(criteria.testName.toLowerCase())
      ) {
        return false;
      }

      // Filter by file path
      if (
        criteria.filePath &&
        !test.filePath.toLowerCase().includes(criteria.filePath.toLowerCase())
      ) {
        return false;
      }

      // Filter by duration
      if (
        criteria.minDuration !== undefined &&
        (test.duration === undefined || test.duration < criteria.minDuration)
      ) {
        return false;
      }
      if (
        criteria.maxDuration !== undefined &&
        (test.duration === undefined || test.duration > criteria.maxDuration)
      ) {
        return false;
      }

      // Filter by feature/component
      if (criteria.featureOrComponent) {
        const testFeatureComponent = this.testFeatureComponents.get(test.id);
        if (
          !testFeatureComponent ||
          !testFeatureComponent
            .toLowerCase()
            .includes(criteria.featureOrComponent.toLowerCase())
        ) {
          return false;
        }
      }

      // Filter by category
      if (criteria.category) {
        const testCategory = this.testCategories.get(test.id);
        if (
          !testCategory ||
          !testCategory.toLowerCase().includes(criteria.category.toLowerCase())
        ) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Group tests by a specific property
   */
  public groupTests(
    tests: Test[],
    groupBy: "tag" | "status" | "feature" | "category"
  ): { [key: string]: Test[] } {
    const groups: { [key: string]: Test[] } = {};

    tests.forEach((test) => {
      let groupKeys: string[] = [];

      switch (groupBy) {
        case "tag":
          groupKeys = this.testTags.get(test.id) || ["untagged"];
          break;
        case "status":
          groupKeys = [test.status];
          break;
        case "feature":
          const feature = this.testFeatureComponents.get(test.id);
          groupKeys = feature ? [feature] : ["uncategorized"];
          break;
        case "category":
          const category = this.testCategories.get(test.id);
          groupKeys = category ? [category] : ["uncategorized"];
          break;
      }

      // Add test to each group it belongs to
      groupKeys.forEach((key) => {
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(test);
      });
    });

    return groups;
  }

  /**
   * Save custom tags to storage
   */
  private saveCustomTags(): void {
    const customTags = Array.from(this.tags.values()).filter(
      (tag) =>
        !Object.values(SystemTags).some((systemTag) => systemTag.id === tag.id)
    );
    this.context.globalState.update("nuxtest.customTags", customTags);
  }

  /**
   * Save custom filters to storage
   */
  private saveCustomFilters(): void {
    const customFilters = Array.from(this.filters.values()).filter(
      (filter) => !filter.isPreset
    );
    this.context.globalState.update("nuxtest.customFilters", customFilters);
  }

  /**
   * Save test tags to storage
   */
  private saveTestTags(): void {
    const testTagsObj: { [key: string]: string[] } = {};
    this.testTags.forEach((tagIds, testId) => {
      testTagsObj[testId] = tagIds;
    });
    this.context.globalState.update("nuxtest.testTags", testTagsObj);
  }

  /**
   * Save test categories to storage
   */
  private saveTestCategories(): void {
    const testCategoriesObj: { [key: string]: string } = {};
    this.testCategories.forEach((category, testId) => {
      testCategoriesObj[testId] = category;
    });
    this.context.globalState.update(
      "nuxtest.testCategories",
      testCategoriesObj
    );
  }

  /**
   * Save test feature/components to storage
   */
  private saveTestFeatureComponents(): void {
    const testFeatureComponentsObj: { [key: string]: string } = {};
    this.testFeatureComponents.forEach((featureComponent, testId) => {
      testFeatureComponentsObj[testId] = featureComponent;
    });
    this.context.globalState.update(
      "nuxtest.testFeatureComponents",
      testFeatureComponentsObj
    );
  }
}
