window.openWorkspaceManager=function({projects,getActive,saveProjectIndex,renderProjectSelect,render,renameProject,deleteProject,askConfirmDialog,notify}){
  let layer=document.querySelector('#workspaceManagerModal');
  if(layer){layer.focus();return}
  layer=document.createElement('div');layer.id='workspaceManagerModal';layer.className='workspace-manager-backdrop';layer.tabIndex=-1;
  layer.innerHTML='<section class="workspace-manager" role="dialog" aria-modal="true" aria-labelledby="workspaceManagerTitle"><header><div><h2 id="workspaceManagerTitle">작업 공간 관리</h2><p>순서를 바꾸거나 이름을 수정하고, 필요 없는 작업 공간을 삭제할 수 있어요.</p></div><button type="button" data-wm-close aria-label="닫기">×</button></header><div data-wm-list></div><footer><button type="button" class="btn" data-wm-close>닫기</button></footer></section>';
  document.body.appendChild(layer);
  const close=()=>{if(!layer)return;layer.remove();layer=null;document.removeEventListener('keydown',onKey)};
  const draw=()=>{
    if(!layer)return;
    const activeId=getActive();
    layer.querySelector('[data-wm-list]').innerHTML=projects.map((project,index)=>'<div class="workspace-manager-row" data-wm-row="'+index+'"><span class="workspace-manager-order">'+(index+1)+'</span><strong title="'+String(project.name||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))+'">'+String(project.name||'이름 없는 작업 공간').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))+'</strong>'+(project.id===activeId?'<small>사용 중</small>':'')+'<div class="workspace-manager-actions"><button type="button" data-wm-up="'+index+'" aria-label="위로 이동" '+(index===0?'disabled':'')+'>↑</button><button type="button" data-wm-down="'+index+'" aria-label="아래로 이동" '+(index===projects.length-1?'disabled':'')+'>↓</button><button type="button" data-wm-rename="'+index+'" aria-label="이름 수정">✎</button><button type="button" class="danger" data-wm-delete="'+index+'" aria-label="작업 공간 삭제" '+(projects.length===1?'disabled':'')+'>×</button></div></div>').join('')||'<p class="workspace-manager-empty">등록된 작업 공간이 없습니다.</p>';
    layer.querySelectorAll('[data-wm-up]').forEach(button=>button.onclick=()=>move(Number(button.dataset.wmUp),-1));
    layer.querySelectorAll('[data-wm-down]').forEach(button=>button.onclick=()=>move(Number(button.dataset.wmDown),1));
    layer.querySelectorAll('[data-wm-rename]').forEach(button=>button.onclick=()=>{const project=projects[Number(button.dataset.wmRename)];if(!project)return;close();renameProject(project.id)});
    layer.querySelectorAll('[data-wm-delete]').forEach(button=>button.onclick=()=>{const project=projects[Number(button.dataset.wmDelete)];if(!project||projects.length<=1)return;close();askConfirmDialog('작업 공간을 삭제할까요?','「'+project.name+'」의 원고, 인물, 메모와 세계관 설정이 이 기기에서 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',()=>deleteProject(project.id),'작업 공간 삭제')});
  };
  const move=(index,delta)=>{const target=index+delta;if(index<0||target<0||target>=projects.length)return;[projects[index],projects[target]]=[projects[target],projects[index]];saveProjectIndex();renderProjectSelect();render();draw();notify('작업 공간 순서를 변경했습니다.')};
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();close()}};
  document.addEventListener('keydown',onKey);layer.addEventListener('click',event=>{if(event.target===layer||event.target.closest('[data-wm-close]'))close()});draw();layer.focus();
};
