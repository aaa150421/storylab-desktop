window.renderWorldbuilding=function({state,$,esc,uid,notify,askConfirmDialog,persist,render}){
  const entries=Array.isArray(state.worldbuilding)?state.worldbuilding:(state.worldbuilding=[]);
  const categories=['지역','세력','역사','문화','규칙','용어','기타'];
  const cards=entries.map((entry,index)=>'<article class="world-card"><div class="world-card-head"><div><span class="world-category">'+esc(entry.category||'기타')+'</span><h2>'+esc(entry.title||'제목 없음')+'</h2></div><div class="world-card-actions"><button type="button" data-world-edit="'+index+'" aria-label="수정">✎</button><button type="button" data-world-delete="'+index+'" aria-label="휴지통으로 이동">×</button></div></div><p>'+esc(entry.body||'내용이 없습니다.')+'</p></article>').join('');
  $('#center').innerHTML='<section class="world-page"><header><div><h1>세계관</h1><p class="sub">지역, 세력, 역사와 작품의 규칙을 한곳에 정리합니다.</p></div><button class="btn primary" id="worldAdd">＋ 설정 추가</button></header><div class="world-grid">'+(cards||'<div class="trash-empty">아직 세계관 설정이 없습니다. 필요한 항목을 추가해 보세요.</div>')+'</div></section>';
  const edit=index=>{
    const existing=Number.isInteger(index)?entries[index]:null;
    const draft=existing?{...existing}:{id:uid(),title:'',category:'기타',body:''};
    const prior=$('#worldEditor');if(prior){prior.scrollIntoView({behavior:'smooth',block:'center'});prior.querySelector('[data-world-title]')?.focus();return}
    const editor=document.createElement('section');editor.id='worldEditor';editor.className='world-editor';
    editor.innerHTML='<h2>'+(existing?'세계관 설정 수정':'새 세계관 설정')+'</h2><label>항목 유형<select data-world-category>'+categories.map(c=>'<option '+(draft.category===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label><label>제목<input data-world-title maxlength="100" value="'+esc(draft.title)+'" placeholder="예: 왕국의 수도"></label><label>설명<textarea data-world-body rows="7" placeholder="설정과 세부 내용을 기록하세요.">'+esc(draft.body)+'</textarea></label><div class="world-editor-actions"><button class="btn" data-world-cancel>취소</button><button class="btn primary" data-world-save>저장</button></div>';
    $('#center .world-page').prepend(editor);editor.querySelector('[data-world-title]').focus();
    editor.querySelector('[data-world-cancel]').onclick=()=>editor.remove();
    editor.querySelector('[data-world-save]').onclick=()=>{const title=editor.querySelector('[data-world-title]').value.trim();if(!title){notify('설정 제목을 입력해 주세요.');return}const value={id:draft.id,title,category:editor.querySelector('[data-world-category]').value,body:editor.querySelector('[data-world-body]').value,updatedAt:Date.now()};if(existing)entries[index]=value;else entries.push(value);persist();window.renderWorldbuilding({state,$,esc,uid,notify,askConfirmDialog,persist,render})};
  };
  $('#worldAdd').onclick=()=>edit();
  document.querySelectorAll('[data-world-edit]').forEach(button=>button.onclick=()=>edit(Number(button.dataset.worldEdit)));
  document.querySelectorAll('[data-world-delete]').forEach(button=>button.onclick=()=>{const entry=entries[Number(button.dataset.worldDelete)];if(!entry)return;askConfirmDialog('세계관 설정을 휴지통으로 이동할까요?',entry.title+' 설정이 휴지통으로 이동합니다.',()=>{state.trash.unshift({id:uid(),type:'worldbuilding',title:entry.title,location:'세계관',deletedAt:Date.now(),data:entry});state.worldbuilding=entries.filter(x=>x.id!==entry.id);persist();render();notify('휴지통으로 이동했습니다.')})});
};

window.bindFileMoveControls=function({state,esc,folderLocation,moveTreeItem}){
  document.querySelectorAll('[data-movefile]').forEach(select=>{
    const file=state.files.find(item=>item.id===select.dataset.movefile);
    if(!file)return;
    select.innerHTML='<option value="">최상위</option>'+state.folders.map(folder=>'<option value="'+esc(folder.id)+'">'+esc(folderLocation(folder.id))+'</option>').join('');
    select.value=file.folderId||'';
    select.onchange=()=>{
      const current=state.files.find(item=>item.id===select.dataset.movefile);
      if(!current)return;
      moveTreeItem('file',current.id,select.value||null);
      document.querySelectorAll('[data-movefile]').forEach(other=>{if(other.dataset.movefile===current.id)other.value=current.folderId||''});
    };
  });
};
