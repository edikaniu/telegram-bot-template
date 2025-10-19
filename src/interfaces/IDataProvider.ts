/**
 * Data Provider Interface
 *
 * This interface defines the contract for any data provider implementation.
 * Implement this interface to create custom data sources for your bot.
 *
 * Examples:
 * - Web scraper for financial data
 * - API client for weather data
 * - Database query for product information
 * - RSS feed parser for news
 */

/**
 * Generic data item structure
 * Extend this interface for your specific data type
 */
export interface DataItem {
  id?: string;
  name: string;
  type: string;
  lastUpdated: Date;
  [key: string]: any; // Allow additional custom fields
}

/**
 * Search result with relevance scoring
 */
export interface SearchResult<T extends DataItem> {
  item: T;
  relevance: number; // 0-1 score indicating match quality
}

/**
 * Data provider statistics
 */
export interface ProviderStats {
  totalItems: number;
  lastUpdate: Date;
  cacheHitRate?: number;
  errorCount?: number;
}

/**
 * Data Provider Interface
 *
 * Implement this interface to create a custom data source for your bot.
 */
export interface IDataProvider<T extends DataItem> {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Fetch all data from the source
   * @param forceRefresh - Force refresh even if cache is valid
   * @returns Promise resolving to array of data items
   */
  fetchAll(forceRefresh?: boolean): Promise<T[]>;

  /**
   * Fetch data filtered by type
   * @param type - The type/category to filter by
   * @param forceRefresh - Force refresh even if cache is valid
   * @returns Promise resolving to filtered data items
   */
  fetchByType(type: string, forceRefresh?: boolean): Promise<T[]>;

  /**
   * Search data by query string
   * @param query - Search query
   * @param options - Optional search options (limit, type filter, etc.)
   * @returns Promise resolving to search results with relevance scores
   */
  search(query: string, options?: {
    limit?: number;
    type?: string;
    fuzzy?: boolean;
  }): Promise<SearchResult<T>[]>;

  /**
   * Get a single item by ID or name
   * @param identifier - ID or name of the item
   * @returns Promise resolving to the data item or undefined
   */
  getById(identifier: string): Promise<T | undefined>;

  /**
   * Check if cache is valid
   * @returns Whether the cache is still valid
   */
  isCacheValid(): boolean;

  /**
   * Clear the cache
   */
  clearCache(): void;

  /**
   * Get provider statistics
   * @returns Provider statistics
   */
  getStats(): Promise<ProviderStats>;

  /**
   * Health check for the data source
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    responseTime?: number;
  }>;
}

/**
 * Abstract base class for data providers
 * Provides common functionality for caching and error handling
 */
export abstract class BaseDataProvider<T extends DataItem> implements IDataProvider<T> {
  protected cache: T[] = [];
  protected lastCacheUpdate: Date | null = null;
  protected cacheTTL: number; // milliseconds
  protected errorCount = 0;
  protected cacheHits = 0;
  protected cacheMisses = 0;

  constructor(
    public readonly name: string,
    cacheTTLMinutes: number = 30
  ) {
    this.cacheTTL = cacheTTLMinutes * 60 * 1000;
  }

  abstract fetchAll(forceRefresh?: boolean): Promise<T[]>;
  abstract fetchByType(type: string, forceRefresh?: boolean): Promise<T[]>;
  abstract healthCheck(): Promise<{ healthy: boolean; message?: string; responseTime?: number }>;

  /**
   * Default search implementation using simple string matching
   * Override this for more sophisticated search (fuzzy matching, etc.)
   */
  async search(
    query: string,
    options?: { limit?: number; type?: string; fuzzy?: boolean }
  ): Promise<SearchResult<T>[]> {
    const items = await this.fetchAll();
    const lowerQuery = query.toLowerCase();

    let results = items
      .map(item => {
        // Simple relevance scoring
        const nameMatch = item.name.toLowerCase().includes(lowerQuery);
        const typeMatch = options?.type ? item.type === options.type : true;

        let relevance = 0;
        if (nameMatch && typeMatch) {
          // Exact match = highest relevance
          if (item.name.toLowerCase() === lowerQuery) {
            relevance = 1.0;
          } else if (item.name.toLowerCase().startsWith(lowerQuery)) {
            relevance = 0.8;
          } else {
            relevance = 0.5;
          }
        }

        return { item, relevance };
      })
      .filter(result => result.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Default getById implementation
   * Override if you have a more efficient way to fetch by ID
   */
  async getById(identifier: string): Promise<T | undefined> {
    const items = await this.fetchAll();
    return items.find(
      item =>
        item.id === identifier ||
        item.name.toLowerCase() === identifier.toLowerCase()
    );
  }

  isCacheValid(): boolean {
    if (!this.lastCacheUpdate) return false;
    const now = new Date().getTime();
    const cacheAge = now - this.lastCacheUpdate.getTime();
    return cacheAge < this.cacheTTL;
  }

  clearCache(): void {
    this.cache = [];
    this.lastCacheUpdate = null;
  }

  async getStats(): Promise<ProviderStats> {
    const items = await this.fetchAll();
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      totalItems: items.length,
      lastUpdate: this.lastCacheUpdate || new Date(),
      cacheHitRate,
      errorCount: this.errorCount,
    };
  }

  protected updateCache(data: T[]): void {
    this.cache = data;
    this.lastCacheUpdate = new Date();
  }

  protected recordCacheHit(): void {
    this.cacheHits++;
  }

  protected recordCacheMiss(): void {
    this.cacheMisses++;
  }

  protected recordError(): void {
    this.errorCount++;
  }
}
