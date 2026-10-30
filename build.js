/* Rebuild the distributable HTML with Node; no npm install required. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let html = read('pulley-calculator.template.html');
for (const file of ['pulley-math.js', 'vendor/earcut.min.js', 'pulley-mesh.js']) {
  const license = file.includes('earcut') ? `/* Earcut 2.2.4\n${read('vendor/earcut-LICENSE')}\n*/\n` : '';
  html = html.replace(`<script src="${file}"></script>`, () => `<script>\n${license}${read(file).replace(/<\/script/gi, '<\\/script')}\n</script>`);
}
const image = fs.readFileSync(path.join(root, 'references/misumi-htd5m-profile.jpg')).toString('base64');
html = html.replace('src="references/misumi-htd5m-profile.jpg"', `src="data:image/jpeg;base64,${image}"`);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built standalone index.html (${Buffer.byteLength(html)} bytes).`);
