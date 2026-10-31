window.personSearch = (() => {
 function create(field, title) {
  const select = document.querySelector(`[name="${field}"]`);
  select.hidden = true;
  const originalLabel = select.parentElement;
  const wrap = document.createElement('div');
  wrap.className = 'father-search';
  if (originalLabel.classList.contains('full')) wrap.classList.add('full');
  wrap.innerHTML = `<label for="${field}-query">${title}</label>
    <input id="${field}-query" type="text" inputmode="numeric" maxlength="17" autocomplete="off" placeholder="พิมพ์เลขบัตรประชาชนเพื่อค้นหา" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${field}-results">
    <div id="${field}-results" class="father-results" hidden></div>
    <small class="father-selection" role="status"></small>
    <button type="button" class="text-btn father-clear">ล้าง${title}ที่เลือก</button>`;
  originalLabel.replaceWith(wrap);
  wrap.append(select);
  const query = wrap.querySelector('input');
  const results = wrap.querySelector('.father-results');
  const selection = wrap.querySelector('.father-selection');
  const clear = wrap.querySelector('.father-clear');
  let candidates = [];
  let editing=null,version=0,timer;
  const masked = value => `${value.slice(0,1)}-${value.slice(1,5)}-xxxxx-${value.slice(10,12)}-${value.slice(12)}`;
  function close(){results.hidden=true;query.setAttribute('aria-expanded','false');}
  function choose(person){
    if(![...select.options].some(option=>option.value===String(person.id))){const option=document.createElement('option');option.value=String(person.id);option.textContent=`${person.first_name} ${person.last_name}`;select.append(option);}
    select.value=String(person.id);
    query.value=person.national_id;
    query.setCustomValidity('');
    selection.textContent=`เลือก${title}: ${person.first_name} ${person.last_name} · ${masked(person.national_id)}`;
    clear.hidden=false;close();
  }
  async function search(){
    const request=++version;clearTimeout(timer);
    select.value='';selection.textContent='';clear.hidden=!query.value;
    const digits=query.value.replace(/[\s-]/g,'');
    query.setCustomValidity(query.value?`กรุณาเลือก${title}จากผลการค้นหา หรือกดล้างเพื่อไม่ระบุ`:'');
    results.replaceChildren();
    if(!digits){close();return;}
    results.hidden=false;query.setAttribute('aria-expanded','true');
    if(!/^[0-9]{1,13}$/.test(digits)){results.textContent='กรุณาพิมพ์เลขบัตรประชาชน';return;}
    results.textContent='กำลังค้นหาข้อมูล…';
    timer=setTimeout(async()=>{
    let matches;
    try {const response=await fetch(`api.php?person_search=${encodeURIComponent(digits)}`,{cache:'no-store'});if(!response.ok)throw Error();matches=await response.json();}
    catch {if(request===version){results.textContent='ค้นหาไม่สำเร็จ กรุณาลองใหม่';}return;}
    if(request!==version)return;
    const ownNationalId=document.querySelector('[name="national_id"]').value.trim();
    matches=matches.filter(p=>p.id!==editing&&p.national_id!==ownNationalId);
    results.replaceChildren();
    if(!matches.length){const empty=document.createElement('p');empty.textContent=`ไม่พบข้อมูล${title}ที่ตรงกับเลขบัตรนี้`;results.append(empty);return;}
    const summary=document.createElement('small');summary.textContent=`พบ ${matches.length} คน${matches.length>20?' · แสดง 20 คนแรก พิมพ์เพิ่มเพื่อค้นหาให้เจาะจง':''}`;results.append(summary);
    matches.slice(0,20).forEach(person=>{
      const button=document.createElement('button');button.type='button';
      const name=document.createElement('b');name.textContent=`${person.first_name} ${person.last_name}`;
      const id=document.createElement('small');id.textContent=masked(person.national_id)+(person.can_edit===false?' · ข้อมูลผู้ใช้อื่น':'');
      button.append(name,id);button.onclick=()=>{choose(person);query.focus();};results.append(button);
    });
    },200);
  }
  function reset(){version++;clearTimeout(timer);select.value='';query.value='';selection.textContent='';query.setCustomValidity('');clear.hidden=true;close();}
  query.oninput=search;
  query.onfocus=()=>{if(query.value&&!select.value)search();};
  query.onkeydown=event=>{
    if(event.key==='ArrowDown'){event.preventDefault();const first=results.querySelector('button');if(first)first.focus();}
    if(event.key==='Escape'&&!results.hidden){event.preventDefault();event.stopPropagation();close();}
    if(event.key==='Enter'&&!select.value&&query.value){event.preventDefault();query.reportValidity();}
  };
  results.onkeydown=event=>{
    const buttons=[...results.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();query.focus();}
  };
  clear.onclick=()=>{reset();query.focus();};
  document.addEventListener('click',event=>{if(!wrap.contains(event.target))close();});
  return {sync(records,editingId){
    const selected=select.value;
    editing=editingId;candidates=records.filter(p=>p.id!==editingId);
    reset();const person=candidates.find(p=>String(p.id)===selected);if(person)choose(person);
  }};
 }
 const pickers=[['father_id','บิดา'],['mother_id','มารดา'],['spouse_id','คู่สมรส']].map(([field,title])=>create(field,title));
 return {sync(records,editingId){pickers.forEach(picker=>picker.sync(records,editingId));}};
})();
