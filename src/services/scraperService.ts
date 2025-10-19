import axios from 'axios';
import axiosRetry from 'axios-retry';
import { chromium, Browser, Page } from 'playwright';
import { FundData } from '../types';
import { Logger } from '../utils/logger';
import serviceHealthMonitor from '../utils/serviceHealth';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('ScraperService');

// Configure axios with retry logic
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  },
});

export class ScraperService {
  private cacheDir: string;
  private cacheFile: string;
  private lastScrapeTime: Date | null = null;
  private browser: Browser | null = null;

  // NairaCompare URLs for different fund types
  private readonly FUND_URLS = {
    money_market: 'https://nairacompare.ng/investments/money-market-fund-compare',
    fixed_income: 'https://nairacompare.ng/investments/fixed-income-fund-compare',
    dollar: 'https://nairacompare.ng/investments/dollar-fund-compare',
    balance: 'https://nairacompare.ng/investments/balanced-fund-compare',
    equity: 'https://nairacompare.ng/investments/equity-fund-compare',
  };

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'data');
    this.cacheFile = path.join(this.cacheDir, 'funds_cache.json');
    this.ensureCacheDirectory();

    // Register service for health monitoring
    serviceHealthMonitor.registerService('scraper-service');

    // REMOVED: Sample data initialization - only use real scraped data
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.info('Cache directory created');
    }
  }
  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  private constructProductUrl(fundManager: string, fundName: string, fundType: string): string {
    const fullSlug = `${this.slugify(fundManager)}-${this.slugify(fundName)}`;
    return `https://nairacompare.ng/investments/${fundType.replace('_', '-')}-fund/${fullSlug}`;
  }


  /**
   * Initialize browser for scraping with enhanced security
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      logger.info('Launching browser with security hardening...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security', // Only for scraping trusted sites
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled',
        ],
        timeout: 30000, // 30 second timeout
      });
    }
    return this.browser;
  }

  /**
   * Close browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  /**
   * Scrape mutual funds from NairaCompare
   * Now configured with actual selectors from NairaCompare inspection
   */
  async scrapeFunds(): Promise<FundData[]> {
    const allFunds: FundData[] = [];

    try {
      logger.info('Starting fund scraping from NairaCompare...');
      const browser = await this.initBrowser();

      for (const [fundType, url] of Object.entries(this.FUND_URLS)) {
        try {
          logger.info(`Scraping ${fundType} funds from ${url}`);
          const funds = await this.scrapeFundPage(browser, url, fundType as any);
          allFunds.push(...funds);
          await this.delay(2000);
        } catch (error) {
          logger.error(`Error scraping ${fundType} funds:`, error);
        }
      }

      await this.closeBrowser();

      if (allFunds.length > 0) {
        this.cacheFunds(allFunds);
        this.lastScrapeTime = new Date();

        // Record successful scrape
        serviceHealthMonitor.recordSuccess('scraper-service');

        logger.info(`Successfully scraped ${allFunds.length} funds`);
        return allFunds;
      } else {
        // Record failure if no funds were scraped
        serviceHealthMonitor.recordFailure('scraper-service', 'No funds scraped from any source');

        logger.warn('No funds scraped, returning cached data');
        return this.getCachedFunds();
      }
    } catch (error) {
      // Record service failure
      const errorMsg = error instanceof Error ? error.message : String(error);
      serviceHealthMonitor.recordFailure('scraper-service', errorMsg);

      logger.error('Error in fund scraping:', error);
      await this.closeBrowser();
      return this.getCachedFunds();
    }
  }

  /**
   * Scrape a single fund page using Playwright
   * Updated with actual NairaCompare selectors and pagination support
   */
  private async scrapeFundPage(browser: Browser, url: string, fundType: string): Promise<FundData[]> {
    const allFunds: FundData[] = [];
    let page: Page | null = null;

    try {
      // Create new page with security context
      page = await browser.newPage({
        javaScriptEnabled: true, // Required for dynamic content
        bypassCSP: false, // Respect Content Security Policy
      });

      // Set viewport and user agent to avoid detection
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      });

      // Set navigation timeout
      page.setDefaultNavigationTimeout(30000); // 30 seconds
      page.setDefaultTimeout(15000); // 15 seconds for selectors

      logger.info(`Navigating to ${url}`);

      // Try to navigate with timeout handling
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (error) {
        logger.warn(`Navigation timeout for ${url}, trying with networkidle...`);
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
        } catch (retryError) {
          logger.error(`Failed to load ${url} after retry`);
          throw retryError;
        }
      }

      // Wait for dynamic content to load
      await page.waitForTimeout(3000);

      // Wait for fund cards to load (using flexible selector)
      await page.waitForSelector('[class*="providerName"], .react-hubspot-listing-card', { timeout: 30000 }).catch(() => {
        logger.warn(`Could not find fund provider elements on ${url}`);
      });

      // Give extra time for all content to render
      await this.delay(2000);

      let pageNumber = 1;
      let hasMorePages = true;
      const seenFunds = new Set<string>(); // Track fund names to avoid duplicates
      let consecutiveDuplicatePages = 0;
      const MAX_PAGES = 10; // Safety limit - reduced to prevent infinite loops
      let previousPageUrl = '';

      // Loop through all pages
      while (hasMorePages && pageNumber <= MAX_PAGES) {
        logger.info(`Scraping ${fundType} page ${pageNumber}...`);

        // Extract fund data from current page
        const scrapedFunds = await page.evaluate(() => {
          const fundData: any[] = [];

          // Find all fund cards/items - use flexible selector
          const providerElements = document.querySelectorAll('[class*="providerName"]');

          providerElements.forEach((providerEl: Element) => {
            try {
              // Get the card/container - the parent is .react-hubspot-listing-card
              const card: Element | null = providerEl.closest('.react-hubspot-listing-card');

              if (!card) return;

              // Extract fund/product name - use flexible selector
              const productNameEl = card.querySelector('[class*="productName"]');
              const fundName = productNameEl?.textContent?.trim() || '';

              // Extract fund manager (provider name) - this is in the h3
              const fundManager = providerEl.textContent?.trim() || '';

              // Extract product detail page URL from card links
              // NairaCompare pattern: /investments/[fund-type]/[provider-fund-slug]
              // Examples:
              // - /investments/money-market-fund/fbnquest-asset-management-limited-fbn-money-market-fund
              // - /investments/dollar-fund/united-capital-asset-mgt-ltd-united-capital-nigerian-eurobond-fund-
              let productUrl = '';

              // Try to find the product detail page link in the card
              const allCardLinks = Array.from(card.querySelectorAll('a[href]'));
              for (const link of allCardLinks) {
                const href = link.getAttribute('href') || '';

                // Product pages match pattern: /investments/[type]-fund/[name]
                // NOT category pages like: /investments/money-market-fund-compare
                const isProductPage =
                  href.includes('/investments/') &&
                  (href.includes('/money-market-fund/') ||
                   href.includes('/fixed-income-fund/') ||
                   href.includes('/dollar-fund/') ||
                   href.includes('/balanced-fund/') ||
                   href.includes('/equity-fund/'));

                if (isProductPage) {
                  productUrl = href.startsWith('http') ? href : `https://nairacompare.ng${href}`;
                  break; // Found the product URL, stop looking
                }
              }

              // If no product URL found, leave it empty (will use category page as fallback later)
              if (!productUrl) {
                // Log for debugging purposes
                console.log(`No product URL found for: ${fundName}`);
              }

              // Extract details items - use flexible selector
              const detailsContainer = card.querySelector('[class*="detailsItems"], [class*="details"]');
              const detailsItems = detailsContainer
                ? Array.from(detailsContainer.querySelectorAll('.react-hubspot-card-item, [class*="card-item"]'))
                : [];

              let yieldValue = '';
              let minimumInvestment = '';
              let riskProfile = '';

              detailsItems.forEach((item: Element) => {
                // Get all spans within this item
                const spans = Array.from(item.querySelectorAll('span'));

                if (spans.length >= 2) {
                  // First span contains the label, last span contains the value
                  const labelElement = spans[0];
                  const valueElement = spans[spans.length - 1];

                  const label = labelElement.textContent?.trim().toLowerCase() || '';
                  const value = valueElement.textContent?.trim() || '';

                  // Match by label text
                  if (label.includes('min amount') || label.includes('minimum')) {
                    minimumInvestment = value;
                  } else if (label.includes('yield') && label.includes('date')) {
                    yieldValue = value;
                  } else if (label.includes('risk profile') || label === 'risk') {
                    riskProfile = value;
                  }
                }
              });

              if (fundName && fundManager) {
                fundData.push({
                  name: fundName,
                  manager: fundManager,
                  yieldText: yieldValue,
                  minimumInvestment: minimumInvestment,
                  riskProfile: riskProfile,
                  productUrl: productUrl,
                });
              }
            } catch (error) {
              console.error('Error parsing fund card:', error);
            }
          });

          return fundData;
        });

        logger.info(`Found ${scrapedFunds.length} funds on page ${pageNumber}`);

        // Track new funds found on this page
        let newFundsOnPage = 0;

        // Process and add to allFunds
        scrapedFunds.forEach((item: any) => {
          try {
            const name = item.name || '';
            const manager = item.manager || '';
            const yieldText = item.yieldText || '';
            const minimumInvestment = item.minimumInvestment || '';
            const riskProfile = item.riskProfile || '';
            const productUrl = item.productUrl || '';

            // Check if we've already seen this fund
            if (seenFunds.has(name)) {
              logger.debug(`Duplicate fund found: ${name}`);
              return; // Skip this duplicate
            }

            if (name && manager) {
              // Construct product URL from fund data
              const finalProductUrl = productUrl || this.constructProductUrl(name, manager, fundType);

              allFunds.push({
                name: manager, // FIXED: manager is the actual fund name
                fundManager: name, // FIXED: name is the actual fund manager
                type: fundType as any,
                lastUpdated: new Date(),
                yieldToDate: yieldText,
                minimumInvestment: minimumInvestment,
                riskProfile: riskProfile,
                // Product detail page URL (constructed from fund data)
                url: finalProductUrl,
                // Category page URL (fund type comparison page)
                categoryUrl: url,
              });

              // Mark this fund as seen (use manager as the unique identifier)
              seenFunds.add(manager);
              newFundsOnPage++;
            }
          } catch (error) {
            logger.debug('Error processing fund item:', error);
          }
        });

        // Check if this page had no new funds (all duplicates)
        if (newFundsOnPage === 0 && scrapedFunds.length > 0) {
          consecutiveDuplicatePages++;
          logger.info(`Page ${pageNumber} had no new funds (all duplicates). Consecutive duplicate pages: ${consecutiveDuplicatePages}`);

          // Stop if we've seen 2 consecutive pages of all duplicates
          if (consecutiveDuplicatePages >= 2) {
            logger.info('Stopping pagination: encountered 2 consecutive pages with no new funds');
            hasMorePages = false;
          }
        } else {
          // Reset counter if we found new funds
          consecutiveDuplicatePages = 0;
          logger.info(`Page ${pageNumber}: ${newFundsOnPage} new funds added`);
        }

        // Check for next page button and click it
        try {
          // Get current page URL before clicking
          const currentPageUrl = page.url();

          // If we're on the same URL as previous iteration, stop (stuck in loop)
          if (previousPageUrl === currentPageUrl && pageNumber > 1) {
            logger.warn(`Page URL hasn't changed from previous iteration. Stopping to prevent infinite loop.`);
            hasMorePages = false;
            break;
          }

          previousPageUrl = currentPageUrl;

          const nextButtonClicked = await page.evaluate(() => {
            // Look for various pagination button selectors
            const possibleSelectors = [
              'button[aria-label="Next"]',
              'button[aria-label="next"]',
              'button.next',
              'button:has-text("Next")',
              'a[aria-label="Next"]',
              'a.next',
              '[class*="next"]',
              '[class*="pagination"] button:last-child',
              '[class*="pagination"] a:last-child',
            ];

            for (const selector of possibleSelectors) {
              try {
                const button = document.querySelector(selector);
                if (button && !button.hasAttribute('disabled') && !button.classList.contains('disabled')) {
                  (button as HTMLElement).click();
                  return true;
                }
              } catch (e) {
                // Try next selector
              }
            }

            return false;
          });

          if (!nextButtonClicked) {
            logger.info(`No more pages found for ${fundType}`);
            hasMorePages = false;
          } else {
            // Wait for the page to load new content
            await this.delay(3000);

            // Verify page actually changed by checking URL
            const newPageUrl = page.url();
            if (newPageUrl === currentPageUrl) {
              logger.warn(`Page URL didn't change after clicking next button. Stopping pagination.`);
              hasMorePages = false;
            } else {
              await page.waitForSelector('[class*="providerName"]', { timeout: 10000 }).catch(() => {
                logger.warn('Timeout waiting for next page to load');
              });
              pageNumber++;
            }
          }
        } catch (error) {
          logger.debug('Error checking for next page:', error);
          hasMorePages = false;
        }
      }

      logger.info(`Successfully scraped ${allFunds.length} ${fundType} funds from ${pageNumber} page(s)`);

      await page.close();
      return allFunds;
    } catch (error) {
      logger.error(`Error scraping page ${url}:`, error);
      if (page) await page.close();
      return allFunds; // Return what we've collected so far
    }
  }

  /**
   * Extract fund manager name from fund name
   */
  private extractManagerFromName(fundName: string): string {
    const managers = [
      'Stanbic IBTC', 'ARM', 'Coronation', 'FCMB', 'Vetiva',
      'FBNQuest', 'Meristem', 'Chapel Hill', 'Investment One',
      'CSL', 'Lotus', 'United Capital', 'Greenwich',
      'CardinalStone', 'Nova', 'Cowry', 'PAC', 'Fidelity',
      'Sterling', 'Ecobank',
    ];

    for (const manager of managers) {
      if (fundName.toLowerCase().includes(manager.toLowerCase())) {
        return manager;
      }
    }

    return 'Unknown';
  }

  /**
   * Cache funds to file
   */
  private cacheFunds(funds: FundData[]): void {
    try {
      const cacheData = {
        lastUpdated: new Date().toISOString(),
        funds: funds,
      };

      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
      logger.info(`Cached ${funds.length} funds to ${this.cacheFile}`);
    } catch (error) {
      logger.error('Error caching funds:', error);
    }
  }

  /**
   * Validate cached fund data structure and integrity
   */
  private validateCacheData(cacheData: any): boolean {
    try {
      // Check required fields exist
      if (!cacheData || typeof cacheData !== 'object') {
        logger.warn('Cache validation failed: invalid data structure');
        return false;
      }

      if (!cacheData.lastUpdated || !cacheData.funds || !Array.isArray(cacheData.funds)) {
        logger.warn('Cache validation failed: missing required fields');
        return false;
      }

      // Validate last updated timestamp
      const lastUpdated = new Date(cacheData.lastUpdated);
      if (isNaN(lastUpdated.getTime())) {
        logger.warn('Cache validation failed: invalid lastUpdated timestamp');
        return false;
      }

      // Validate each fund has required fields
      for (const fund of cacheData.funds) {
        if (!fund.name || !fund.fundManager || !fund.type) {
          logger.warn('Cache validation failed: fund missing required fields');
          return false;
        }

        // Validate fund type
        const validTypes = ['money_market', 'fixed_income', 'dollar', 'balance', 'equity'];
        if (!validTypes.includes(fund.type)) {
          logger.warn(`Cache validation failed: invalid fund type "${fund.type}"`);
          return false;
        }
      }

      // Validate cache isn't corrupted (reasonable data size)
      if (cacheData.funds.length === 0) {
        logger.warn('Cache validation failed: no funds in cache');
        return false;
      }

      if (cacheData.funds.length > 10000) {
        logger.warn('Cache validation failed: suspiciously large number of funds');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating cache data:', error);
      return false;
    }
  }

  /**
   * Get cached funds with validation
   */
  getCachedFunds(): FundData[] {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        const cache = JSON.parse(data);

        // Validate cache data before using
        if (!this.validateCacheData(cache)) {
          logger.error('Cache validation failed, removing corrupted cache file');
          fs.unlinkSync(this.cacheFile);
          return [];
        }

        const funds = cache.funds.map((fund: any) => ({
          ...fund,
          lastUpdated: new Date(fund.lastUpdated),
        }));

        logger.info(`Loaded ${funds.length} funds from cache (last updated: ${cache.lastUpdated})`);
        return funds;
      }
    } catch (error) {
      logger.error('Error reading cache:', error);
      // If cache is corrupted, try to remove it
      try {
        if (fs.existsSync(this.cacheFile)) {
          fs.unlinkSync(this.cacheFile);
          logger.info('Removed corrupted cache file');
        }
      } catch (unlinkError) {
        logger.error('Error removing corrupted cache:', unlinkError);
      }
    }

    return [];
  }

  /**
   * Check if cache is stale (older than specified hours)
   */
  isCacheStale(hours: number = 24): boolean {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        const cache = JSON.parse(data);
        const lastUpdated = new Date(cache.lastUpdated);
        const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

        return hoursSinceUpdate > hours;
      }
    } catch (error) {
      logger.error('Error checking cache staleness:', error);
    }

    return true;
  }

  /**
   * Get funds with automatic cache/refresh logic
   */
  async getFunds(forceRefresh: boolean = false): Promise<FundData[]> {
    if (forceRefresh || this.isCacheStale(24)) {
      logger.info('Cache is stale or refresh forced, scraping fresh data from NairaCompare...');
      return await this.scrapeFunds();
    } else {
      logger.info('Using cached fund data');
      return this.getCachedFunds();
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get last scrape time
   */
  getLastScrapeTime(): Date | null {
    return this.lastScrapeTime;
  }
}

export default new ScraperService();
