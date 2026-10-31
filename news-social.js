window.newsSocial=(()=>{
 const feed=document.querySelector('#news-feed'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const choices=[['like','👍','ถูกใจ'],['love','❤️','รัก'],['celebrate','🎉','ยินดีด้วย'],['care','🤍','ส่งกำลังใจ']];
 const states=new Map();let posts=new Map();
 const date=stamp=>new Date(stamp*1000).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'});
 function state(id){if(!states.has(id))states.set(id,{open:false,comments:[],before:0,more:false,loading:false,editing:0});return states.get(id);}
 async function request(data,query=''){
   const response=await fetch('news-api.php'+query,data?{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':window.CSRF},body:JSON.stringify(data)}:{cache:'no-store'});
   if(response.status===401){location.href='auth.php';throw Error('กรุณาเข้าสู่ระบบ');}
   const result=await response.json();if(!response.ok)throw Error(result.error||'ดำเนินการไม่สำเร็จ');return result;
 }
 function reactions(post){return choices.map(([key,icon,label])=>`<button type="button" data-reaction="${key}" data-social-id="${post.id}" aria-label="${label}" aria-pressed="${post.my_reaction===key}" title="${label}">${icon} <span>${post.reactions?.[key]||0}</span></button>`).join('');}
 function markup(post){return `<div class="news-social" data-social-post="${post.id}"><div class="news-reaction-row"><div class="news-reactions">${reactions(post)}</div><button type="button" class="text-btn" data-comments="${post.id}" aria-expanded="${state(post.id).open}">ความคิดเห็น (<span data-comment-count="${post.id}">${post.comment_count||0}</span>)</button></div><section class="news-comments" data-comment-panel="${post.id}" ${state(post.id).open?'':'hidden'}><div class="news-comment-list" data-comment-list="${post.id}"></div><p class="error" data-comment-error="${post.id}" role="alert"></p><form class="news-comment-form" data-comment-form="${post.id}"><label class="sr-only" for="comment-body-${post.id}">เขียนความคิดเห็น</label><textarea id="comment-body-${post.id}" name="body" maxlength="2000" rows="2" required placeholder="เขียนความคิดเห็นหรือส่งกำลังใจ…"></textarea><div><button type="button" class="text-btn" data-comment-cancel="${post.id}" hidden>ยกเลิกแก้ไข</button><button class="primary" type="submit">ส่งความคิดเห็น</button></div></form></section><p class="error" data-social-error="${post.id}" role="alert"></p></div>`;}
 function summary(id,social){const post=posts.get(id);if(!post)return;Object.assign(post,social);const node=feed.querySelector(`[data-social-post="${id}"]`);if(!node)return;node.querySelector('.news-reactions').innerHTML=reactions(post);node.querySelector('[data-comment-count]').textContent=post.comment_count;}
 function error(id,message){const target=feed.querySelector(`[data-comment-error="${id}"]`);if(target)target.textContent=message;}
 function paint(id){
   const view=state(id),node=feed.querySelector(`[data-comment-list="${id}"]`);if(!node)return;
   node.innerHTML=`${view.more?`<button type="button" class="text-btn" data-comment-more="${id}">ดูความคิดเห็นก่อนหน้า</button>`:''}${view.comments.length?view.comments.map(c=>`<article class="news-comment"><div><b>${esc(c.author_name)}</b><time>${date(c.created_at)}${c.updated_at>c.created_at?' · แก้ไขแล้ว':''}</time></div><p>${esc(c.body)}</p>${c.can_edit?`<div class="news-comment-actions"><button type="button" data-comment-edit="${c.id}" data-social-id="${id}">แก้ไข</button><button type="button" data-comment-delete="${c.id}" data-social-id="${id}">ลบ</button></div>`:''}</article>`).join(''):'<p class="news-comment-empty">ยังไม่มีความคิดเห็น ร่วมส่งข้อความถึงกันได้เลย</p>'}`;
 }
 async function load(id,more=false){
   const view=state(id);if(view.loading)return;view.loading=true;error(id,'');
   try{const result=await request(null,`?comments=1&post_id=${id}${more?'&before_comment='+view.before:''}`);view.comments=more?[...result.comments,...view.comments]:result.comments;view.before=view.comments[0]?.id||0;view.more=result.has_more;summary(id,result.social);paint(id);}
   catch(e){error(id,e.message);}finally{view.loading=false;}
 }
 function cancel(id){state(id).editing=0;const form=feed.querySelector(`[data-comment-form="${id}"]`);form.reset();form.querySelector('[type="submit"]').textContent='ส่งความคิดเห็น';form.querySelector('[data-comment-cancel]').hidden=true;}
 feed.addEventListener('click',async event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.dataset.reaction){
     const id=+button.dataset.socialId;if(button.disabled)return;button.disabled=true;const node=feed.querySelector(`[data-social-error="${id}"]`);node.textContent='';
     try{const result=await request({action:'react',post_id:id,reaction:button.dataset.reaction});summary(id,result.social);}catch(e){node.textContent=e.message;button.disabled=false;}return;
   }
   if(button.dataset.comments){const id=+button.dataset.comments,view=state(id);view.open=!view.open;feed.querySelector(`[data-comment-panel="${id}"]`).hidden=!view.open;button.setAttribute('aria-expanded',String(view.open));if(view.open)await load(id);return;}
   if(button.dataset.commentMore){await load(+button.dataset.commentMore,true);return;}
   if(button.dataset.commentCancel){cancel(+button.dataset.commentCancel);return;}
   if(button.dataset.commentEdit){const id=+button.dataset.socialId,view=state(id),comment=view.comments.find(c=>c.id===+button.dataset.commentEdit);if(!comment)return;view.editing=comment.id;const form=feed.querySelector(`[data-comment-form="${id}"]`);form.elements.body.value=comment.body;form.querySelector('[type="submit"]').textContent='บันทึกความคิดเห็น';form.querySelector('[data-comment-cancel]').hidden=false;form.elements.body.focus();return;}
   if(button.dataset.commentDelete){const id=+button.dataset.socialId;if(!confirm('ลบความคิดเห็นนี้?'))return;button.disabled=true;try{const result=await request({action:'comment_delete',post_id:id,comment_id:+button.dataset.commentDelete});summary(id,result.social);if(state(id).editing===+button.dataset.commentDelete)cancel(id);await load(id);}catch(e){error(id,e.message);button.disabled=false;}}
 });
 feed.addEventListener('submit',async event=>{
   const form=event.target;if(!form.matches('[data-comment-form]'))return;event.preventDefault();const id=+form.dataset.commentForm,button=form.querySelector('[type="submit"]');if(button.disabled)return;
   button.disabled=true;form.elements.body.disabled=true;error(id,'');
   try{const result=await request({action:'comment_save',post_id:id,comment_id:state(id).editing,body:form.elements.body.value});summary(id,result.social);cancel(id);await load(id);}
   catch(e){error(id,e.message);}finally{button.disabled=false;form.elements.body.disabled=false;}
 });
 return {markup,bind(items){posts=new Map(items.map(p=>[p.id,p]));for(const post of items)if(state(post.id).open)paint(post.id);}};
})();
