const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../');

function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
        const fullPath = path.join(currentDir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('assets')) {
                walk(fullPath);
            }
        } else {
            if (fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.md')) {
                let content = fs.readFileSync(fullPath, 'utf8');
                let originalContent = content;

                // Replace ApexTech with ApexTech
                content = content.replace(/ApexTech/g, 'ApexTech');
                content = content.replace(/APEXTECH/g, 'APEXTECH');
                content = content.replace(/apextech/g, 'apextech');

                if (fullPath.endsWith('admin.js')) {
                    // Remove the status text rendering from PDF
                    content = content.replace(/doc\.text\(\`\[ \$\{cliStatusText\} \]\`, 192, 40, \{ align: 'right' \}\);/g, "// Removed status text");
                }

                if (content !== originalContent) {
                    fs.writeFileSync(fullPath, content);
                    console.log(`Updated: ${fullPath}`);
                }
            }
        }
    }
}

walk(dir);
console.log('Done!');
