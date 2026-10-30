'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'storylab.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const failures=[];
function check(ok,msg){if(!ok)failures.push(msg);}
const styleStart=html.indexOf('<style>'),styleEnd=html.indexOf('</style>');
check(styleStart>=0&&styleEnd>styleStart,'CSS style block is missing.');
const css=styleStart>=0&&styleEnd>styleStart?html.slice(styleStart+7,styleEnd):'';
let depth=0,quote='',escaped=false;
for(const c of css){if(quote){if(escaped){escaped=false;continue;}if(c==='\\\\'){escaped=true;continue;}if(c===quote)quote='';continue;}if(c==='"'||c==="'"||c==='\x60'){quote=c;continue;}if(c==='{')depth++;if(c==='}'){depth--;if(depth<0)break;}}
check(depth===0&&!quote,'CSS braces or strings are unbalanced.');
for(const token of ['--bg:#fff','--purple:#8768c8','grid-template-columns:var(--rail) minmax(0,1fr) var(--right)','.left','.center','.right','.focus .center','.split'])check(css.includes(token),'Compact editor style is missing: '+token);
for(const id of ['app','tabs','workTree','center','refContent','search','fileInput','exportTop','importTop','splitBtn','focusBtn','toast'])check(html.includes('id="'+id+'"'),'Required element is missing: #'+id);
for(const fn of ['function renderTree()','function renderTabs()','function renderCenter()','function renderRefs()','function exportBackup()','function importBackup(file)','function scheduleSave()','function normalizeState(raw)','function addFolder()','function addFile(folderId=null)','function trashItem(type,id)'])check(html.includes(fn),'Required function is missing: '+fn);
for(const feature of ['인물','메모','목차','집중 모드','좌우 분할',"localStorage.setItem('storylab.project.'+activeProjectId,JSON.stringify(state))",'URL.createObjectURL(blob)','fr.readAsText(file','folders:','files:','scenes:','data-delfile'])check(html.includes(feature),'Required feature is missing: '+feature);
check(html.includes('folderId')&&html.includes('parentId')&&html.includes('activeFileId'),'Workspace folder/file data model is missing.');
check(!html.includes('normalizeWork')&&!html.includes('activeChapterId')&&!html.includes('state.works'),'Obsolete work/chapter data model remains in the application.');
check(html.includes("type==='folder'")&&html.includes("type:'file'"),'Folder and file trash types are missing.');
check(pkg.build?.files?.includes('storylab.html')&&pkg.build?.files?.includes('main.js')&&pkg.build?.files?.includes('preload.js'),'Electron package is missing application files.');
check(!/(?<!\\$)\\$\\((['"][^'"]+['"])\\)\\.forEach/.test(html),'A multi-element selector incorrectly uses the single-element query helper.');
check(html.includes('class=\"tree-row folder-row\"')&&html.includes('data-foldermenu=')&&html.includes('row.onclick=e=>'),'Clickable folder rows and folder action menu are missing.');\ncheck(!html.includes('data-addsub')&&!html.includes('title=\"하위 폴더\"'),'Nested-folder creation controls should be removed.');\ncheck(html.includes('function moveTreeItem(type,id,targetFolderId){if(type!==\'file\')return;'),'Only manuscript files should be draggable into folders.');
check(pkg.version===lock.version&&pkg.version===lock.packages?.['']?.version,'package and lockfile versions differ.');
const scriptStart=html.indexOf('<script>'),scriptEnd=html.indexOf('</script>');
check(scriptStart>=0&&scriptEnd>scriptStart,'Inline application script is missing.');
if(scriptStart>=0&&scriptEnd>scriptStart){try{new vm.Script(html.slice(scriptStart+8,scriptEnd),{filename:'storylab.html:inline-script'});}catch(e){failures.push('Inline JavaScript syntax error: '+e.message);}}
if(failures.length){console.error('이야기공방 정적 검사 실패:');for(const f of failures)console.error('- '+f);process.exitCode=1;}
else console.log('컴팩트 편집기 UI 정적 검사 통과: v'+pkg.version);
