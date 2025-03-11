import { TestStatus } from "./TestStatus";

/**
 * Represents a test in the test explorer
 */
export interface Test {
  /** Unique identifier for the test */
  id: string;

  /** Name of the test */
  name: string;

  /** File path of the test */
  filePath: string;

  /** Line number where the test is defined */
  lineNumber: number;

  /** Current status of the test */
  status: TestStatus;

  /** Duration of the test in milliseconds */
  duration?: number;

  /** Error message if the test failed */
  error?: string;

  /** Stack trace if the test failed */
  stack?: string;

  /** Tags associated with this test */
  tags: string[];

  /** Feature or component this test is associated with */
  featureOrComponent?: string;

  /** Custom category for this test */
  category?: string;
}
