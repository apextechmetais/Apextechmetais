const fs = require('fs');
const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

const badPattern = '        }\\n    };';
const goodReplacement = `        } else if (lblFeed) {
            lblFeed.style.display = 'none';
        }
    };`;

if (content.includes(badPattern)) {
    content = content.replace(badPattern, goodReplacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed successfully.');
} else {
    // Try with literal backslash-n
    const raw = fs.readFileSync(filePath);
    const str = raw.toString();
    const idx = str.indexOf('        }\\n    };');
    if (idx >= 0) {
        const fixed = str.slice(0, idx) + goodReplacement + str.slice(idx + '        }\\n    };'.length);
        fs.writeFileSync(filePath, fixed, 'utf8');
        console.log('Fixed via raw index.');
    } else {
        console.log('Pattern not found, showing surrounding context:');
        // show bytes around line 16082
        const lines = str.split('\n');
        for (let i = 16078; i < 16088; i++) {
            console.log(`${i+1}: ${JSON.stringify(lines[i])}`);
        }
    }
}
