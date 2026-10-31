window.newsAudience=(()=>{
 const audience=document.querySelector('#news-audience'),depth=document.querySelector('#news-depth'),fieldset=document.querySelector('#news-levels'),choices=document.querySelector('#news-level-choices');
 function render(selected){const count=+depth.value;choices.innerHTML=Array.from({length:count},(_,i)=>`<label><input type="checkbox" value="${i+1}" ${selected.includes(i+1)?'checked':''}> ระดับ ${i+1}</label>`).join('');}
 function show(){fieldset.hidden=audience.value!=='levels';}
 audience.onchange=show;depth.onchange=()=>render(Array.from({length:+depth.value},(_,i)=>i+1));
 function sync(post={}){audience.value=post.audience||'all';const levels=post.audience_levels?.length?post.audience_levels:[1,2,3];depth.value=Math.max(...levels);render(levels);show();}
 sync();return {sync,value(){const levels=[...choices.querySelectorAll('input:checked')].map(input=>+input.value);if(audience.value==='levels'&&!levels.length)throw Error('กรุณาเลือกระดับผู้ชมอย่างน้อยหนึ่งระดับ');return {audience:audience.value,audience_levels:audience.value==='levels'?levels:[]};}};
})();
