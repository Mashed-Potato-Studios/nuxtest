import * as vscode from "vscode";
import { TestOrganizationService } from "../services/TestOrganizationService";
import { TestTag } from "../models/TestTag";
import { TestFilter } from "../models/TestFilter";
import { Test } from "../models/Test";

/**
 * Tree item for the test organization view
 */
export class TestOrganizationItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly id?: string,
    public readonly command?: vscode.Command,
    public readonly iconPath?: string | vscode.ThemeIcon,
    public readonly description?: string,
    public readonly tooltip?: string
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.command = command;
    this.iconPath = iconPath;
    this.contextValue = contextValue;
    this.description = description;
    this.tooltip = tooltip;
  }
}

/**
 * Provider for the test organization view
 */
export class TestOrganizationProvider
  implements vscode.TreeDataProvider<TestOrganizationItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TestOrganizationItem | undefined | null | void
  > = new vscode.EventEmitter<TestOrganizationItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TestOrganizationItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private service: TestOrganizationService;
  private currentFilter: string = "all";
  private currentGroupBy: "tag" | "status" | "feature" | "category" = "tag";
  private tests: Test[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.service = TestOrganizationService.getInstance(context);
  }

  /**
   * Refresh the view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Set the tests to display
   */
  public setTests(tests: Test[]): void {
    this.tests = tests;
    this.refresh();
  }

  /**
   * Set the current filter
   */
  public setFilter(filterId: string): void {
    this.currentFilter = filterId;
    this.refresh();
  }

  /**
   * Set the current grouping
   */
  public setGroupBy(groupBy: "tag" | "status" | "feature" | "category"): void {
    this.currentGroupBy = groupBy;
    this.refresh();
  }

  /**
   * Get the tree item for a given element
   */
  getTreeItem(element: TestOrganizationItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children of a given element
   */
  getChildren(
    element?: TestOrganizationItem
  ): Thenable<TestOrganizationItem[]> {
    if (!element) {
      // Root level - show sections
      return Promise.resolve([
        new TestOrganizationItem(
          "Filters",
          vscode.TreeItemCollapsibleState.Expanded,
          "filterSection"
        ),
        new TestOrganizationItem(
          "Tags",
          vscode.TreeItemCollapsibleState.Expanded,
          "tagSection"
        ),
        new TestOrganizationItem(
          "Group By",
          vscode.TreeItemCollapsibleState.Expanded,
          "groupBySection"
        ),
        new TestOrganizationItem(
          "Tests",
          vscode.TreeItemCollapsibleState.Expanded,
          "testSection"
        ),
      ]);
    } else if (element.contextValue === "filterSection") {
      // Filters section
      return Promise.resolve(this.getFilterItems());
    } else if (element.contextValue === "tagSection") {
      // Tags section
      return Promise.resolve(this.getTagItems());
    } else if (element.contextValue === "groupBySection") {
      // Group By section
      return Promise.resolve(this.getGroupByItems());
    } else if (element.contextValue === "testSection") {
      // Tests section
      return Promise.resolve(this.getTestItems());
    } else if (element.contextValue === "testGroup") {
      // Test group - show tests in the group
      return Promise.resolve(this.getTestsInGroup(element.id || ""));
    }

    return Promise.resolve([]);
  }

  /**
   * Get filter items
   */
  private getFilterItems(): TestOrganizationItem[] {
    const filters = this.service.getAllFilters();
    return filters.map((filter) => {
      const isActive = filter.id === this.currentFilter;
      return new TestOrganizationItem(
        filter.name,
        vscode.TreeItemCollapsibleState.None,
        isActive ? "activeFilter" : "filter",
        `filter-${filter.id}`,
        {
          command: "nuxtest.setTestFilter",
          title: "Set Filter",
          arguments: [filter.id],
        },
        isActive
          ? new vscode.ThemeIcon("check")
          : new vscode.ThemeIcon("filter"),
        filter.isPreset ? "Preset" : "Custom",
        this.getFilterTooltip(filter)
      );
    });
  }

  /**
   * Get tag items
   */
  private getTagItems(): TestOrganizationItem[] {
    const tags = this.service.getAllTags();
    return tags.map((tag) => {
      return new TestOrganizationItem(
        tag.name,
        vscode.TreeItemCollapsibleState.None,
        "tag",
        `tag-${tag.id}`,
        {
          command: "nuxtest.filterByTag",
          title: "Filter by Tag",
          arguments: [tag.id],
        },
        new vscode.ThemeIcon("tag"),
        "",
        tag.description
      );
    });
  }

  /**
   * Get group by items
   */
  private getGroupByItems(): TestOrganizationItem[] {
    const groupByOptions = [
      { id: "tag", name: "Tag", icon: "tag" },
      { id: "status", name: "Status", icon: "pulse" },
      { id: "feature", name: "Feature/Component", icon: "package" },
      { id: "category", name: "Category", icon: "folder" },
    ];

    return groupByOptions.map((option) => {
      const isActive = option.id === this.currentGroupBy;
      return new TestOrganizationItem(
        option.name,
        vscode.TreeItemCollapsibleState.None,
        isActive ? "activeGroupBy" : "groupBy",
        `groupby-${option.id}`,
        {
          command: "nuxtest.setTestGroupBy",
          title: "Group By",
          arguments: [option.id],
        },
        isActive
          ? new vscode.ThemeIcon("check")
          : new vscode.ThemeIcon(option.icon),
        isActive ? "Active" : ""
      );
    });
  }

  /**
   * Get test items grouped by the current grouping
   */
  private getTestItems(): TestOrganizationItem[] {
    // Apply the current filter
    const filteredTests = this.service.applyFilter(
      this.tests,
      this.currentFilter
    );

    // Group the tests
    const groups = this.service.groupTests(filteredTests, this.currentGroupBy);

    // Create tree items for each group
    return Object.entries(groups)
      .map(([groupName, tests]) => {
        return new TestOrganizationItem(
          groupName,
          vscode.TreeItemCollapsibleState.Collapsed,
          "testGroup",
          `group-${groupName}`,
          undefined,
          this.getGroupIcon(groupName),
          `${tests.length} tests`
        );
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get tests in a group
   */
  private getTestsInGroup(groupName: string): TestOrganizationItem[] {
    // Apply the current filter
    const filteredTests = this.service.applyFilter(
      this.tests,
      this.currentFilter
    );

    // Group the tests
    const groups = this.service.groupTests(filteredTests, this.currentGroupBy);

    // Get tests in the specified group
    const testsInGroup = groups[groupName.replace("group-", "")] || [];

    // Create tree items for each test
    return testsInGroup
      .map((test) => {
        return new TestOrganizationItem(
          test.name,
          vscode.TreeItemCollapsibleState.None,
          "test",
          `test-${test.id}`,
          {
            command: "nuxtest.runTest",
            title: "Run Test",
            arguments: [test.filePath, test.lineNumber],
          },
          this.getTestStatusIcon(test.status),
          test.duration !== undefined ? `${test.duration}ms` : "",
          `${test.filePath}:${test.lineNumber}`
        );
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get the icon for a group
   */
  private getGroupIcon(groupName: string): vscode.ThemeIcon {
    // Different icons based on the current grouping
    switch (this.currentGroupBy) {
      case "tag":
        return new vscode.ThemeIcon("tag");
      case "status":
        return this.getStatusIcon(groupName);
      case "feature":
        return new vscode.ThemeIcon("package");
      case "category":
        return new vscode.ThemeIcon("folder");
      default:
        return new vscode.ThemeIcon("list-tree");
    }
  }

  /**
   * Get the icon for a test status
   */
  private getTestStatusIcon(status: string): vscode.ThemeIcon {
    return this.getStatusIcon(status);
  }

  /**
   * Get the icon for a status
   */
  private getStatusIcon(status: string): vscode.ThemeIcon {
    switch (status) {
      case "passed":
        return new vscode.ThemeIcon(
          "pass",
          new vscode.ThemeColor("testing.iconPassed")
        );
      case "failed":
        return new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("testing.iconFailed")
        );
      case "skipped":
        return new vscode.ThemeIcon(
          "debug-step-over",
          new vscode.ThemeColor("testing.iconSkipped")
        );
      case "running":
        return new vscode.ThemeIcon("loading~spin");
      default:
        return new vscode.ThemeIcon("question");
    }
  }

  /**
   * Get the tooltip for a filter
   */
  private getFilterTooltip(filter: TestFilter): string {
    const criteria = filter.criteria;
    const parts: string[] = [];

    if (criteria.tagIds && criteria.tagIds.length > 0) {
      parts.push(`Tags: ${criteria.tagIds.join(", ")}`);
    }
    if (criteria.status && criteria.status.length > 0) {
      parts.push(`Status: ${criteria.status.join(", ")}`);
    }
    if (criteria.testName) {
      parts.push(`Test Name: ${criteria.testName}`);
    }
    if (criteria.filePath) {
      parts.push(`File Path: ${criteria.filePath}`);
    }
    if (criteria.minDuration !== undefined) {
      parts.push(`Min Duration: ${criteria.minDuration}ms`);
    }
    if (criteria.maxDuration !== undefined) {
      parts.push(`Max Duration: ${criteria.maxDuration}ms`);
    }
    if (criteria.featureOrComponent) {
      parts.push(`Feature/Component: ${criteria.featureOrComponent}`);
    }
    if (criteria.category) {
      parts.push(`Category: ${criteria.category}`);
    }

    return parts.length > 0 ? parts.join("\n") : "No criteria";
  }
}
