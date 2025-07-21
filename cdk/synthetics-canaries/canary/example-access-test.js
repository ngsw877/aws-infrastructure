const { synthetics } = require('@amzn/synthetics-playwright');

exports.handler = async (event, context) => {
    const url = 'https://example.com';
    
    let browser = null;
    let browserContext = null;
    let page = null;
    
    try {
        // ブラウザとページの初期化
        browser = await synthetics.launch();
        browserContext = await browser.newContext();
        page = await synthetics.newPage(browserContext);
        
        // ステップ1: Example.comへアクセス
        await synthetics.executeStep('navigate-to-example-com', async () => {
            console.log(`Navigating to ${url}`);
            
            let response = null;
            let lastError = null;
            
            // リトライロジック（最大3回）
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`Attempt ${attempt}/3`);
                    response = await page.goto(url, {
                        waitUntil: 'load',
                        timeout: 45000
                    });
                    
                    if (response && response.status() === 200) {
                        break; // 成功した場合はループを抜ける
                    }
                    
                    throw new Error(`Status code: ${response?.status()}`);
                } catch (error) {
                    lastError = error;
                    console.log(`Attempt ${attempt} failed: ${error.message}`);
                    
                    if (attempt < 3) {
                        console.log('Waiting 5 seconds before retry...');
                        await page.waitForTimeout(5000);
                    }
                }
            }
            
            if (!response || response.status() !== 200) {
                throw lastError || new Error('Failed to load page after 3 attempts');
            }
            
            console.log(`Page loaded successfully. Status: ${response.status()}`);
        });
        
        // ステップ2: ページコンテンツの検証
        await synthetics.executeStep('verify-page-content', async () => {
            console.log('Verifying page content');
            
            // ページタイトルの確認
            const pageTitle = await page.title();
            console.log(`Page title: ${pageTitle}`);
            
            if (!pageTitle || !pageTitle.toLowerCase().includes('example')) {
                throw new Error(`Expected "Example" in title, got: ${pageTitle}`);
            }
            
            // H1要素の確認
            const h1Text = await page.locator('h1').textContent();
            console.log(`H1 text: ${h1Text}`);
            
            if (!h1Text || !h1Text.includes('Example Domain')) {
                throw new Error(`Expected "Example Domain" in H1, got: ${h1Text}`);
            }
            
            // リンクの存在確認
            const moreInfoLink = await page.locator('a[href*="iana.org"]').isVisible();
            console.log(`More information link visible: ${moreInfoLink}`);
            
            if (!moreInfoLink) {
                throw new Error('More information link not found');
            }
            
            console.log('Page content verification passed');
        });
        
        // ステップ3: パフォーマンスチェック（オプション）
        await synthetics.executeStep('check-page-performance', async () => {
            console.log('Checking page performance');
            
            // ページの読み込み時間を取得
            const performanceTiming = await page.evaluate(() => {
                const timing = window.performance.timing;
                return {
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    loadComplete: timing.loadEventEnd - timing.navigationStart
                };
            });
            
            console.log(`DOM Content Loaded: ${performanceTiming.domContentLoaded}ms`);
            console.log(`Page Load Complete: ${performanceTiming.loadComplete}ms`);
            
            // パフォーマンスしきい値のチェック（5秒）
            if (performanceTiming.loadComplete > 5000) {
                console.warn(`Page load time exceeded 5 seconds: ${performanceTiming.loadComplete}ms`);
            }
        });
        
        console.log('Example.com access test completed successfully');
        
    } catch (error) {
        console.error(`Canary failed: ${error.message}`);
        throw error;
    } finally {
        await synthetics.close();
    }
};