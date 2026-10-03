const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
        const page = await browser.newPage();
        
        page.on('console', msg => {
            const text = msg.text();
            // Filter only relevant logs
            if (!text.includes('ApexCache') && !text.includes('[DOM]') && !text.includes('autocomplete') && !text.includes('Password')) {
                console.log('LOG:', text);
            }
        });
        page.on('pageerror', err => console.log('JS ERROR:', err.toString()));

        await page.goto('https://apexamostra-production.up.railway.app/admin.html', {waitUntil: 'networkidle0'});
        await page.type('#login-user', 'admin');
        await page.type('#login-pass', 'apex2026');
        await page.click('button[type="submit"]');
        
        // Wait for login to complete
        await new Promise(r => setTimeout(r, 3000));
        
        const isLoggedIn = await page.evaluate(() => !!localStorage.getItem('apex_token'));
        console.log('IS LOGGED IN:', isLoggedIn);
        
        // Check if carregarPlanejamentoEstrategicov3 exists
        const fnExists = await page.evaluate(() => typeof window.carregarPlanejamentoEstrategicov3);
        console.log('carregarPlanejamentoEstrategicov3 type:', fnExists);
        
        const popularFnExists = await page.evaluate(() => typeof window.popularSelectsProdutoEstrategicov3);
        console.log('popularSelectsProdutoEstrategicov3 type:', popularFnExists);

        // Check global _listTabelaPrecosEstrategica
        const listState = await page.evaluate(() => {
            return {
                isArray: Array.isArray(window._listTabelaPrecosEstrategica),
                length: Array.isArray(window._listTabelaPrecosEstrategica) ? window._listTabelaPrecosEstrategica.length : 'N/A',
                type: typeof window._listTabelaPrecosEstrategica
            };
        });
        console.log('_listTabelaPrecosEstrategica state (before nav):', JSON.stringify(listState));
        
        // Click the Estratégico nav item
        console.log('Clicking Estrategico nav item...');
        await page.evaluate(() => {
            const navItems = document.querySelectorAll('[data-target]');
            let found = false;
            navItems.forEach(item => {
                if (item.dataset.target === 'planejamento-estrategicov3-view') {
                    console.log('Found nav item, clicking...');
                    item.click();
                    found = true;
                }
            });
            if (!found) console.log('Nav item NOT found');
        });
        
        await new Promise(r => setTimeout(r, 3000));
        
        // Check state after click
        const listStateAfter = await page.evaluate(() => ({
            isArray: Array.isArray(window._listTabelaPrecosEstrategica),
            length: Array.isArray(window._listTabelaPrecosEstrategica) ? window._listTabelaPrecosEstrategica.length : 'N/A'
        }));
        console.log('_listTabelaPrecosEstrategica state (AFTER nav):', JSON.stringify(listStateAfter));
        
        // Check select options count
        const selectCount = await page.evaluate(() => {
            const sel = document.getElementById('plestv3-consulta-material');
            if (!sel) return 'SELECT_NOT_FOUND';
            return sel.options.length;
        });
        console.log('Select options count:', selectCount);
        
        await browser.close();
    } catch(e) {
        console.error('Error:', e);
    }
})();
