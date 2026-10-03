const https = require('https');
function request() {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'apexamostra-production.up.railway.app',
            path: '/api/db-test-query',
            method: 'GET'
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.end();
    });
}
request().then(res => console.log(res.body));
