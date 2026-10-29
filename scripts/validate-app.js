'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'storylab.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const failures = [];
function check(condition, message) { if (!condition) failures.push(message); }
function balancedCss(source) {
  let depth = 0, quote = '', comment = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (comment) { if (ch === '*' && next === '/') { comment = false; i += 1; } continue; }
    if (quote) { if (ch === '\\') { i += 1; continue; } if (ch === quote) quote = ''; continue; }
    if (ch === '/' && next === '*') { comment = true; i += 1; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth < 0) return false; }
  }
  return depth === 0 && !quote && !comment;
}
const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
check(styles.length === (html.match(/<\/style>/gi) || []).length, 'CSS style tag pair count does not match.');
for (const [i, match] of styles.entries()) check(balancedCss(match[1]), 'CSS braces or comments are unbalanced in style block ' + (i + 1) + '.');
const css = styles[0]?.[1] || '';
for (const token of ['--bg:#f8f7fb','--paper:#fff','--purple:#8b6bd1','.sidebar','.hero','.work-grid','.editor-layout']) {
  check(css.includes(token), 'Fresh white-and-lavender UI token is missing: ' + token);
}
for (const id of ['view','search','fileInput','exportTop','importTop','toast']) check(html.includes('id="' + id + '"'), 'Required UI element is missing: #' + id);
for (const page of ['home','works','editor','backup','settings']) check(html.includes('data-page="' + page + '"'), 'Navigation page is missing: ' + page);
for (const fn of ['function renderHome()','function renderWorks()','function renderEditor()','function renderBackup()','function exportBackup()','function importBackup(file)','function syncEditor()']) check(html.includes(fn), 'Required UI/data function is missing: ' + fn);
check(html.includes("BACKUP_APP='storylab'"), 'Backup compatibility app identifier is missing.');
check(html.includes('o.state&&Array.isArray(o.state.works)'), 'Legacy full-state backup restore support is missing.');
check(html.includes('o&&o.app===BACKUP_APP&&Array.isArray(o.works)'), 'Legacy StoryLab JSON backup import support is missing.');
check(html.includes('URL.createObjectURL(blob)') && html.includes("a.download='이야기공방-백업-"), 'JSON backup download is not implemented.');
check(html.includes("fr.readAsText(file,'utf-8')"), 'JSON backup file reading is not implemented.');
check(html.includes('localStorage.setItem(KEY,JSON.stringify(state))'), 'Local auto-save is missing.');
check(html.includes("const KEY='storylab.fresh.workspace.v1'"), 'Fresh UI must use its own isolated local-storage key.');
check(html.includes('chapters') && html.includes('updatedAt'), 'Imported legacy work fields are not preserved.');
check(fs.readFileSync(path.join(root, 'main.js'), 'utf8').includes("path.join(__dirname, 'build', 'icon.ico')"), 'Electron window icon is not configured.');
check(pkg.build?.files?.includes('storylab.html'), 'Electron package does not include storylab.html.');
check(pkg.build?.files?.includes('main.js') && pkg.build?.files?.includes('preload.js'), 'Electron package is missing main/preload scripts.');
check(pkg.version === lock.version && pkg.version === lock.packages?.['']?.version, 'package.json and package-lock.json versions differ.');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
check(scripts.length > 0, 'Inline application script is missing.');
for (const [i, match] of scripts.entries()) {
  try { new vm.Script(match[1], { filename: 'storylab.html:inline-script-' + (i + 1) }); }
  catch (error) { failures.push('Inline JavaScript ' + (i + 1) + ' failed syntax validation: ' + error.message); }
}
if (failures.length) {
  console.error('이야기공방 정적 검사 실패:');
  for (const failure of failures) console.error('- ' + failure);
  process.exitCode = 1;
} else {
  console.log('새 UI 정적 검사 통과: v' + pkg.version + ', CSS ' + styles.length + '개, 인라인 JS ' + scripts.length + '개');
}
