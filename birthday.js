// The form submits an ISO Gregorian date; the picker always displays Buddhist years.
window.birthdayPicker = (() => {
 function create(field,title){
  const input = document.querySelector(`[name="${field}"]`);
  input.type = 'hidden';
  const wrap = document.createElement('div');
  wrap.className = 'birthday-picker';
  wrap.innerHTML = `<button type="button" class="birthday-value" aria-expanded="false" aria-label="เลือก${title} ปีพุทธศักราช"></button>
    <div class="birthday-calendar" hidden>
      <div class="birthday-nav"><button type="button" data-step="-1" aria-label="เดือนก่อนหน้า">‹</button><select aria-label="เดือน"></select><label>พ.ศ. <input type="number" min="544" max="10542" aria-label="ปี พ.ศ."></label><button type="button" data-step="1" aria-label="เดือนถัดไป">›</button></div>
      <div class="birthday-week" aria-hidden="true">${['อา','จ','อ','พ','พฤ','ศ','ส'].map(d=>`<span>${d}</span>`).join('')}</div>
      <div class="birthday-days" role="group" aria-label="เลือกวันที่"></div>
      <div class="birthday-actions"><button type="button" data-clear>ไม่ระบุ${title}</button><button type="button" data-close>ปิด</button></div>
    </div>`;
  input.after(wrap);
  const trigger = wrap.querySelector('.birthday-value');
  const calendar = wrap.querySelector('.birthday-calendar');
  const month = wrap.querySelector('select');
  const year = wrap.querySelector('input');
  const days = wrap.querySelector('.birthday-days');
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  month.innerHTML = months.map((name,i)=>`<option value="${i}">${name}</option>`).join('');
  let shown;
  const today = () => { const now = new Date(); return new Date(now.getFullYear(),now.getMonth(),now.getDate()); };
  function close(){ calendar.hidden=true;trigger.setAttribute('aria-expanded','false'); }
  function sync(){
    const selected = input.value ? new Date(input.value+'T00:00:00') : today();
    shown = new Date(selected.getFullYear(),selected.getMonth(),1);
    trigger.textContent = input.value ? `${selected.getDate()} ${months[selected.getMonth()]} พ.ศ. ${selected.getFullYear()+543} ▦` : `เลือก${title} (พ.ศ.) ▦`;
    close();
  }
  function render(){
    month.value=shown.getMonth(); year.value=shown.getFullYear()+543;
    const start=shown.getDay(),count=new Date(shown.getFullYear(),shown.getMonth()+1,0).getDate();
    days.replaceChildren();
    for(let i=0;i<start;i++)days.append(document.createElement('span'));
    for(let d=1;d<=count;d++){
      const button=document.createElement('button');button.type='button';button.textContent=d;
      const value=`${String(shown.getFullYear()).padStart(4,'0')}-${String(shown.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      button.disabled=new Date(shown.getFullYear(),shown.getMonth(),d)>today();
      button.setAttribute('aria-label',`${d} ${months[shown.getMonth()]} พ.ศ. ${shown.getFullYear()+543}`);
      if(value===input.value){button.className='selected';button.setAttribute('aria-pressed','true');}
      button.onclick=()=>{input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));sync();trigger.focus();};
      days.append(button);
    }
  }
  trigger.onclick=()=>{if(!calendar.hidden){close();return;}sync();render();calendar.hidden=false;trigger.setAttribute('aria-expanded','true');};
  month.onchange=()=>{shown.setMonth(+month.value);render();};
  year.onchange=()=>{const value=Number(year.value);if(!Number.isInteger(value)||value<544||value>10542){year.value=shown.getFullYear()+543;return;}shown.setFullYear(value-543);render();};
  wrap.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const next=new Date(shown.getFullYear(),shown.getMonth()+(+b.dataset.step),1);if(next.getFullYear()<1||next.getFullYear()>9999)return;shown=next;render();});
  wrap.querySelector('[data-clear]').onclick=()=>{input.value='';sync();trigger.focus();};
  wrap.querySelector('[data-close]').onclick=()=>{close();trigger.focus();};
  wrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&!calendar.hidden){e.preventDefault();e.stopPropagation();close();trigger.focus();}});
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))close();});
  sync();return {sync};
 }
 const birth=create('birth_date','วันเกิด'),death=create('death_date','วันที่เสียชีวิต');
 const status=document.querySelector('[name="status"]');
 function statusChanged(){document.querySelector('#death-date-field').hidden=status.value!=='deceased';death.sync();}
 status.addEventListener('change',statusChanged);
 return {sync(){birth.sync();statusChanged();}};
})();
