import { chromium, Browser, Page } from 'playwright';
import { NewsItem } from '../types';
import { Logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

const logger = new Logger('NewsScraperService');

export class NewsScraperService {
  private cacheDir: string;
  private cacheFile: string;
  private cacheMaxAge: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'data');
    this.cacheFile = path.join(this.cacheDir, 'news_cache.json');
    this.ensureCacheDirectory();
  }

  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get cached news if available and fresh
   */
  private getCachedNews(): NewsItem[] | null {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return null;
      }

      const cacheContent = fs.readFileSync(this.cacheFile, 'utf-8');
      const cache = JSON.parse(cacheContent);

      // Check if cache is still valid (less than 30 minutes old)
      const cacheAge = Date.now() - new Date(cache.lastUpdated).getTime();
      if (cacheAge > this.cacheMaxAge) {
        logger.info('News cache expired');
        return null;
      }

      logger.info(`Returning ${cache.news.length} cached news items`);
      return cache.news.map((item: any) => ({
        ...item,
        publishedAt: new Date(item.publishedAt),
      }));
    } catch (error) {
      logger.error('Error reading news cache:', error);
      return null;
    }
  }

  /**
   * Save news to cache
   */
  private saveToCache(news: NewsItem[]): void {
    try {
      const cacheData = {
        lastUpdated: new Date().toISOString(),
        news: news,
      };

      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
      logger.info(`Saved ${news.length} news items to cache`);
    } catch (error) {
      logger.error('Error saving news to cache:', error);
    }
  }

  /**
   * Get news from all sources (uses cache if fresh)
   */
  async getNews(category?: string): Promise<NewsItem[]> {
    try {
      // Check cache first
      const cached = this.getCachedNews();
      if (cached) {
        if (category) {
          return cached.filter(item => item.category === category);
        }
        return cached;
      }

      // Scrape fresh news if cache is stale
      logger.info('Scraping fresh news from Nigerian platforms...');
      const allNews = await this.scrapeAllSources();

      // Save to cache
      this.saveToCache(allNews);

      // Filter by category if specified
      if (category) {
        return allNews.filter(item => item.category === category);
      }

      return allNews;
    } catch (error) {
      logger.error('Error getting news:', error);
      return [];
    }
  }

  /**
   * Scrape news from all configured sources
   */
  private async scrapeAllSources(): Promise<NewsItem[]> {
    const allNews: NewsItem[] = [];
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });

      // Scrape each source in parallel
      const scrapers = [
        this.scrapeNairametrics(browser),
        this.scrapeBusinessDay(browser),
        this.scrapePunch(browser),
        this.scrapeTechCabal(browser),
        this.scrapeTechPoint(browser),
      ];

      const results = await Promise.allSettled(scrapers);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allNews.push(...result.value);
        } else {
          logger.error(`Scraper ${index} failed:`, result.reason);
        }
      });

      // Sort by published date (newest first)
      allNews.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

      // Interleave sources to ensure diversity in top results
      const interleaved = this.interleaveSources(allNews);

      logger.info(`Successfully scraped ${allNews.length} total news items`);
      return interleaved;
    } catch (error) {
      logger.error('Error scraping news sources:', error);
      return allNews;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Scrape Nairametrics (Finance & Economy)
   */
  private async scrapeNairametrics(browser: Browser): Promise<NewsItem[]> {
    const news: NewsItem[] = [];
    let page: Page | null = null;

    try {
      logger.info('Scraping Nairametrics...');
      page = await browser.newPage();

      await page.goto('https://nairametrics.com/category/finance/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      const articles = await page.evaluate(() => {
        const items: any[] = [];

        // Nairametrics uses article tags
        const articleElements = document.querySelectorAll('article');

        articleElements.forEach((article, index) => {
          if (index >= 10) return; // Limit to 10 articles

          const titleEl = article.querySelector('h2 a, h3 a, .entry-title a');
          const excerptEl = article.querySelector('.entry-content p, .excerpt, .entry-summary');
          const linkEl = article.querySelector('a[href]');
          const dateEl = article.querySelector('time, .entry-date, .published');

          const title = titleEl?.textContent?.trim();
          const url = linkEl?.getAttribute('href');
          const excerpt = excerptEl?.textContent?.trim() || '';
          const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

          if (title && url) {
            items.push({
              title,
              url,
              excerpt: excerpt.substring(0, 150),
              dateStr,
            });
          }
        });

        return items;
      });

      articles.forEach(article => {
        news.push({
          title: article.title,
          summary: article.excerpt || 'Read full article for details.',
          url: article.url,
          source: 'Nairametrics',
          publishedAt: article.dateStr ? new Date(article.dateStr) : new Date(),
          category: this.categorizeNews(article.title + ' ' + article.excerpt),
        });
      });

      logger.info(`Scraped ${news.length} articles from Nairametrics`);
    } catch (error) {
      logger.error('Error scraping Nairametrics:', error);
    } finally {
      if (page) {
        await page.close();
      }
    }

    return news;
  }

  /**
   * Scrape BusinessDay
   */
  private async scrapeBusinessDay(browser: Browser): Promise<NewsItem[]> {
    const news: NewsItem[] = [];
    let page: Page | null = null;

    try {
      logger.info('Scraping BusinessDay...');
      page = await browser.newPage();

      await page.goto('https://businessday.ng/category/financial-services/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      const articles = await page.evaluate(() => {
        const items: any[] = [];

        const articleElements = document.querySelectorAll('article, .post, .post-item');

        articleElements.forEach((article, index) => {
          if (index >= 10) return;

          const titleEl = article.querySelector('h2 a, h3 a, .entry-title a, .post-title a');
          const excerptEl = article.querySelector('.entry-content, .excerpt, p');
          const linkEl = titleEl || article.querySelector('a[href*="businessday"]');
          const dateEl = article.querySelector('time, .date, .published');

          const title = titleEl?.textContent?.trim();
          const url = linkEl?.getAttribute('href');
          const excerpt = excerptEl?.textContent?.trim() || '';
          const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

          if (title && url) {
            items.push({
              title,
              url,
              excerpt: excerpt.substring(0, 150),
              dateStr,
            });
          }
        });

        return items;
      });

      articles.forEach(article => {
        news.push({
          title: article.title,
          summary: article.excerpt || 'Read full article for details.',
          url: article.url,
          source: 'BusinessDay',
          publishedAt: article.dateStr ? new Date(article.dateStr) : new Date(),
          category: this.categorizeNews(article.title + ' ' + article.excerpt),
        });
      });

      logger.info(`Scraped ${news.length} articles from BusinessDay`);
    } catch (error) {
      logger.error('Error scraping BusinessDay:', error);
    } finally {
      if (page) {
        await page.close();
      }
    }

    return news;
  }

  /**
   * Scrape Punch Business Section
   */
  private async scrapePunch(browser: Browser): Promise<NewsItem[]> {
    const news: NewsItem[] = [];
    let page: Page | null = null;

    try {
      logger.info('Scraping Punch Business...');
      page = await browser.newPage();

      await page.goto('https://punchng.com/topics/business/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      const articles = await page.evaluate(() => {
        const items: any[] = [];

        const articleElements = document.querySelectorAll('article, .post-item, .item');

        articleElements.forEach((article, index) => {
          if (index >= 10) return;

          const titleEl = article.querySelector('h2 a, h3 a, .title a, .entry-title a');
          const excerptEl = article.querySelector('.excerpt, .entry-content, p');
          const linkEl = titleEl || article.querySelector('a[href*="punchng"]');
          const dateEl = article.querySelector('time, .date, .published, .entry-date');

          const title = titleEl?.textContent?.trim();
          const url = linkEl?.getAttribute('href');
          const excerpt = excerptEl?.textContent?.trim() || '';
          const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

          if (title && url) {
            items.push({
              title,
              url,
              excerpt: excerpt.substring(0, 150),
              dateStr,
            });
          }
        });

        return items;
      });

      articles.forEach(article => {
        news.push({
          title: article.title,
          summary: article.excerpt || 'Read full article for details.',
          url: article.url,
          source: 'Punch',
          publishedAt: article.dateStr ? new Date(article.dateStr) : new Date(),
          category: this.categorizeNews(article.title + ' ' + article.excerpt),
        });
      });

      logger.info(`Scraped ${news.length} articles from Punch`);
    } catch (error) {
      logger.error('Error scraping Punch:', error);
    } finally {
      if (page) {
        await page.close();
      }
    }

    return news;
  }

  /**
   * Scrape TechCabal (Tech & Finance)
   */
  private async scrapeTechCabal(browser: Browser): Promise<NewsItem[]> {
    const news: NewsItem[] = [];
    let page: Page | null = null;

    try {
      logger.info('Scraping TechCabal...');
      page = await browser.newPage();

      await page.goto('https://techcabal.com/category/finance/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      const articles = await page.evaluate(() => {
        const items: any[] = [];

        const articleElements = document.querySelectorAll('article, .post-item');

        articleElements.forEach((article, index) => {
          if (index >= 8) return;

          const titleEl = article.querySelector('h2 a, h3 a, .entry-title a');
          const excerptEl = article.querySelector('.excerpt, .entry-excerpt, p');
          const linkEl = titleEl || article.querySelector('a[href*="techcabal"]');
          const dateEl = article.querySelector('time, .date, .published');

          const title = titleEl?.textContent?.trim();
          const url = linkEl?.getAttribute('href');
          const excerpt = excerptEl?.textContent?.trim() || '';
          const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

          if (title && url) {
            items.push({
              title,
              url,
              excerpt: excerpt.substring(0, 150),
              dateStr,
            });
          }
        });

        return items;
      });

      articles.forEach(article => {
        news.push({
          title: article.title,
          summary: article.excerpt || 'Read full article for details.',
          url: article.url,
          source: 'TechCabal',
          publishedAt: article.dateStr ? new Date(article.dateStr) : new Date(),
          category: this.categorizeNews(article.title + ' ' + article.excerpt),
        });
      });

      logger.info(`Scraped ${news.length} articles from TechCabal`);
    } catch (error) {
      logger.error('Error scraping TechCabal:', error);
    } finally {
      if (page) {
        await page.close();
      }
    }

    return news;
  }

  /**
   * Scrape TechPoint (Tech & Finance)
   */
  private async scrapeTechPoint(browser: Browser): Promise<NewsItem[]> {
    const news: NewsItem[] = [];
    let page: Page | null = null;

    try {
      logger.info('Scraping TechPoint...');
      page = await browser.newPage();

      await page.goto('https://techpoint.africa/category/finance/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      const articles = await page.evaluate(() => {
        const items: any[] = [];

        const articleElements = document.querySelectorAll('article, .post, .story-item');

        articleElements.forEach((article, index) => {
          if (index >= 8) return;

          const titleEl = article.querySelector('h2 a, h3 a, .entry-title a, .story-title a');
          const excerptEl = article.querySelector('.excerpt, .entry-excerpt, .story-excerpt, p');
          const linkEl = titleEl || article.querySelector('a[href*="techpoint"]');
          const dateEl = article.querySelector('time, .date, .published, .story-date');

          const title = titleEl?.textContent?.trim();
          const url = linkEl?.getAttribute('href');
          const excerpt = excerptEl?.textContent?.trim() || '';
          const dateStr = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

          if (title && url) {
            items.push({
              title,
              url,
              excerpt: excerpt.substring(0, 150),
              dateStr,
            });
          }
        });

        return items;
      });

      articles.forEach(article => {
        news.push({
          title: article.title,
          summary: article.excerpt || 'Read full article for details.',
          url: article.url,
          source: 'TechPoint',
          publishedAt: article.dateStr ? new Date(article.dateStr) : new Date(),
          category: this.categorizeNews(article.title + ' ' + article.excerpt),
        });
      });

      logger.info(`Scraped ${news.length} articles from TechPoint`);
    } catch (error) {
      logger.error('Error scraping TechPoint:', error);
    } finally {
      if (page) {
        await page.close();
      }
    }

    return news;
  }

  /**
   * Interleave news sources to ensure diversity
   */
  private interleaveSources(news: NewsItem[]): NewsItem[] {
    // Group by source
    const bySource: Record<string, NewsItem[]> = {};
    news.forEach(item => {
      if (!bySource[item.source]) {
        bySource[item.source] = [];
      }
      bySource[item.source].push(item);
    });

    // Interleave - take one from each source in rotation
    const sources = Object.keys(bySource);
    const result: NewsItem[] = [];
    let index = 0;

    while (sources.some(source => bySource[source].length > 0)) {
      const source = sources[index % sources.length];
      if (bySource[source].length > 0) {
        result.push(bySource[source].shift()!);
      }
      index++;
    }

    return result;
  }

  /**
   * Categorize news based on title and content
   */
  private categorizeNews(text: string): 'market' | 'funds' | 'economy' | 'policy' | 'stocks' | 'tech' {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('mutual fund') || lowerText.includes('fund manager') || lowerText.includes('investment fund')) {
      return 'funds';
    }

    if (lowerText.includes('policy') || lowerText.includes('regulation') || lowerText.includes('cbn') ||
        lowerText.includes('central bank') || lowerText.includes('government') || lowerText.includes('law')) {
      return 'policy';
    }

    if (lowerText.includes('stock') || lowerText.includes('ngx') || lowerText.includes('equity') ||
        lowerText.includes('shares') || lowerText.includes('trading')) {
      return 'stocks';
    }

    if (lowerText.includes('fintech') || lowerText.includes('startup') || lowerText.includes('technology') ||
        lowerText.includes('digital') || lowerText.includes('app')) {
      return 'tech';
    }

    if (lowerText.includes('inflation') || lowerText.includes('gdp') || lowerText.includes('economy') ||
        lowerText.includes('economic') || lowerText.includes('naira') || lowerText.includes('dollar')) {
      return 'economy';
    }

    return 'market';
  }

  /**
   * Force refresh news (bypass cache)
   */
  async refreshNews(): Promise<NewsItem[]> {
    try {
      logger.info('Force refreshing news...');
      const news = await this.scrapeAllSources();
      this.saveToCache(news);
      return news;
    } catch (error) {
      logger.error('Error force refreshing news:', error);
      return [];
    }
  }
}

export default new NewsScraperService();
