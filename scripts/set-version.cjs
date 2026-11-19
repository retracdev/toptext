#!/usr/bin/env node
/*
 * Sets the published version of Toptext in both places it lives:
 *   version.yml                                what open tabs check every 30 seconds
 *   <meta name="toptext-version"> in index.html  what the downloaded page says it is
 * Live updates only install a page whose meta matches version.yml, so change them together.
 *
 * Usage: npm run set-version -- 0.2
 *        npm run set-version            (no version: copy version.yml's into index.html)
 *
 * The "Sync version" workflow runs the second form on every push to main, so editing
 * version.yml on its own is enough.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const fromFile = () => {
  const match = /^\s*version\s*:\s*(["']?)([^"'\s#]+)\1/m.exec(fs.readFileSync(path.join(ROOT, 'version.yml'), 'utf8'));
  return match ? match[2] : '';
};
const version = String(process.argv[2] || fromFile()).trim().replace(/^v/, '');
if (!/^\d+(\.\d+){0,3}(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: npm run set-version -- <version>   (for example 0.2)');
  process.exit(1);
}

function update(file, pattern, replacement) {
  const full = path.join(ROOT, file);
  const source = fs.readFileSync(full, 'utf8');
  if (!pattern.test(source)) {
    console.error(`Couldn't find the version in ${file}.`);
    process.exit(1);
  }
  fs.writeFileSync(full, source.replace(pattern, replacement));
}

update('version.yml', /^version:.*$/m, `version: "${version}"`);
update('index.html', /(<meta name="toptext-version" content=")[^"]*(")/, `$1${version}$2`);
console.log(`Toptext is now version ${version}. Deploy it, and open tabs update within about 30 seconds.`);
