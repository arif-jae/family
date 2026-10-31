window.imageViewer = (()=>{
 const dialog=document.createElement('dialog');dialog.className='image-viewer';dialog.setAttribute('aria-label','ดูรูปขนาดใหญ่');
 dialog.innerHTML=`<div class="image-viewer-toolbar"><span>รูปสมาชิก</span><div><button type="button" data-zoom="out" aria-label="ย่อรูป">−</button><button type="button" data-zoom="in" aria-label="ขยายรูป">＋</button><button type="button" data-fit>พอดีจอ</button><button type="button" data-close aria-label="ปิดรูปขนาดใหญ่">✕</button></div></div><div class="image-viewer-stage"><img alt="รูปสมาชิกขนาดใหญ่"></div><p class="image-viewer-error" hidden>ไม่สามารถโหลดรูปได้ กรุณาลองใหม่</p>`;
 document.body.append(dialog);
 const stage=dialog.querySelector('.image-viewer-stage'),image=stage.querySelector('img');
 const error=dialog.querySelector('.image-viewer-error');let scale=1,baseWidth=0;
 function resize(){if(!baseWidth)return;image.style.width=baseWidth*scale+'px';image.style.height='auto';}
 function fit(){scale=1;baseWidth=Math.min(image.naturalWidth,Math.max(1,stage.clientWidth-24),image.naturalWidth*Math.max(1,stage.clientHeight-24)/image.naturalHeight);resize();stage.scrollTo(0,0);}
 function zoom(factor){scale=Math.max(1,Math.min(5,scale*factor));resize();}
 function open(source){error.hidden=true;image.hidden=true;baseWidth=0;image.src=source;if(!dialog.open)dialog.showModal();}
 image.onload=()=>{image.hidden=false;fit();};image.onerror=()=>{error.hidden=false;image.hidden=true;};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('[data-fit]').onclick=fit;
 dialog.querySelector('[data-zoom="in"]').onclick=()=>zoom(1.3);
 dialog.querySelector('[data-zoom="out"]').onclick=()=>zoom(1/1.3);
 stage.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15);},{passive:false});
 dialog.onclick=e=>{if(e.target===dialog||e.target===stage)dialog.close();};
 dialog.addEventListener('close',()=>{image.removeAttribute('src');});
 window.addEventListener('resize',()=>{if(dialog.open&&!image.hidden)fit();});
 function bind(container=document){
   container.querySelectorAll('.person-avatar img,.mini-avatar img,.profile-avatar img,#photo-preview').forEach(photo=>{
     photo.tabIndex=0;photo.setAttribute('role','button');photo.setAttribute('aria-label','เปิดรูปขนาดใหญ่');photo.title='แตะเพื่อขยายรูป';
     photo.onclick=event=>{event.stopPropagation();open(photo.currentSrc||photo.src);};
     photo.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();open(photo.currentSrc||photo.src);}};
   });
 }
 bind();return {bind,open};
})();
