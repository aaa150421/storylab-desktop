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
const canonicalStart = styles[0]?.[1].indexOf('/* Canonical application shell, workspace panes, and writer focus mode.') ?? -1;
const legacyShellCss = canonicalStart >= 0 ? styles[0][1].slice(0, canonicalStart) : styles[0]?.[1] || '';
check(canonicalStart >= 0, 'Canonical shell layout block is missing.');
check(!/(?:\\.workspace-split|#workspaceSplit|#appSplitPane|body\\.app-split-active|body\\.app-pane-mode|body\\.writer-focus|\\.app-pane-frame|\\.app-live-pane|\\.app-pane-tabbar|\\.app-main-tabbar|\\.app-tabs|#appTabs|\\.app-tab(?:-open|-close|-add)?\\b)/.test(legacyShellCss), 'Legacy shell, pane, or focus CSS remains outside the canonical rule set.');

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
const canonical = html.match(/\/\* Canonical application shell, workspace panes, and writer focus mode\.[\s\S]*?(?=<\/style>)/)?.[0] || '';
check((html.match(/Canonical application shell, workspace panes, and writer focus mode\./g) || []).length === 1, 'Expected one consolidated shell, pane, and focus rule set.');
check(canonical.includes('grid-template-columns:216px minmax(0,1fr)'), 'The redesigned left navigation shell is missing.');
check(canonical.includes('body.writer-focus>header,body.writer-focus>#appTabs,body.writer-focus>nav'), 'Focus mode does not hide the full application chrome.');
check(canonical.includes('body.app-split-active.writer-focus #workspaceSplit>#main {padding-top:14px!important}'), 'Focus mode does not release the split-tab offset.');
check(!html.includes('split-pane-top-alignment-canonical'), 'Separate legacy alignment style block remains.');
check(canonical.includes('padding-top:58px!important'), 'Split main pane does not reserve the 44px tab strip plus the normal 14px content inset.');
check(!/body\.app-pane-mode[^{}]*#main[^{}]*\{[^}]*margin-top:\s*-14px\s*!important/i.test(html), 'Conflicting negative right-pane offset remains.');
check(!html.includes('chapterLockToggle') && !html.includes('c.locked'), 'Unrequested manuscript-lock logic remains.');
check(html.includes('id="findReplaceDialog"') && html.includes('id="replaceAllButton"'), 'Find-and-replace dialog is missing.');
check(html.includes("e.key.toLowerCase()==='h'"), 'Ctrl+H find-and-replace shortcut is missing.');
check(html.includes('function setWriterFocus(enabled,notifyParent)'), 'Focus mode does not use the centralized state transition.');
check(!html.includes("FOCUS_MODE=!FOCUS_MODE;document.body.classList.toggle('writer-focus',FOCUS_MODE);render();"), 'Focus mode still redraws the entire editor when toggled.');
check(html.includes('function returnToManuscriptList()'), 'Manuscript-list navigation does not use the centralized transition.');
check(html.includes('var saved=save();') && html.indexOf('var saved=save();') < html.indexOf('EDIT=false;TRASH=false;FOCUS_MODE=false;DUAL_VIEW=false;SPLIT_MODE=false;', html.indexOf('function returnToManuscriptList()')), 'Return-to-list changes edit state before saving the active chapter.');
check(!/function render\(\)\{\s*DUAL_VIEW=false;SPLIT_MODE=false/.test(html), 'render() still clears editor modes on every redraw.');
check(!/body\\\.app-pane-mode[^{}]*#main[^{}]*\\\{[^}]*margin-top:\\s*-14px\\s*!important/i.test(html), 'Conflicting negative right-pane offset remains.');
check(!html.includes('background:rgba(0,0,0,.18)'), 'Scene memo dialog still dims the whole background.');
check(/\.scene-memo-dialog\s*\{[^}]*background:transparent/.test(html), 'Scene memo overlay is not transparent.');
check(html.indexOf('id="sceneMemoOpen"') < html.indexOf('id="focusToggle"'), 'Focus mode button is no longer beside the scene memo button.');
check(!html.includes("postMessage({type:'storylab-pane-force-screen',screen:tab.screen}"), 'Parent echoes pane screen changes back to the iframe.');
check(html.includes("data.type!=='storylab-pane-screen-change'"), 'Embedded pane return-to-list message handler is missing.');

if (failures.length) {
  console.error('이야기공방 정적 검사 실패:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`정적 검사 통과: v${pkg.version}, CSS ${styles.length}개, 인라인 JS ${scripts.length}개`);
}
