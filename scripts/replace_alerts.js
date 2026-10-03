const fs = require('fs');
const files = [
  'admin_live.js',
  'assets/js/modules/admin_planejamento_v4.js',
  'assets/js/modules/admin_estrategicov3.js',
  'assets/js/modules/admin_planejamento.js'
];
let totalReplacements = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let count = 0;
  content = content.replace(/\balert\((.*?)\)/g, (match, p1) => {
    // se o p1 estiver vazio (ex: alert()), ignorar ou preencher
    if (!p1.trim()) return match;
    count++;
    return `(window._apexNotify ? window._apexNotify('Notificação', ${p1}, 'info') : alert(${p1}))`;
  });
  if (count > 0) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}: ${count} replacements`);
    totalReplacements += count;
  }
}
console.log(`Total replacements: ${totalReplacements}`);
