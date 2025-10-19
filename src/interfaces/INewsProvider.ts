/**
 * News Provider Interface
 *
 * This interface defines the contract for any news provider implementation.
 * Implement this interface to create custom news sources for your bot.
 *
 * Examples:
 * - Web scraper for news websites
 * - RSS feed parser
 * - API client for news services (NewsAPI, etc.)
 * - Social media feed aggregator
 */

/**
 * News article structure
 */
export interface NewsArticle {
  id?: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  category?: string;
  author?: string;
  imageUrl?: string;
  tags?: string[];
  [key: string]: any; // Allow additional custom fields
}

/**
 * News filter options
 */
export interface NewsFilter {
  category?: string;
  source?: string;
  since?: Date; // Only articles published after this date
  limit?: number;
  keywords?: string[];
}

/**
 * News provider statistics
 */
export interface NewsProviderStats {
  totalArticles: number;
  lastUpdate: Date;
  sources: string[];
  categories: string[];
  errorCount?: number;
}

/**
 * News Provider Interface
 *
 * Implement this interface to create a custom news source for your bot.
 */
export interface INewsProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Fetch latest news articles
   * @param forceRefresh - Force refresh even if cache is valid
   * @returns Promise resolving to array of news articles
   */
  fetchLatest(forceRefresh?: boolean): Promise<NewsArticle[]>;

  /**
   * Fetch news filtered by criteria
   * @param filter - Filter options
   * @returns Promise resolving to filtered news articles
   */
  fetchFiltered(filter: NewsFilter): Promise<NewsArticle[]>;

  /**
   * Fetch news by category
   * @param category - News category
   * @param limit - Maximum number of articles
   * @returns Promise resolving to news articles in category
   */
  fetchByCategory(category: string, limit?: number): Promise<NewsArticle[]>;

  /**
   * Fetch news by source
   * @param source - News source
   * @param limit - Maximum number of articles
   * @returns Promise resolving to news articles from source
   */
  fetchBySource(source: string, limit?: number): Promise<NewsArticle[]>;

  /**
   * Get new articles since last check
   * @returns Promise resolving to new articles
   */
  getNewArticles(): Promise<NewsArticle[]>;

  /**
   * Mark article as sent/broadcasted
   * @param articleUrl - URL of the article
   */
  markAsSent(articleUrl: string): void;

  /**
   * Check if article has been sent
   * @param articleUrl - URL of the article
   * @returns Whether the article has been sent
   */
  hasBeenSent(articleUrl: string): boolean;

  /**
   * Get available categories
   * @returns Promise resolving to array of categories
   */
  getCategories(): Promise<string[]>;

  /**
   * Get available sources
   * @returns Promise resolving to array of sources
   */
  getSources(): Promise<string[]>;

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
   * @returns Promise resolving to provider statistics
   */
  getStats(): Promise<NewsProviderStats>;

  /**
   * Health check for the news source
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    responseTime?: number;
  }>;
}

/**
 * Abstract base class for news providers
 * Provides common functionality for caching and tracking sent articles
 */
export abstract class BaseNewsProvider implements INewsProvider {
  protected cache: NewsArticle[] = [];
  protected lastCacheUpdate: Date | null = null;
  protected cacheTTL: number; // milliseconds
  protected sentArticleUrls: Set<string> = new Set();
  protected errorCount = 0;

  constructor(
    public readonly name: string,
    cacheTTLMinutes: number = 30
  ) {
    this.cacheTTL = cacheTTLMinutes * 60 * 1000;
  }

  abstract fetchLatest(forceRefresh?: boolean): Promise<NewsArticle[]>;
  abstract healthCheck(): Promise<{ healthy: boolean; message?: string; responseTime?: number }>;

  /**
   * Default implementation for filtered fetch
   * Override if you have a more efficient way to filter at source
   */
  async fetchFiltered(filter: NewsFilter): Promise<NewsArticle[]> {
    let articles = await this.fetchLatest();

    if (filter.category) {
      articles = articles.filter(a => a.category === filter.category);
    }

    if (filter.source) {
      articles = articles.filter(a => a.source === filter.source);
    }

    if (filter.since) {
      articles = articles.filter(a => a.publishedAt >= filter.since!);
    }

    if (filter.keywords && filter.keywords.length > 0) {
      articles = articles.filter(a => {
        const searchText = `${a.title} ${a.summary}`.toLowerCase();
        return filter.keywords!.some(keyword => searchText.includes(keyword.toLowerCase()));
      });
    }

    if (filter.limit) {
      articles = articles.slice(0, filter.limit);
    }

    return articles;
  }

  async fetchByCategory(category: string, limit?: number): Promise<NewsArticle[]> {
    return this.fetchFiltered({ category, limit });
  }

  async fetchBySource(source: string, limit?: number): Promise<NewsArticle[]> {
    return this.fetchFiltered({ source, limit });
  }

  async getNewArticles(): Promise<NewsArticle[]> {
    const articles = await this.fetchLatest();
    return articles.filter(article => !this.hasBeenSent(article.url));
  }

  markAsSent(articleUrl: string): void {
    this.sentArticleUrls.add(articleUrl);
  }

  hasBeenSent(articleUrl: string): boolean {
    return this.sentArticleUrls.has(articleUrl);
  }

  async getCategories(): Promise<string[]> {
    const articles = await this.fetchLatest();
    const categories = new Set<string>();
    articles.forEach(article => {
      if (article.category) {
        categories.add(article.category);
      }
    });
    return Array.from(categories).sort();
  }

  async getSources(): Promise<string[]> {
    const articles = await this.fetchLatest();
    const sources = new Set<string>();
    articles.forEach(article => sources.add(article.source));
    return Array.from(sources).sort();
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

  async getStats(): Promise<NewsProviderStats> {
    const articles = await this.fetchLatest();
    const sources = await this.getSources();
    const categories = await this.getCategories();

    return {
      totalArticles: articles.length,
      lastUpdate: this.lastCacheUpdate || new Date(),
      sources,
      categories,
      errorCount: this.errorCount,
    };
  }

  protected updateCache(articles: NewsArticle[]): void {
    this.cache = articles;
    this.lastCacheUpdate = new Date();
  }

  protected recordError(): void {
    this.errorCount++;
  }

  /**
   * Load sent articles from persistent storage
   * Override this to load from file/database
   */
  protected loadSentArticles(urls: string[]): void {
    this.sentArticleUrls = new Set(urls);
  }

  /**
   * Get all sent article URLs for persistence
   * Override this to save to file/database
   */
  protected getSentArticlesForPersistence(): string[] {
    return Array.from(this.sentArticleUrls);
  }
}
