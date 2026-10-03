const fs = require('fs');
const path = require('path');

const ADMIN_PATH = path.join(__dirname, '../admin.js');
let content = fs.readFileSync(ADMIN_PATH, 'utf8');

// 1. Remove: document.addEventListener('DOMContentLoaded', () => {
content = content.replace("document.addEventListener('DOMContentLoaded', () => {", "// DOMContentLoaded wrapper removed");

// 2. Remove: }); // end DOMContentLoaded
content = content.replace("}); // end DOMContentLoaded", "// end DOMContentLoaded removed");

// 3. Remove: (function() { (the IIFE)
// From the grep, it was somewhere around line 13676
content = content.replace("(function() {", "// IIFE start removed");

// 4. Remove: })(); (the IIFE end)
content = content.replace("})();", "// IIFE end removed");

fs.writeFileSync(ADMIN_PATH, content);
console.log('Wrappers removed successfully.');
