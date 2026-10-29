'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'storylab.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const failures = [];
function check(ok, message) { if (!ok) failures.push(message); }
function balanced(source) {
  let depth=0, quote='', comment=false;
  for(let i=0;i<source.length;i++){const c=source[i],n=source[i+1];
    if(comment){if(c==='*'&&n==='/'){comment=false;i++;}continue;}
    if(quote){if(c==='\\\\'){i++;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='*'){comment=true;i++;continue;}
    if(c==='"'||c==="'"||c==='\x60'){quote=c;continue;}
    if(c==='{')depth++;if(c==='}'&&--depth<0)return false;
  }
  return depth===0&&!quote&&!comment;
}
const styles=[...html.matchAll(/<style\\b[^>]*>([\\s\\S]*?)<\\/style>/gi)];
check(styles.length>0,'CSS style block is missing.');
for(const [i,m] of styles.entries())check(balanced(m[1]),'CSS braces or strings are unbalanced in style block '+(i+1)+'.');
const css=styles[0]?.[1]||'';
for(const token of ['--bg:#fff','--purple:#8768c8','grid-template-columns:var(--rail) minmax(0,1fr) var(--right)','.left','.center','.right','.focus .center','.split'])check(css.includes(token),'Compact editor layout style is missing: '+token);
for(const id of ['app','tabs','workTree','center','refContent','search','fileInput','exportTop','importTop','splitBtn','focusBtn','toast'])check(html.includes('id="'+id+'"'),'Required editor element is missing: #'+id);
for(const fn of ['function renderTree()','function renderTabs()','function renderCenter()','function renderRefs()','function exportBackup()','function importBackup(file)','function scheduleSave()'])check(html.includes(fn),'Required editor/data function is missing: '+fn);
for(const feature of ['인물','메모','목차','집중 모드','좌우 분할','localStorage.setItem(KEY,JSON.stringify(state))','URL.createObjectURL(blob)','fr.readAsText(file'])check(html.includes(feature),'Required feature is missing: '+feature);
check(html.includes('chapters')&&html.includes('updatedAt'),'Chapter and timestamp data support is missing.');
check(html.includes('o?.state?.works')&&html.includes('o?.works'),'Legacy and current backup import paths are missing.');
check(pkg.build?.files?.includes('storylab.html')&&pkg.build?.files?.includes('main.js')&&pkg.build?.files?.includes('preload.js'),'Electron package is missing application files.');
check(pkg.version===lock.version&&pkg.version===lock.packages?.['']?.version,'package and lockfile versions differ.');
const scripts=[...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)];
check(scripts.length>0,'Inline application script is missing.');
for(const [i,m] of scripts.entries()){try{new vm.Script(m[1],{filename:'storylab.html:inline-script-'+(i+1)});}catch(e){failures.push('Inline JavaScript '+(i+1)+' syntax error: '+e.message);}}
if(failures.length){console.error('이야기공방 정적 검사 실패:');for(const f of failures)console.error('- '+f);process.exitCode=1;}
else console.log('컴팩트 편집기 UI 정적 검사 통과: v'+pkg.version+', CSS '+styles.length+'개, 인라인 JS '+scripts.length+'개');
