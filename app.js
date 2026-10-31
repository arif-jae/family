const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let people=[], records=[], scope='household', activeRoot=null, demoMode=false, zoom=1, offset={x:0,y:0};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=p=>p.photo_version?`<img src="photo.php?id=${p.id}&amp;v=${encodeURIComponent(p.photo_version)}" alt="" loading="lazy">`:esc(p.first_name.slice(0,1));
const full=p=>`${p.first_name} ${p.last_name}`;
const mask=s=>s?`${s.slice(0,1)}-${s.slice(1,5)}-xxxxx-${s.slice(10,12)}-${s.slice(12)}`:'ข้อมูลตัวอย่าง';
const date=s=>s?new Date(s+'T00:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):'ไม่ระบุ';
function age(birthDate, now=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate||''))return 'ไม่ระบุ';
 const [year,month,day]=birthDate.split('-').map(Number);
 const birth=new Date(birthDate+'T00:00:00Z');
 if(Number.isNaN(birth.getTime())||birth.getUTCFullYear()!==year||birth.getUTCMonth()+1!==month||birth.getUTCDate()!==day)return 'ไม่ระบุ';
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now);
 const today=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 if(year>today.year||(year===today.year&&(month>today.month||(month===today.month&&day>today.day))))return 'ไม่ระบุ';
 let months=(today.year-year)*12+today.month-month;
 if(today.day<day)months--;
 return `${Math.floor(months/12)} ปี ${months%12} เดือน`;
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3500)}
async function api(data){const multipart=data && data instanceof FormData;const r=await fetch('api.php',data?{method:'POST',headers:{...(multipart?{}:{'Content-Type':'application/json'}),'X-CSRF-Token':window.CSRF},body:multipart?data:JSON.stringify(data)}:{});if(r.status===401){location.href='auth.php';throw Error('Please sign in')}const result=await r.json();if(!r.ok)throw Error(result.error||'โหลดข้อมูลไม่สำเร็จ');return result}
async function load(){try{records=await api();people=FamilyGraph.merge(records);render()}catch(e){toast(e.message)}}
function view(v){$('#tree-view').hidden=v!=='tree';$('#list-view').hidden=v!=='list';$('#title').textContent=$('#crumb').textContent=v==='tree'?'แผนผังเครือญาติ':'ทะเบียนบุคคล';$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===v);b.classList.toggle('selected',b.dataset.view===v)});if(v==='tree')setTimeout(fit,0)}
$$('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
function render(){
 $('#count').innerHTML=`${people.length} <em>คน</em>`;$('#couples').innerHTML=`${people.reduce((sum,p)=>sum+p.partners.filter(id=>p.id<id).length,0)} <em>คู่</em>`;
 const self=people.find(p=>p.national_id===window.CURRENT_NATIONAL_ID);
 if(activeRoot===null||(!activeRoot&&self))activeRoot=self?String(self.id):'';
 if(activeRoot&&!people.some(p=>String(p.id)===activeRoot))activeRoot=self?String(self.id):'';
 const root=activeRoot;
 $('#root').innerHTML='<option value="">ทุกคนในทะเบียนที่ดูได้</option>'+people.map(p=>`<option value="${p.id}">${esc(full(p))}${self&&p.id===self.id?' (คุณ)':''}</option>`).join('');$('#root').value=root;
 const query=$('#search').value.trim().toLowerCase();let visible=people;
 if(root){const ids=scope==='household'?FamilyGraph.household(people,+root):FamilyGraph.connected(people,+root);visible=people.filter(p=>ids.has(p.id));}
 const registry=visible.filter(p=>!query||`${full(p)} ${p.nickname} ${p.national_id}`.toLowerCase().includes(query));
 const generationView=FamilyGraph.generationWindow(visible,root);visible=generationView.people;
 const memo=generationView.levels;
 const rootPerson=people.find(p=>String(p.id)===root);
 $('#family-context').textContent=rootPerson?`${scope==='household'?'เริ่มจากพ่อแม่ของ':'เครือญาติทั้งหมดของ'} ${full(rootPerson)} · ${visible.length} คน`:`แสดงข้อมูลที่มี ${visible.length} คน${self?'':' · ยังไม่พบตัวคุณในทะเบียน เพิ่มข้อมูลด้วยเลขบัตรเดียวกับบัญชีเพื่อเริ่มแผนผังจากพ่อแม่ของคุณ'}`;
 $('#family-context').textContent+=' · แสดงสูงสุด 3 รุ่น คลิกการ์ดเพื่อดูรุ่นอื่นต่อ';
 $('#my-family').classList.toggle('scope-active',scope==='household');$('#all-family').classList.toggle('scope-active',scope==='connected');
 $('#generations').innerHTML=`${visible.length?Math.max(...memo.values())+1:0} <em>รุ่น</em>`;
 if(query)visible=visible.filter(p=>`${full(p)} ${p.nickname} ${p.national_id}`.toLowerCase().includes(query));
 $('#empty').hidden=people.length>0;$('#tree').innerHTML='';
 const {positions,width,height}=FamilyGraph.layout(visible,memo,people);
 const tree=$('#tree');tree.style.width=width+'px';tree.style.height=height+'px';
 const childNumbers=FamilyGraph.childNumbers(people);
 let lines=FamilyGraph.familyBranches(visible,positions).map(branch=>`<path class="family-branch" data-parents="${branch.key}" d="${branch.path}"/>`).join('');
 visible.forEach(p=>{const pos=positions.get(p.id);p.partners.forEach(partnerId=>{const spouse=positions.get(partnerId);if(spouse&&p.id<partnerId)lines+=`<path class="spouse-line" d="M${pos.x+100},${pos.y+47} H${spouse.x+100}"/>`})});
 tree.innerHTML=`<svg width="${width}" height="${height}" aria-hidden="true">${lines}</svg>`+visible.map(p=>{const pos=positions.get(p.id);return `<div class="person ${p.gender} ${self&&p.id===self.id?'is-self':''}" style="left:${pos.x}px;top:${pos.y}px"><button class="person-focus" data-family="${p.id}" aria-label="ดูแผนผังของ ${esc(full(p))} เริ่มจากพ่อแม่"><span class="person-avatar">${portrait(p)}</span><span><b>${esc(full(p))}</b><small>${self&&p.id===self.id?'คุณ · ':''}${p.can_edit===false?'เชื่อมโยง · ':''}${esc(p.nickname||({male:'ชาย',female:'หญิง',other:'ไม่ระบุเพศ'}[p.gender]))}${p.status==='deceased'?' · เสียชีวิต':''}</small>${childNumbers.has(p.id)?`<small class="child-order">ลูกคนที่ ${childNumbers.get(p.id)}${p.birth_date?'':' · ไม่ระบุวันเกิด'}</small>`:''}</span></button><button class="person-preview" data-preview="${p.id}" title="พรีวิวรายละเอียด" aria-label="พรีวิวรายละเอียด ${esc(full(p))}">👁</button></div>`}).join('')+(people.length&&!visible.length?'<p class="no-results">ไม่พบบุคคลที่ค้นหา</p>':'');
 $('#rows').innerHTML=registry.map(p=>`<tr><td><button class="row-name" data-id="${p.id}"><span class="mini-avatar ${p.gender}">${portrait(p)}</span>${esc(full(p))}</button></td><td>${mask(p.national_id)}</td><td>${date(p.birth_date)}</td><td><span class="status">${p.status==='living'?'มีชีวิต':'เสียชีวิต'}</span></td><td><button class="text-btn" data-id="${p.id}">ดูข้อมูล →</button></td></tr>`).join('');$('#list-empty').hidden=registry.length>0;
 window.imageViewer?.bind();
 $$('[data-id]').forEach(b=>b.onclick=()=>detail(+b.dataset.id));
 $$('[data-family]').forEach(b=>b.onclick=()=>focusFamily(+b.dataset.family));
 $$('[data-preview]').forEach(b=>b.onclick=event=>{event.stopPropagation();detail(+b.dataset.preview)});
}
function edit(p={}){if(demoMode){toast('ออกจากตัวอย่างก่อนเพิ่มข้อมูลจริง');demoMode=false;load();return}if(p.id&&p.can_edit===false){toast('แก้ไขได้เฉพาะข้อมูลที่คุณบันทึกหรือเลขบัตรตรงกับบัญชีของคุณ');return}p=p.id?(records.find(q=>q.id===p.id)||p):p;$('#detail').close();const f=$('#person-form');f.reset();$('#error').textContent='';$('#form-title').textContent=p.id?'แก้ไขข้อมูลบุคคล':'เพิ่มบุคคล';['father_id','mother_id','spouse_id'].forEach(n=>f.elements[n].innerHTML='<option value="">ยังไม่ระบุ</option>'+(demoMode?people:records).filter(q=>q.id!==p.id).map(q=>`<option value="${q.id}">${esc(full(q))}</option>`).join(''));for(const [k,v]of Object.entries(p)){if(f.elements[k]&&f.elements[k].type!=='file')f.elements[k].value=v??''}if(!p.id&&!people.some(q=>q.national_id===window.CURRENT_NATIONAL_ID))f.elements.national_id.value=window.CURRENT_NATIONAL_ID||'';f.elements.national_id.readOnly=!!p.id&&p.can_delete===false;window.memberPhoto.sync(p);window.birthdayPicker.sync();window.personSearch.sync(records,p.id);$('#editor').showModal()}
$('#add').onclick=$('#first-add').onclick=()=>edit();$$('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#person-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await api(await window.memberPhoto.prepare(new FormData(e.target)));$('#editor').close();await load();toast('บันทึกข้อมูลแล้ว');fit()}catch(err){$('#error').textContent=err.message}finally{button.disabled=false}};
function focusFamily(id){
 if(!people.some(p=>p.id===id))return;
 activeRoot=String(id);scope='household';$('#search').value='';view('tree');render();fit();
}
function detail(id){const p=people.find(p=>p.id===id);const relation=id=>{const q=people.find(q=>q.id===id);return q?`<button class="text-btn" data-relative="${q.id}">${esc(full(q))}</button>`:'ยังไม่ระบุ'};const kids=people.filter(q=>q.parents.includes(id));$('#detail-content').innerHTML=`<div class="dialog-head"><div><small>MEMBER PROFILE${demoMode?' · ข้อมูลตัวอย่าง':''}</small><h2>${esc(full(p))}</h2></div><button class="close" id="close-detail">×</button></div><div class="profile-avatar ${p.gender}">${portrait(p)}</div><p class="profile-id">${mask(p.national_id)}</p><div class="profile-family-link"><button class="secondary" id="focus-family">ดูเครือญาติของคนนี้</button></div><dl><dt>ชื่อเล่น</dt><dd>${esc(p.nickname||'ไม่ระบุ')}</dd><dt>วันเกิด</dt><dd>${date(p.birth_date)}</dd><dt>${p.status==='deceased'&&p.death_date?'อายุเมื่อเสียชีวิต':'อายุ (ถึงวันนี้)'}</dt><dd>${age(p.birth_date,p.status==='deceased'&&p.death_date?new Date(p.death_date+'T05:00:00Z'):new Date())}</dd><dt>สถานะ</dt><dd>${p.status==='living'?'มีชีวิต':'เสียชีวิต'}</dd>${p.status==='deceased'?`<dt>วันที่เสียชีวิต</dt><dd>${date(p.death_date)}</dd>`:''}<dt>พ่อแม่</dt><dd>${p.parents.length?p.parents.map(parent=>relation(parent)).join(' / '):'ยังไม่ระบุ'}</dd><dt>คู่สมรส</dt><dd>${p.partners.length?p.partners.map(partner=>relation(partner)).join(' / '):'ยังไม่ระบุ'}</dd><dt>บุตร (${kids.length})</dt><dd>${kids.length?kids.map(q=>relation(q.id)).join(' / '):'ยังไม่มีข้อมูล'}</dd><dt>เบอร์โทร</dt><dd>${esc(p.phone||'ไม่ระบุ')}</dd><dt>ที่อยู่</dt><dd>${esc(p.address||'ไม่ระบุ')}</dd><dt>หมายเหตุ</dt><dd>${esc(p.notes||'—')}</dd></dl><div class="form-actions"><button class="danger" id="delete">ลบบุคคล</button><button class="primary" id="edit">แก้ไขข้อมูล</button></div>`;$('#focus-family').onclick=()=>{activeRoot=String(p.id);scope='connected';$('#detail').close();$('#search').value='';view('tree');render();fit()};$('#close-detail').onclick=()=>$('#detail').close();$('#edit').hidden=p.can_edit===false;$('#delete').hidden=p.can_delete===false||p.can_edit===false;$('#edit').onclick=()=>edit(p);$('#delete').onclick=async()=>{if(demoMode){toast('ข้อมูลตัวอย่างไม่ถูกบันทึกในฐานข้อมูล');return}if(!confirm(`ลบ ${full(p)} และยกเลิกความสัมพันธ์ที่เชื่อมมาหาบุคคลนี้?`))return;try{await api({action:'delete',id});$('#detail').close();await load();toast('ลบข้อมูลแล้ว')}catch(e){toast(e.message)}};$$('[data-relative]').forEach(b=>b.onclick=()=>detail(+b.dataset.relative));window.imageViewer?.bind($('#detail-content'));if(!$('#detail').open)$('#detail').showModal()}
function transform(){ $('#tree').style.transform=`translate(${offset.x}px,${offset.y}px) scale(${zoom})`;$('#scale').textContent=Math.round(zoom*100)+'%'}
function fit(){const c=$('#canvas'),t=$('#tree');zoom=Math.min(1,(c.clientWidth-50)/parseInt(t.style.width),(c.clientHeight-30)/parseInt(t.style.height));zoom=Math.max(.15,zoom);offset={x:(c.clientWidth-parseInt(t.style.width)*zoom)/2,y:Math.max(0,(c.clientHeight-parseInt(t.style.height)*zoom)/2)};transform()}
function zoomBy(factor){const next=Math.max(.15,Math.min(2,zoom*factor)),c=$('#canvas');offset={x:c.clientWidth/2-(c.clientWidth/2-offset.x)*next/zoom,y:c.clientHeight/2-(c.clientHeight/2-offset.y)*next/zoom};zoom=next;transform()}
$('#plus').onclick=()=>zoomBy(1.2);$('#minus').onclick=()=>zoomBy(1/1.2);$('#fit').onclick=fit;$('#search').oninput=()=>{render();fit()};$('#root').onchange=()=>{activeRoot=$('#root').value;render();fit()};
const canvas=$('#canvas'),pointers=new Map();let gesture=null,suppressGestureClick=false;
function gesturePoints(){return [...pointers.values()].slice(0,2);}
function beginGesture(){
 const points=gesturePoints();if(!points.length){gesture=null;return;}
 const rect=canvas.getBoundingClientRect();
 const center=points.length===2?{x:(points[0].x+points[1].x)/2-rect.left,y:(points[0].y+points[1].y)/2-rect.top}:{x:points[0].x-rect.left,y:points[0].y-rect.top};
 gesture={center,zoom,offset:{...offset},distance:points.length===2?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0};
}
canvas.onpointerdown=e=>{
 if(e.pointerType!=='touch'&&(e.button!==0||e.target.closest('button')))return;
 if(!pointers.size)suppressGestureClick=false;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2)suppressGestureClick=true;
 beginGesture();
};
canvas.onpointermove=e=>{
 if(!pointers.has(e.pointerId)||!gesture)return;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const points=gesturePoints(),rect=canvas.getBoundingClientRect();
 const center=points.length===2?{x:(points[0].x+points[1].x)/2-rect.left,y:(points[0].y+points[1].y)/2-rect.top}:{x:points[0].x-rect.left,y:points[0].y-rect.top};
 if(points.length===1&&!suppressGestureClick&&Math.hypot(center.x-gesture.center.x,center.y-gesture.center.y)<6)return;
 suppressGestureClick=true;
 for(const id of pointers.keys())if(!canvas.hasPointerCapture(id))canvas.setPointerCapture(id);
 const distance=points.length===2?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0;
 const next=points.length===2&&gesture.distance>0?Math.max(.15,Math.min(2,gesture.zoom*distance/gesture.distance)):gesture.zoom;
 offset={x:center.x-(gesture.center.x-gesture.offset.x)*next/gesture.zoom,y:center.y-(gesture.center.y-gesture.offset.y)*next/gesture.zoom};
 zoom=next;transform();
};
function endPointer(e){if(!pointers.delete(e.pointerId))return;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);beginGesture();}
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=endPointer;
canvas.addEventListener('click',e=>{if(suppressGestureClick){e.preventDefault();e.stopImmediatePropagation();}},true);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY<0?1.08:1/1.08)},{passive:false});window.addEventListener('resize',fit);
$('#demo').onclick=()=>{demoMode=true;activeRoot='3';scope='household';const names=[['สมบูรณ์','male'],['มาลี','female'],['สมชาย','male'],['สุดา','female'],['ธนา','male'],['ณิชา','female'],['ภูมิ','male']];people=names.map(([name,gender],i)=>({id:i+1,first_name:name,last_name:'ใจดี',gender,nickname:['คุณปู่','คุณย่า','คุณพ่อ','คุณแม่','พี่ต้น','น้องมิ้นท์','น้องภูมิ'][i],status:'living',national_id:'',father_id:i===2?1:i>=4?3:null,mother_id:i===2?2:i>=4?4:null,spouse_id:i===0?2:i===1?1:i===2?4:i===3?3:null}));people=FamilyGraph.merge(people);render();fit();toast('กำลังดูข้อมูลสมมติ • กดเพิ่มบุคคลเพื่อกลับสู่ข้อมูลจริง')};
$('#my-family').onclick=()=>{const self=people.find(p=>p.national_id===window.CURRENT_NATIONAL_ID);activeRoot=self?String(self.id):(demoMode?'3':'');scope='household';$('#search').value='';render();fit()};
$('#all-family').onclick=()=>{scope='connected';render();fit()};
load().then(()=>{if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('view')==='list')view('list');fit();});
