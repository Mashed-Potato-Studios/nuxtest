import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { TestResult } from "../providers/TestResultsProvider";

interface TestCacheEntry {
  results: TestResult[];
  timestamp: number;
  fileHash: string;
}

interface TestCache {
  [filePath: string]: TestCacheEntry;
}

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Get the cache file path
function getCacheFilePath(): string {
  const storagePath = getStoragePath();
  return path.join(storagePath, "nuxtest-cache.json");
}

// Get the storage path for the extension
let globalStoragePath: string | null = null;

export function initializeStoragePath(context: vscode.ExtensionContext): void {
  globalStoragePath = context.globalStoragePath;

  // Create the cache directory if it doesn't exist
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath, { recursive: true });
  }

  // Create a specific cache subdirectory
  const cachePath = path.join(globalStoragePath, "cache");
  if (!fs.existsSync(cachePath)) {
    fs.mkdirSync(cachePath, { recursive: true });
  }
}

function getStoragePath(): string {
  if (!globalStoragePath) {
    // Try to get the extension context
    const extension = vscode.extensions.getExtension(
      "mashed-potato-studios.nuxtest"
    );

    if (extension && extension.isActive) {
      // If the extension is active, we can try to use the extensionPath as a fallback
      const extensionPath = extension.extensionPath;
      const fallbackPath = path.join(extensionPath, ".cache");

      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
      }

      return fallbackPath;
    }

    throw new Error(
      "Could not get extension context. Please restart VS Code and try again."
    );
  }

  return path.join(globalStoragePath, "cache");
}

// Load the cache from disk
export function loadCache(): TestCache {
  try {
    const cacheFilePath = getCacheFilePath();
    if (!fs.existsSync(cacheFilePath)) {
      return {};
    }

    const cacheData = fs.readFileSync(cacheFilePath, "utf8");
    return JSON.parse(cacheData);
  } catch (error) {
    console.error("Error loading test cache:", error);
    return {};
  }
}

// Save the cache to disk
export function saveCache(cache: TestCache): void {
  try {
    const cacheFilePath = getCacheFilePath();
    fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving test cache:", error);
  }
}

// Calculate a hash for a file to detect changes
export function calculateFileHash(filePath: string): string {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("md5").update(fileContent).digest("hex");
  } catch (error) {
    console.error(`Error calculating hash for ${filePath}:`, error);
    return "";
  }
}

// Check if a file has changed since it was last cached
export function hasFileChanged(filePath: string, cache: TestCache): boolean {
  if (!cache[filePath]) {
    return true;
  }

  const currentHash = calculateFileHash(filePath);
  return currentHash !== cache[filePath].fileHash;
}

// Check if the cache for a file has expired
export function isCacheExpired(filePath: string, cache: TestCache): boolean {
  if (!cache[filePath]) {
    return true;
  }

  const now = Date.now();
  return now - cache[filePath].timestamp > CACHE_EXPIRATION;
}

// Get cached test results for a file
export function getCachedResults(
  filePath: string,
  cache: TestCache
): TestResult[] | null {
  if (
    !cache[filePath] ||
    hasFileChanged(filePath, cache) ||
    isCacheExpired(filePath, cache)
  ) {
    return null;
  }

  return cache[filePath].results;
}

// Update the cache with new test results
export function updateCache(
  filePath: string,
  results: TestResult[],
  cache: TestCache
): TestCache {
  const updatedCache = { ...cache };
  updatedCache[filePath] = {
    results,
    timestamp: Date.now(),
    fileHash: calculateFileHash(filePath),
  };

  saveCache(updatedCache);
  return updatedCache;
}

// Check if a test file needs to be run based on cache and dependencies
export function shouldRunTest(filePath: string, cache: TestCache): boolean {
  // Always run if no cache exists
  if (!cache[filePath]) {
    return true;
  }

  // Run if file has changed
  if (hasFileChanged(filePath, cache)) {
    return true;
  }

  // Run if cache has expired
  if (isCacheExpired(filePath, cache)) {
    return true;
  }

  return false;
}

// Clear the entire cache
export function clearCache(): void {
  try {
    const cacheFilePath = getCacheFilePath();
    if (fs.existsSync(cacheFilePath)) {
      fs.unlinkSync(cacheFilePath);
    }
  } catch (error) {
    console.error("Error clearing test cache:", error);
  }
}

// Clear cache for a specific file
export function clearCacheForFile(
  filePath: string,
  cache: TestCache
): TestCache {
  const updatedCache = { ...cache };
  if (updatedCache[filePath]) {
    delete updatedCache[filePath];
    saveCache(updatedCache);
  }
  return updatedCache;
}
