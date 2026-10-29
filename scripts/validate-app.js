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
check(primaryCss.includes('body.app-pane-mode>header,body.app-pane-mode>#appTabs,body.app-pane-mode>nav,body.app-pane-mode #appMainTabbar,body.app-pane-mode #appSplitPane,body.app-pane-mode .app-tabs,body.app-pane-mode .app-main-tabbar,body.app-pane-mode .app-pane-tabbar{display:none!important}'), 'Embedded pane mode does not hide nested application tab bars.');
check(primaryCss.includes('body.app-pane-mode #main{display:block!important;flex:1 1 auto!important;width:100%!important;height:auto!important;max-width:none!important;'), 'Embedded pane main content can inherit conflicting split flex sizing.');
check(primaryCss.includes('body.app-pane-mode #main>input,body.app-pane-mode #main>textarea,body.app-pane-mode #main>select{display:block!important;width:100%!important;'), 'Embedded pane form controls can render side-by-side unexpectedly.');
check(html.includes('var childWorkspace=child.getElementById(\'workspaceSplit\')') && html.includes("['flex','width','max-width','padding-top','margin-top','display','height','min-height','overflow'].forEach(function(prop){childMain.style.removeProperty(prop);})"), 'Embedded pane load does not clear stale parent split layout state.');
check(primaryCss.includes('padding-top:48px!important'), 'Split main pane does not reserve a compact tab-strip inset.');
check(primaryCss.includes('body.app-split-active.writer-focus #workspaceSplit>#main{padding-top:14px!important}'), 'Focus mode does not release the split-tab offset.');
check(primaryCss.includes('body.app-split-active:not(.writer-focus){grid-template-rows:var(--header) 0 minmax(0,1fr)}'), 'Split layout is overriding the focus-mode grid.');
check(primaryCss.includes('body.writer-focus #workspaceSplit>#appSplitPane,body.writer-focus #workspaceSplit>.app-main-tabbar{display:none!important}'), 'Focus mode leaves the sibling pane or pane title visible.');
check(primaryCss.includes('.workspace-split.has-multiple{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;'), 'Split panes are not laid out in equal-width columns.');
check(primaryCss.includes('.workspace-split.has-multiple>#main #ed{display:block;width:100%;max-width:none!important;margin:0;'), 'Left split-pane editor is still constrained by the narrow single-pane width.');
check(!html.includes('storylab-pane-header-fix') && primaryCss.includes('body.app-pane-mode>#appTabs') && primaryCss.includes('body.app-pane-mode #appMainTabbar') && primaryCss.includes('body.app-pane-mode .app-main-tabbar'), 'Embedded right pane does not hide only the duplicate application tab headers.');
check(primaryCss.includes('body.app-pane-mode>.workspace-split{display:flex!important;flex:1 1 auto!important;') && primaryCss.includes('body.app-pane-mode #main{display:block!important;flex:1 1 auto!important;'), 'Embedded pane does not explicitly keep the workspace and main content visible.');
check(html.includes('if(!saved)showSaveStatus(\'error\',\'저장 충돌 또는 실패 · 원고 목록으로 이동했어요. 원고 내용을 확인하세요.\');'), 'Return-to-manuscript-list navigation is blocked by a save conflict.');
check(primaryCss.includes('.workspace-split.has-multiple>#appSplitPane{grid-column:2;display:flex!important;flex:none;width:auto;'), 'Right split pane does not occupy the second equal-width column.');
check(primaryCss.includes('.work-tool-nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap;'), 'Work-scoped navigation styles are missing.');
check(html.includes('Reorder existing pane elements instead of rebuilding their iframes'), 'Split-tab reordering still recreates live editor iframes.');
check(html.includes("var others=APP_TABS.filter(function(t){return String(t.id)!==String(APP_ACTIVE_TAB);});"), 'Split view incorrectly suppresses tabs that initially share the same screen.');
check(html.includes('id="contextPanelToggle"') && html.includes('id="contextPanelClose"'), 'Scene reference tools are missing their compact sidebar controls.');
check(primaryCss.includes('.split-panel.is-open{display:block}'), 'Scene reference tools are not hidden in a compact sidebar by default.');
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
check(/id=["\']manuscriptFindDialog["\']/.test(html) && /id=["\']findNext["\']/.test(html) && /id=["\']findPrev["\']/.test(html), 'Find-only dialog controls are missing.');
check(html.includes("e.key.toLowerCase()==='f'&&R.tab==='write'&&EDIT"), 'Ctrl+F manuscript search shortcut is missing.');
check(!html.includes('id="replaceOpen"') && !html.includes('원고 찾기'), 'Unrequested manuscript-find button remains.');
check(html.includes("findDialog.hidden=false;findInput.value='';"), 'Ctrl+F does not open the search dialog directly.');
check(!html.includes('id="replaceAllButton"') && !html.includes('id="replaceWith"') && !html.includes('replaceAllButton'), 'Unrequested find-and-replace controls remain.');
check(html.includes('.scene-memo-dialog[hidden]{display:none!important}'), 'Hidden dialogs can still be shown by the dialog display rule.');
check(primaryCss.includes('body.app-split-active:not(.writer-focus)>#appTabs,body.app-split-active>#appTabs[hidden],#appTabs[hidden]{display:none!important;height:0!important;'), 'Global tab strip is not forcibly collapsed in split view.');
check(html.includes("topTabs.hidden=!!isSplit;") && html.includes("topTabs.setAttribute('aria-hidden','true');") && html.includes("topTabs.removeAttribute('aria-hidden');"), 'Global tab strip does not use a structural hidden state that can be reset when split view closes.');
check(html.includes("if(isSplit){") && html.includes("topTabs.style.setProperty('display','none','important');") && html.includes("topTabs.style.removeProperty('display');"), 'Global tab strip visibility is not synchronized with split-pane state.');
check(html.includes("mainBar.style.setProperty('display',isSplit?'flex':'none','important');"), 'Main pane title bar can remain visible when no split is active.');
check(html.includes("pane.style.setProperty('display',isSplit?'flex':'none','important');"), 'Secondary pane visibility can drift from the active tab count.');
check(html.includes("if(!APP_TABS.some(function(t){return String(t.id)===String(APP_ACTIVE_TAB);}))APP_ACTIVE_TAB=APP_TABS[0].id;"), 'Missing active tab is not recovered before rendering.');
check(html.includes('body.writer-focus #workspaceSplit>#main{grid-column:1 / -1;flex:1 1 100%;width:100%;max-width:none;padding:14px 24px 32px!important;border:0!important}'), 'Focus mode does not expand the active editor pane.');
check(html.includes('function mountWorkTools()') && html.includes("['write','chars','world','plot','wideas'].indexOf(R.tab)<0"), 'Work tools are not mounted only inside a work context.');
check(html.includes("[['write','원고'],['chars','인물'],['world','세계관'],['plot','플롯'],['wideas','아이디어']]"), 'Work-scoped navigation does not include all requested tools.');
check(html.includes('main.insertBefore(bar,main.firstChild)'), 'Work tools are not placed inside the current work pane.');
check(!html.includes('data-tab="chars"') && !html.includes('data-tab="world"') && !html.includes('data-tab="plot"') && !html.includes('data-tab="wideas"'), 'Work-scoped tools remain in global left navigation.');
check(html.includes("localStorage.setItem(KEY+'-recovery'"), 'Deleted chapter recovery copy is not preserved.');
check(!/if\(chapter\)\{var ix=work\.chapters\.indexOf\(chapter\);work\.chapters\[ix\]=preserved;\}else work\.chapters\.push\(preserved\);/.test(html), 'Remote deletion is still silently undone by chapter resurrection.');
check(html.includes('function setWriterFocus(enabled,notifyParent)'), 'Focus mode does not use the centralized state transition.');
check(html.includes("document.body.classList.toggle('app-right-pane-focus',!!data.enabled);"), 'Focus mode in the right pane does not notify the host layout.');
check(primaryCss.includes('body.app-right-pane-focus #workspaceSplit>#appSplitPane{grid-column:1 / -1;width:100%;border:0}'), 'Right-pane focus mode does not expand across the workspace.');
check(html.includes("status.textContent=hasMemo?'●':'○';"), 'Scene memo button does not use a minimal memo indicator.');
check(primaryCss.includes('.scene-memo-trigger.has-scene-memo .scene-memo-status') && primaryCss.includes('.scene-memo-trigger.has-scene-memo{') && primaryCss.includes('padding:0;border:0;border-radius:0;background:transparent'), 'Scene memo indicator is not borderless and compact.');
check(html.includes("document.body.classList.toggle('app-right-pane-focus',!!data.enabled);"), 'Focus mode in the right pane does not notify the host layout.');
check(primaryCss.includes('body.app-right-pane-focus #workspaceSplit>#appSplitPane{grid-column:1 / -1;width:100%;border:0}'), 'Right-pane focus mode does not expand across the workspace.');
check(html.includes("status.textContent=hasMemo?'●':'○';"), 'Scene memo button does not use a minimal memo indicator.');
check(primaryCss.includes('.scene-memo-trigger.has-scene-memo .scene-memo-status') && primaryCss.includes('padding:0;border:0;border-radius:0;background:transparent'), 'Scene memo indicator is not borderless and compact.');
check(!html.includes("FOCUS_MODE=!FOCUS_MODE;document.body.classList.toggle('writer-focus',FOCUS_MODE);render();"), 'Focus mode still redraws the entire editor when toggled.');
check(html.includes('function returnToManuscriptList()'), 'Manuscript-list navigation does not use the centralized transition.');
check(!html.includes('var paneFixStyle='), 'Competing injected split-pane stylesheet still overrides the embedded layout.');
check(html.includes("body.app-pane-mode>.workspace-split{display:flex!important;flex:1 1 auto!important"), 'Embedded pane workspace does not retain its flex layout.');
check(html.includes('id="chapterCharCount"'), 'Manuscript character count is missing above the editor.');
check(html.includes('try{saved=save()!==false;}catch(error){saveError=error;}'), 'Manuscript-list navigation can still be aborted by a save exception.');
check(html.includes('if(typeof child.defaultView.render===\'function\')child.defaultView.render();'), 'Split-pane iframe is not re-rendered after pane-mode layout normalization.');
check(html.includes('html:fullscreen body{grid-template-rows:var(--header) var(--tabs) minmax(0,1fr)!important}'), 'Fullscreen mode does not preserve the application shell rows.');
check(html.includes('body.writer-focus #workspaceSplit>#main{height:100%!important;min-height:0!important;overflow:auto!important}'), 'Focus mode does not expand and scroll the writing workspace.');
check(html.includes('#main .tr{justify-content:flex-end!important}'), 'App-wide action rows are not aligned to the side.');

check(html.includes("count.textContent=cnt(current).toLocaleString()+'자'"), 'Manuscript character count is not updated while typing.');
check(/#main>\.writer-toolbar\{[^}]*justify-content:flex-end!important/.test(html), 'Writer tools are not aligned to the side.');
check(/\.work-tool-nav\{[^}]*flex-wrap:nowrap!important/.test(html), 'Work tool navigation can wrap into an unintended second row.');
check(html.includes('html:fullscreen body{grid-template-rows:minmax(0,1fr)!important}'), 'Fullscreen layout does not use a viewport-filling single row.');

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
