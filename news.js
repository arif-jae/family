(()=>{
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const form=$('#news-compose'),body=$('#news-body'),fileInput=$('#news-files');
 let focusedPost=Number(new URLSearchParams(location.search).get('post'))||0;
 let posts=[],drafts=[],editing=0,busy=false,before=0,loading=false;
 const bytes=size=>size>=1048576?(size/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(size/1024))+' KB';
 const date=value=>new Date(value*1000).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'});
 const url=file=>`news-file.php?id=${file.id}`;
 function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3500);}
 async function api(data,query=''){
   const multipart=data instanceof FormData;
   const response=await fetch('news-api.php'+query,data?{method:'POST',headers:{'X-CSRF-Token':window.CSRF,...(multipart?{}:{'Content-Type':'application/json'})},body:multipart?data:JSON.stringify(data)}:{cache:'no-store'});
   if(response.status===401){location.href='auth.php';throw Error('กรุณาเข้าสู่ระบบ');}
   const result=await response.json();if(!response.ok)throw Error(result.error||'ดำเนินการไม่สำเร็จ');return result;
 }
 function media(file){
   const source=url(file),download=source+'&download=1';let content='';
   if(file.kind==='image')content=`<img class="news-picture" src="${source}" alt="${esc(file.name)}" loading="lazy" data-enlarge>`;
   else if(file.kind==='video')content=`<video controls playsinline preload="metadata"><source src="${source}" type="${esc(file.mime)}">เบราว์เซอร์นี้เล่นวิดีโอไม่ได้ กรุณาดาวน์โหลดไฟล์</video>`;
   else if(file.kind==='audio')content=`<audio controls preload="metadata" src="${source}"></audio>`;
   else content=`<a class="news-file-card" href="${file.kind==='pdf'?source:download}" target="_blank" rel="noopener"><span class="news-file-symbol">${file.kind==='pdf'?'▤':'▧'}</span><div><b>${esc(file.name)}</b><small>${file.kind==='pdf'?'เปิดอ่าน PDF':'ดาวน์โหลดเอกสาร'} · ${bytes(file.size)}</small></div></a>`;
   return `<div>${content}<div class="news-file-links"><span>${esc(file.name)} · ${bytes(file.size)}</span><a href="${download}">ดาวน์โหลด</a></div></div>`;
 }
 function render(){
   $('#news-feed').innerHTML=posts.length?posts.map(p=>`<article class="news-post" data-post="${p.id}"><div class="news-post-header"><span class="news-initial">${esc([...p.author_name][0]||'ค')}</span><div><h3>${esc(p.author_name)}</h3><time>${date(p.created_at)}${p.updated_at>p.created_at?' · แก้ไขแล้ว':''}</time><small class="news-audience-badge">${p.audience==='levels'?'เครือญาติระดับ '+p.audience_levels.join(', '):'ทุกคนในเว็บ'}</small></div>${p.can_edit?`<div class="news-post-actions"><button data-edit="${p.id}">แก้ไข</button><button class="news-delete" data-delete="${p.id}">ลบ</button></div>`:''}</div>${p.body?`<div class="news-body">${esc(p.body)}</div>`:''}${p.files.length?`<div class="news-media">${p.files.map(media).join('')}</div>`:''}${window.newsSocial.markup(p)}</article>`).join(''):'<p class="news-empty">ยังไม่มีข่าวสาร<br>มาแบ่งปันเรื่องราวแรกของครอบครัวกัน</p>';
   window.newsSocial.bind(posts);
   document.querySelectorAll('[data-enlarge]').forEach(image=>{image.tabIndex=0;image.setAttribute('role','button');image.title='ดูรูปขนาดใหญ่';image.onclick=()=>window.imageViewer.open(image.src);image.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.imageViewer.open(image.src);}};});
   document.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(+button.dataset.edit));
   document.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{
     if(busy||!confirm('ลบโพสต์นี้และไฟล์แนบทั้งหมด?'))return;
     button.disabled=true;try{await api({action:'delete',id:+button.dataset.delete});if(editing===+button.dataset.delete)reset();await load();toast('ลบโพสต์แล้ว');}catch(e){toast(e.message);button.disabled=false;}
   });
 }
 async function load(more=false){
   if(loading)return;loading=true;$('#news-feed-error').textContent='';$('#news-more').disabled=true;
   try{const result=await api(null,focusedPost?'?post_id='+focusedPost:more?'?before='+before:'');posts=more?[...posts,...result.posts]:result.posts;before=posts.at(-1)?.id||0;render();$('#news-more').hidden=!result.has_more;if(focusedPost){document.querySelector('.news-feed-heading h2').textContent='ข่าวสารจากการแจ้งเตือน';$('#news-refresh').textContent='ดูข่าวสารทั้งหมด';const commentButton=document.querySelector('[data-comments]');if(new URLSearchParams(location.search).get('comments')==='1'&&commentButton?.getAttribute('aria-expanded')==='false')commentButton.click();}}
   catch(e){$('#news-feed-error').textContent=e.message;if(!posts.length)$('#news-feed').textContent='โหลดข่าวสารไม่สำเร็จ กดรีเฟรชเพื่อลองใหม่';}
   finally{loading=false;$('#news-more').disabled=false;}
 }
 function release(draft){if(draft.preview)URL.revokeObjectURL(draft.preview);if(draft.token)api({action:'discard',token:draft.token}).catch(()=>{});}
 function reset(){window.newsAudience.sync();drafts.forEach(release);drafts=[];editing=0;body.value='';fileInput.value='';$('#news-error').textContent='';$('#news-progress').hidden=true;$('#compose-title').textContent='วันนี้มีเรื่องอะไรอยากแบ่งปัน?';$('#news-submit').textContent='โพสต์ข่าวสาร';$('#news-cancel').hidden=true;renderDrafts();}
 function renderDrafts(){
   $('#news-attachments').innerHTML=drafts.map((d,index)=>`<div class="news-draft">${d.file&&/^image\/(jpeg|png|webp|gif)$/.test(d.file.type)?`<img src="${d.preview}" alt="ตัวอย่างไฟล์แนบ">`:d.kind==='image'?`<img src="${url(d)}" alt="ไฟล์แนบเดิม">`:`<div class="draft-symbol">${/\.(mp4|webm|mov)$/i.test(d.name)?'▷':/\.pdf$/i.test(d.name)?'▤':'▧'}</div>`}<b>${esc(d.name)}</b><small>${bytes(d.size)}</small><button type="button" data-remove="${index}" aria-label="เอาไฟล์นี้ออก" ${busy?'disabled':''}>×</button></div>`).join('');
   document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{const [draft]=drafts.splice(+button.dataset.remove,1);release(draft);renderDrafts();});
 }
 function edit(id){
   if(busy)return;if((body.value.trim()||drafts.length)&&!confirm('เปลี่ยนไปแก้ไขโพสต์นี้? ข้อความร่างปัจจุบันจะถูกล้าง'))return;
   const post=posts.find(p=>p.id===id);reset();editing=id;body.value=post.body;window.newsAudience.sync(post);drafts=post.files.map(f=>({...f}));$('#compose-title').textContent='แก้ไขโพสต์ของคุณ';$('#news-submit').textContent='บันทึกการแก้ไข';$('#news-cancel').hidden=false;renderDrafts();form.scrollIntoView({behavior:'smooth',block:'start'});body.focus();
 }
 fileInput.onchange=()=>{
   $('#news-error').textContent='';
   for(const file of fileInput.files){
     if(drafts.length>=8){$('#news-error').textContent='แนบได้สูงสุด 8 ไฟล์ต่อโพสต์';break;}
     const ext=file.name.split('.').pop().toLowerCase();
     if(!['jpg','jpeg','png','webp','gif','heic','heif','mp4','webm','mov','mp3','m4a','wav','ogg','pdf','txt','zip','docx','xlsx','pptx'].includes(ext)){$('#news-error').textContent='ไม่รองรับไฟล์ '+file.name;continue;}
     const limit=['mp4','webm','mov'].includes(ext)?100:25;
     if(!file.size||file.size>limit*1048576){$('#news-error').textContent=`${file.name}: ขนาดต้องไม่เกิน ${limit} MB`;continue;}
     drafts.push({file,name:file.name,size:file.size,preview:/^image\/(jpeg|png|webp|gif)$/.test(file.type)?URL.createObjectURL(file):''});
   }
   fileInput.value='';renderDrafts();
 };
 async function upload(draft,index){
   if(draft.id)return draft.id;
   let file=draft.file;
   if(/\.(heic|heif)$/i.test(file.name)){progress(`กำลังแปลง HEIC ไฟล์ ${index+1}…`);file=(await window.photoProcessing.prepare(file)).file;}
   if(draft.token){await api({action:'discard',token:draft.token}).catch(()=>{});delete draft.token;}
   const started=await api({action:'begin',name:file.name,size:file.size});draft.token=started.token;
   for(let offset=0,chunk=0;offset<file.size;offset+=1048576,chunk++){
     const data=new FormData();data.set('action','chunk');data.set('token',started.token);data.set('index',String(chunk));data.set('chunk',file.slice(offset,offset+1048576),'chunk.bin');
     progress(`อัปโหลดไฟล์ ${index+1}/${drafts.length} · ${Math.round(Math.min(file.size,offset+1048576)/file.size*100)}%`);await api(data);
   }
   const result=await api({action:'finish',token:started.token});draft.id=result.id;return result.id;
 }
 function progress(text){$('#news-progress').hidden=false;$('#news-progress').textContent=text;}
 form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;if(!body.value.trim()&&!drafts.length){$('#news-error').textContent='กรุณาเขียนข้อความหรือแนบไฟล์';return;}
   let audience;try{audience=window.newsAudience.value();}catch(e){$('#news-error').textContent=e.message;return;}
   busy=true;form.classList.add('busy');form.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=true);$('#news-error').textContent='';
   try{const ids=[];for(let i=0;i<drafts.length;i++)ids.push(await upload(drafts[i],i));progress('กำลังบันทึกโพสต์…');await api({action:'save',id:editing,body:body.value,file_ids:ids,...audience});drafts.forEach(d=>delete d.token);reset();await load();toast('บันทึกข่าวสารแล้ว');}
   catch(e){$('#news-error').textContent=e.message;$('#news-progress').hidden=true;}
   finally{busy=false;form.classList.remove('busy');form.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=false);renderDrafts();}
 };
 $('#news-cancel').onclick=()=>{if(!busy)reset();};$('#news-refresh').onclick=()=>{focusedPost=0;history.replaceState(null,'','news.php');document.querySelector('.news-feed-heading h2').textContent='เรื่องราวล่าสุด';$('#news-refresh').textContent='↻ รีเฟรช';load();};$('#news-more').onclick=()=>load(true);
 $('#news-attach').onclick=()=>fileInput.click();
 load();
})();
