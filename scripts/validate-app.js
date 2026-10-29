'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'storylab.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function balancedCss(source) {
  let depth = 0;
  let quote = '';
  let comment = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (comment) {
      if (ch === '*' && next === '/') { comment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') { comment = true; i += 1; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') { depth -= 1; if (depth < 0) return false; }
  }
  return depth === 0 && !quote && !comment;
}

const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
check(styles.length === (html.match(/<\/style>/gi) || []).length, 'CSS style tag pair count does not match.');
for (const [index, match] of styles.entries()) {
  check(balancedCss(match[1]), `CSS braces or comments are unbalanced in style block ${index + 1}.`);
}

const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
for (const [index, match] of scripts.entries()) {
  try {
    new vm.Script(match[1], { filename: `storylab.html:inline-script-${index + 1}` });
  } catch (error) {
    failures.push(`Inline JavaScript ${index + 1} failed syntax validation: ${error.message}`);
  }
}

check(pkg.version === lock.version, 'package.json and package-lock.json versions differ.');
check(pkg.version === lock.packages?.['']?.version, 'Root package-lock version differs from package.json.');
check((html.match(/id="split-pane-top-alignment-canonical"/g) || []).length === 1, 'Expected exactly one canonical split-pane alignment block.');
check(!html.includes('split-pane-top-alignment-canonical-1-4-8'), 'Legacy split-pane alignment block remains.');
check(!/mainPane\.style\.setProperty\(['"]padding-top['"]/.test(html), 'Runtime inline padding-top override remains.');
check(!/mainPane\.style\.(?:flex|width|maxWidth)\s*=/.test(html), 'Runtime inline pane sizing override remains.');
check(!/\.workspace-split\.has-multiple\s*>\s*#main\s*\{[^}]*flex:\s*0\s+0\s+50%/i.test(html), 'Legacy hard-coded 50% main-pane sizing remains.');
check(!/body\.app-split-active[^{}]*#workspaceSplit\s*>\s*#main\s*\{[^}]*padding-top:\s*(?:50|52|58)px\s*!important/i.test(html), 'Conflicting legacy left-pane top offset remains.');
check(!/body\.app-pane-mode[^{}]*#main[^{}]*\{[^}]*margin-top:\s*-14px\s*!important/i.test(html), 'Conflicting negative right-pane offset remains.');

if (failures.length) {
  console.error('이야기공방 정적 검사 실패:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`정적 검사 통과: v${pkg.version}, CSS ${styles.length}개, 인라인 JS ${scripts.length}개`);
}
