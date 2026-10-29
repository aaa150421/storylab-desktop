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
const primaryCss = styles[0]?.[1] || '';
check(primaryCss.includes('--rail:108px'), 'Compact writing-first navigation rail is missing.');
check(primaryCss.includes('body.writer-focus>header,body.writer-focus>#appTabs,body.writer-focus>nav'), 'Focus mode does not hide application chrome.');
check(primaryCss.includes('body.app-pane-mode>header,body.app-pane-mode>#appTabs,body.app-pane-mode>nav'), 'Embedded pane mode does not hide application chrome.');
check(primaryCss.includes('padding-top:58px!important'), 'Split main pane does not reserve the tab strip and content inset.');
check(primaryCss.includes('body.app-split-active.writer-focus #workspaceSplit>#main{padding-top:14px!important}'), 'Focus mode does not release the split-tab offset.');
check(!/body\.app-pane-mode[^{}]*#main[^{}]*\{[^}]*margin-top:\s*-14px\s*!important/i.test(html), 'Conflicting negative right-pane offset remains.');

check(primaryCss.includes('[data-theme="light"]'), 'Light theme styling is missing after the UI redesign.');
check(primaryCss.includes('--shell:#f0f1ed'), 'Light theme does not override shell surfaces.');
check(html.includes('Never fall through to writing a stale full-project'), 'Split-pane save does not fail closed when shared state is missing.');
check(html.includes("if(!latestWork||!Array.isArray(latestWork.chapters))"), 'Split-pane save does not validate the shared work before writing.');
check(html.includes("if(!baseSnap&&remoteSnap!==localSnap)"), 'Split-pane save can overwrite remote edits without a baseline.');
check(html.includes("if(!remoteChapter)"), 'Split-pane save does not detect a missing remote chapter.');

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
check((html.match(/--rail:108px/g) || []).length === 1, 'Expected one consolidated UI stylesheet with compact navigation sizing.');
check(!html.includes('split-pane-top-alignment-canonical'), 'Separate legacy alignment style block remains.');
check(!/body\.app-pane-mode[^{}]*#main[^{}]*\{[^}]*margin-top:\s*-14px\s*!important/i.test(html), 'Conflicting negative right-pane offset remains.');
check(!html.includes('chapterLockToggle') && !html.includes('c.locked'), 'Unrequested manuscript-lock logic remains.');
check(html.includes('id="findReplaceDialog"') && html.includes('id="findNext"') && html.includes('id="findPrev"'), 'Find-only dialog controls are missing.');
check(html.includes("e.key.toLowerCase()==='f'"), 'Ctrl+F manuscript search shortcut is missing.');
check(!html.includes('id="replaceAllButton"') && !html.includes('id="replaceWith"'), 'Unrequested find-and-replace controls remain.');
check(html.includes('.scene-memo-dialog[hidden]{display:none!important}'), 'Hidden dialogs can still be shown by the dialog display rule.');
check(html.includes("context.className='workspace-context'") && html.includes('이 작품에만 저장되는 설정입니다.'), 'Manuscript-scoped tools do not identify the active work.');
check(html.includes("localStorage.setItem(KEY+'-recovery'"), 'Deleted chapter recovery copy is not preserved.');
check(!/if\(chapter\)\{var ix=work\.chapters\.indexOf\(chapter\);work\.chapters\[ix\]=preserved;\}else work\.chapters\.push\(preserved\);/.test(html), 'Remote deletion is still silently undone by chapter resurrection.');
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

function extractFunction(name) {
  const match = html.match(new RegExp('function ' + name + '\\([^\\n]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  return match ? match[0] : null;
}
const chapterSnapshotSource = extractFunction('chapterSnapshot');
const findStoredChapterSource = extractFunction('findStoredChapter');
const saveSource = extractFunction('save');
check(!!chapterSnapshotSource && !!findStoredChapterSource && !!saveSource, 'Could not extract save functions for behavioral tests.');
if (chapterSnapshotSource && findStoredChapterSource && saveSource) {
  function exerciseSave({ shared, localBody, baseBody, remoteBody }) {
    const localChapter = { id: 'chapter-1', title: 'Chapter', body: localBody, memo: '' };
    const localRoot = { works: [{ id: 'work-1', chapters: [localChapter], cur: 'chapter-1' }], w: 'work-1', tab: 'write' };
    const stored = shared === null ? null : JSON.stringify(shared || {
      works: [{ id: 'work-1', chapters: [{ id: 'chapter-1', title: 'Chapter', body: remoteBody, memo: '' }], cur: 'chapter-1' }]
    });
    let writes = 0;
    let savedValue = null;
    const context = {
      KEY: 'storylab-test',
      R: { w: 'work-1', tab: 'write' },
      EDIT: true,
      APP_PANE_MODE: true,
      S: {},
      LAST_SAVED_CHAPTER_SNAP: baseBody === null ? null : JSON.stringify({ title: 'Chapter', body: baseBody, memo: '' }),
      PANE_CONFLICT_PENDING: false,
      HISTORY_BASELINE: '',
      HISTORY_CHECKPOINT: '',
      HISTORY_LAST_AT: 0,
      HISTORY_APPLYING: false,
      HISTORY_LIMIT: 40,
      saveStatusTimer: null,
      UNDO_STACK: [],
      REDO_STACK: [],
      stateString: () => JSON.stringify(localRoot),
      cur: () => localChapter,
      localStorage: {
        getItem: () => stored,
        setItem: (key, value) => { writes += 1; savedValue = value; }
      },
      showSaveStatus: () => {},
      clearTimeout: () => {},
      setTimeout: () => 1,
      console
    };
    vm.runInNewContext(chapterSnapshotSource + '\n' + findStoredChapterSource + '\n' + saveSource, context);
    return { ok: context.save(), writes, savedValue, localChapter };
  }
  const missingShared = exerciseSave({ shared: null, localBody: 'local', baseBody: 'old', remoteBody: 'old' });
  check(missingShared.ok === false && missingShared.writes === 0, 'Save must not overwrite the full project if shared storage is missing.');
  const cleanMerge = exerciseSave({ localBody: 'edited', baseBody: 'old', remoteBody: 'old' });
  const mergedRoot = cleanMerge.savedValue ? JSON.parse(cleanMerge.savedValue) : null;
  check(cleanMerge.ok === true && cleanMerge.writes === 1 && mergedRoot?.works?.[0]?.chapters?.[0]?.body === 'edited', 'A non-conflicting chapter edit should merge and save.');
  const conflict = exerciseSave({ localBody: 'local edit', baseBody: 'old', remoteBody: 'remote edit' });
  check(conflict.ok === false && conflict.writes === 0, 'Concurrent local and remote edits must be rejected instead of overwriting either copy.');
  const noBaseline = exerciseSave({ localBody: 'local', baseBody: null, remoteBody: 'remote' });
  check(noBaseline.ok === false && noBaseline.writes === 0, 'Missing save baseline must not overwrite a different remote chapter.');
  const missingChapter = exerciseSave({
    shared: { works: [{ id: 'work-1', chapters: [], cur: 'chapter-1' }] },
    localBody: 'local', baseBody: 'old', remoteBody: 'old'
  });
  check(missingChapter.ok === false && missingChapter.writes === 0, 'A chapter removed in another pane must not be silently recreated.');
}

if (failures.length) {
  console.error('이야기공방 정적 검사 실패:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`정적 검사 통과: v${pkg.version}, CSS ${styles.length}개, 인라인 JS ${scripts.length}개`);
}
