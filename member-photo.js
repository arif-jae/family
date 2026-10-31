window.memberPhoto = (()=>{
 const file=document.querySelector('[name="photo"]'),remove=document.querySelector('[name="remove_photo"]');
 const preview=document.querySelector('#photo-preview'),hint=document.querySelector('#photo-hint');
 const defaultHint='JPG, PNG, WebP, HEIC ไม่เกิน 25 MB · ย่ออัตโนมัติด้านยาวไม่เกิน 1,024 พิกเซล';
 let original='',objectUrl='',processed=null,pending=Promise.resolve(),version=0,error='';
 function release(){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';}
 function show(src){preview.hidden=!src;if(src)preview.src=src;else preview.removeAttribute('src');}
 function reset(){version++;release();processed=null;error='';pending=Promise.resolve();file.value='';file.setCustomValidity('');}
 file.onchange=()=>{
   const request=++version;release();processed=null;error='';file.setCustomValidity('');const image=file.files[0];
   if(!image){show(remove.checked?'':original);hint.textContent=defaultHint;pending=Promise.resolve();return;}
   remove.checked=false;hint.textContent='กำลังแปลงและย่อรูป กรุณารอสักครู่…';show(original);
   pending=(async()=>{
     try{
       const result=await window.photoProcessing.prepare(image);if(request!==version)return;
       processed=result.file;objectUrl=URL.createObjectURL(processed);show(objectUrl);
       hint.textContent=`พร้อมบันทึก · ${result.width} × ${result.height} พิกเซล · ${Math.ceil(processed.size/1024)} KB`;
     }catch(e){if(request!==version)return;error=e.message||'แปลงรูปไม่สำเร็จ กรุณาลองใช้รูปอื่น';file.setCustomValidity(error);hint.textContent=error;show(original);}
   })();
 };
 remove.onchange=()=>{reset();show(remove.checked?'':original);hint.textContent=remove.checked?'รูปจะถูกลบเมื่อบันทึกข้อมูล':defaultHint;};
 return {
   sync(person){reset();remove.checked=false;original=person.photo_version?`photo.php?id=${person.id}&v=${encodeURIComponent(person.photo_version)}`:'';show(original);hint.textContent=defaultHint;},
   async prepare(data){let current;do{current=pending;await current;}while(current!==pending);if(error)throw Error(error);if(processed)data.set('photo',processed,processed.name);else data.delete('photo');return data;}
 };
})();
