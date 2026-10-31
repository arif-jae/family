(()=>{
 const bell=document.querySelector('#notification-bell'),panel=document.querySelector('#notification-panel'),list=document.querySelector('#notification-list'),badge=document.querySelector('#notification-badge'),more=document.querySelector('#notification-more'),error=document.querySelector('#notification-error'),readAll=document.querySelector('#notification-read-all');
 if(!bell)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=stamp=>new Date(stamp*1000).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'});
 let items=[],loading=false;
 async function request(data,query=''){
   const response=await fetch('notifications-api.php'+query,data?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':window.NOTIFICATION_CSRF},body:JSON.stringify(data)}:{cache:'no-store'});
   if(response.status===401){badge.hidden=true;throw Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');}
   const result=await response.json();if(!response.ok)throw Error(result.error||'โหลดไม่สำเร็จ กรุณาลองใหม่');return result;
 }
 function render(result,append=false){
   items=append?[...items,...result.items]:result.items;badge.hidden=!result.unread_count;badge.textContent=result.unread_count>99?'99+':String(result.unread_count);bell.setAttribute('aria-label',`การแจ้งเตือน ${result.unread_count} รายการที่ยังไม่อ่าน`);readAll.disabled=!result.unread_count;
   list.innerHTML=items.length?items.map(item=>`<a class="notification-item ${item.is_read?'':'unread'}" href="${esc(item.url)}" data-notification="${item.id}" ${item.is_read?'':'aria-label="ยังไม่อ่าน: '+esc(item.message)+'"'}><span aria-hidden="true">${item.kind==='post'?'◷':item.kind==='comment'?'☏':'♡'}</span><div><b>${esc(item.message)}</b>${item.excerpt?`<p>${esc(item.excerpt)}</p>`:''}<time>${date(item.created_at)}</time></div></a>`).join(''):'<p class="notification-empty">ยังไม่มีการแจ้งเตือนใหม่</p>';
   more.hidden=!result.has_more;
 }
 async function load(append=false){
   if(loading)return;loading=true;more.disabled=true;error.textContent='';
   try{render(await request(null,append&&items.length?'?before='+items.at(-1).id:''),append);}catch(e){error.textContent=e.message;}finally{loading=false;more.disabled=false;}
 }
 function close(){panel.hidden=true;bell.setAttribute('aria-expanded','false');}
 bell.onclick=()=>{panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)load();};
 readAll.onclick=async()=>{readAll.disabled=true;try{render(await request({action:'read_all'}));}catch(e){error.textContent=e.message;readAll.disabled=false;}};
 more.onclick=()=>load(true);
 list.onclick=async event=>{const link=event.target.closest('[data-notification]');if(!link)return;if(event.ctrlKey||event.metaKey||event.shiftKey)return;event.preventDefault();try{await request({action:'read',id:+link.dataset.notification});}catch{}location.href=link.href;};
 document.addEventListener('click',event=>{if(!event.target.closest('.notification-widget'))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close();bell.focus();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});window.addEventListener('focus',()=>load());
 setInterval(()=>{if(!document.hidden)load();},30000);load();
})();
