const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
    
    // Serve admin.html locally without a webserver? No, localhost:3000 is running!
    await page.goto('http://localhost:3000');
    
    // Login
    await page.type('#login-usuario', 'admin');
    await page.type('#login-senha', '123456');
    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({waitUntil: 'networkidle2'})
    ]);
    
    // Wait for the side menu button to be visible
    await page.waitForSelector('#nav-planejamento-estrategicov3');
    
    // Click Estrategico
    await page.evaluate(() => {
        document.getElementById('nav-planejamento-estrategicov3').click();
    });
    
    // Wait for it to render
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Attempting to click radar...");
    await page.evaluate(() => {
        document.getElementById('tab-btn-estr-radar').click();
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Print display style of the section
    const display = await page.evaluate(() => {
        return document.getElementById('subaba-estr-radar').style.display;
    });
    console.log("Radar display style:", display);
    
    await browser.close();
})();
