const { synthetics } = require('@amzn/synthetics-playwright');

exports.handler = async (event, context) => {
    const url = 'https://the-internet.herokuapp.com/login';
    const username = 'tomsmith';
    const password = 'SuperSecretPassword!';
    
    let browser = null;
    let browserContext = null;
    let page = null;
    
    try {
        // ブラウザとページの初期化
        browser = await synthetics.launch();
        browserContext = await browser.newContext();
        page = await synthetics.newPage(browserContext);
        
        // ステップ1: ログインページにアクセス
        await synthetics.executeStep('navigate-to-login-page', async () => {
            console.log(`Navigating to ${url}`);
            const response = await page.goto(url, { 
                waitUntil: 'load',
                timeout: 30000 
            });
            
            if (!response || response.status() !== 200) {
                throw new Error(`Failed to load login page. Status: ${response?.status()}`);
            }
            
            console.log('Login page loaded successfully');
        });
        
        // ステップ2: ユーザー名を入力
        await synthetics.executeStep('enter-username', async () => {
            await page.waitForSelector('#username');
            await page.type('#username', username);
            console.log('Username entered');
        });
        
        // ステップ3: パスワードを入力
        await synthetics.executeStep('enter-password', async () => {
            await page.waitForSelector('#password');
            await page.type('#password', password);
            console.log('Password entered');
        });
        
        // ステップ4: フォーム送信
        await synthetics.executeStep('submit-login-form', async () => {
            console.log('Submitting login form');
            
            const originalUrl = page.url();
            
            // ボタンクリック
            await page.click('button[type="submit"]');
            await page.waitForTimeout(3000);
            
            const currentUrl = page.url();
            
            // URLが変わらない場合は、JavaScriptで直接送信
            if (currentUrl === originalUrl) {
                console.log('Retrying with direct form submission');
                await page.evaluate(() => {
                    // 値を再設定して送信
                    document.querySelector('#username').value = 'tomsmith';
                    document.querySelector('#password').value = 'SuperSecretPassword!';
                    document.querySelector('form').submit();
                });
                await page.waitForTimeout(3000);
            }
        });
        
        // ステップ5: ログイン結果の確認
        await synthetics.executeStep('verify-login-success', async () => {
            console.log('Verifying login result');
            
            const currentUrl = page.url();
            const pageContent = await page.evaluate(() => {
                const flash = document.querySelector('#flash');
                const logoutLink = document.querySelector('a[href="/logout"]');
                return {
                    url: window.location.href,
                    flashMessage: flash ? flash.textContent.trim() : '',
                    hasLogoutLink: !!logoutLink
                };
            });
            
            console.log(`Current URL: ${currentUrl}`);
            console.log(`Flash message: ${pageContent.flashMessage}`);
            
            // ログイン成功の判定
            if (currentUrl.includes('/secure') || 
                pageContent.hasLogoutLink ||
                pageContent.flashMessage.includes('logged into')) {
                console.log('Login test PASSED');
            } else {
                throw new Error(`Login failed. Current URL: ${currentUrl}`);
            }
        });
        
        console.log('Login test completed successfully');
        
    } catch (error) {
        console.error(`Canary failed: ${error.message}`);
        throw error;
    } finally {
        await synthetics.close();
    }
};