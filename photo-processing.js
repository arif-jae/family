window.photoProcessing = (()=>{
 let decoder;
 function loadHeic(){
   if(window.heic2any)return Promise.resolve(window.heic2any);
   if(!decoder)decoder=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=window.HEIC_LIBRARY_URL;script.onload=()=>resolve(window.heic2any);script.onerror=()=>{decoder=null;reject(Error('โหลดตัวแปลง HEIC ไม่สำเร็จ กรุณาลองใหม่'));};document.head.append(script);});
   return decoder;
 }
 function readImage(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('ไม่สามารถอ่านไฟล์ภาพนี้ได้'));};image.src=url;});}
 function encode(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('ไม่สามารถย่อรูปได้')),'image/jpeg',quality));}
 async function prepare(file){
   if(file.size>25*1024*1024)throw Error('กรุณาเลือกรูปต้นฉบับไม่เกิน 25 MB');
   const heic=/\.(heic|heif)$/i.test(file.name)||/^image\/(heic|heif)(-sequence)?$/i.test(file.type);
   if(!heic&&!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('เลือกภาพ JPG, PNG, WebP หรือ HEIC');
   let image;
   try{image=await readImage(file);}catch(error){
     if(!heic)throw error;
     const convert=await loadHeic();const output=await convert({blob:file,toType:'image/jpeg',quality:.92});
     image=await readImage(Array.isArray(output)?output[0]:output);
   }
   const width=image.naturalWidth,height=image.naturalHeight;
   if(!width||!height||width*height>100000000)throw Error('รูปมีความละเอียดสูงเกินไป กรุณาเลือกรูปไม่เกิน 100 ล้านพิกเซล');
   const ratio=Math.min(1,1024/Math.max(width,height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('เบราว์เซอร์นี้ไม่รองรับการย่อรูป');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   let blob;for(const quality of [.85,.75,.65,.55]){blob=await encode(canvas,quality);if(blob.size<=2*1024*1024)break;}
   if(blob.size>2*1024*1024)throw Error('ไม่สามารถลดรูปให้เล็กกว่า 2 MB ได้');
   return {file:new File([blob],(file.name.replace(/\.[^.]+$/,'')||'profile')+'.jpg',{type:'image/jpeg'}),width:canvas.width,height:canvas.height};
 }
 return {prepare};
})();
