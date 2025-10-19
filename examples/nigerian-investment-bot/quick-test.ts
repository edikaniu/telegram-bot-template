import { chromium } from 'playwright';

async function quickTest() {
  console.log('Testing scraper on money market page...');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://nairacompare.ng/investments/money-market-fund-compare', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(5000); // Wait for dynamic content to load

  const funds = await page.evaluate(() => {
    const results: any[] = [];
    const providers = document.querySelectorAll('._providerName_1kw4l_153');

    providers.forEach((providerEl: Element, index: number) => {
      const card: Element | null = providerEl.closest('.react-hubspot-listing-card');

      if (!card) return;

      const productNameEl = card.querySelector('._productName_1kw4l_181');
      const fundName = productNameEl?.textContent?.trim() || '';
      const fundManager = providerEl.textContent?.trim() || '';

      const detailsContainer = card.querySelector('._detailsItems_1kw4l_283');
      const detailsItems = detailsContainer
        ? Array.from(detailsContainer.querySelectorAll('.react-hubspot-card-item'))
        : [];

      let yieldValue = '';
      let minimumInvestment = '';
      let riskProfile = '';

      detailsItems.forEach((item: Element) => {
        const spans = Array.from(item.querySelectorAll('span'));

        if (spans.length >= 2) {
          const label = spans[0].textContent?.trim().toLowerCase() || '';
          const value = spans[spans.length - 1].textContent?.trim() || '';

          if (label.includes('min amount') || label.includes('minimum')) {
            minimumInvestment = value;
          } else if (label.includes('yield') && label.includes('date')) {
            yieldValue = value;
          } else if (label.includes('risk profile') || label === 'risk') {
            riskProfile = value;
          }
        }
      });

      results.push({
        index,
        fundName,
        fundManager,
        yieldValue,
        minimumInvestment,
        riskProfile,
        detailsItemsCount: detailsItems.length
      });
    });

    return results;
  });

  console.log('\n=== SCRAPED DATA ===\n');
  funds.slice(0, 3).forEach((fund: any) => {
    console.log(`Fund ${fund.index + 1}:`);
    console.log(`  Name: ${fund.fundName}`);
    console.log(`  Manager: ${fund.fundManager}`);
    console.log(`  Yield: ${fund.yieldValue || '(EMPTY)'}`);
    console.log(`  Min Investment: ${fund.minimumInvestment || '(EMPTY)'}`);
    console.log(`  Risk: ${fund.riskProfile || '(EMPTY)'}`);
    console.log(`  Detail items found: ${fund.detailsItemsCount}`);
    console.log('');
  });

  await browser.close();
  console.log(`Total funds extracted: ${funds.length}`);
}

quickTest().catch(console.error);
