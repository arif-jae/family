<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';require __DIR__.'/database.php';require __DIR__.'/news-storage.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function news_fail(string $message,int $status=400): never {http_response_code($status);echo json_encode(['error'=>$message],JSON_UNESCAPED_UNICODE);exit;}
function news_ok(array $data): never {echo json_encode($data,JSON_UNESCAPED_UNICODE);exit;}
try {
 $db=news_database();$user=current_user($db);if(!$user)news_fail('กรุณาเข้าสู่ระบบ',401);$owner=(int)$user['id'];
 if($_SERVER['REQUEST_METHOD']==='GET'){
   if(isset($_GET['comments'])){
     $postId=(int)($_GET['post_id']??0);$stmt=$db->prepare('SELECT * FROM news_posts WHERE id=?');$stmt->execute([$postId]);$post=$stmt->fetch();
     if(!$post||!news_can_view($db,$post,$user))news_fail('ไม่พบโพสต์',404);
     $beforeComment=max(0,(int)($_GET['before_comment']??0));
     $stmt=$db->prepare('SELECT c.*,u.name AS author_name FROM news_comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? AND (CAST(? AS INTEGER)=0 OR c.id<?) ORDER BY c.id DESC LIMIT 21');$stmt->execute([$postId,$beforeComment,$beforeComment]);$comments=$stmt->fetchAll();$more=count($comments)>20;$comments=array_slice($comments,0,20);
     foreach($comments as &$comment){$comment['can_edit']=(int)$comment['author_id']===$owner;unset($comment['author_id']);}unset($comment);
     news_ok(['comments'=>array_reverse($comments),'has_more'=>$more,'social'=>news_social($db,$postId,$owner)]);
   }
   $before=max(0,(int)($_GET['before']??0));
   if(isset($_GET['post_id'])){
     $stmt=$db->prepare('SELECT p.*,u.name AS author_name FROM news_posts p JOIN users u ON u.id=p.author_id WHERE p.id=?');$stmt->execute([(int)$_GET['post_id']]);$candidate=$stmt->fetch();if(!$candidate||!news_can_view($db,$candidate,$user))news_fail('ไม่พบโพสต์ หรือคุณไม่มีสิทธิ์ดูโพสต์นี้',404);$posts=[$candidate];
   }else{
   $stmt=$db->prepare('SELECT p.*,u.name AS author_name FROM news_posts p JOIN users u ON u.id=p.author_id WHERE (CAST(? AS INTEGER)=0 OR p.id<?) ORDER BY p.id DESC LIMIT 100');$posts=[];$cursor=$before;
   do{$stmt->execute([$cursor,$cursor]);$batch=$stmt->fetchAll();foreach($batch as $candidate){$cursor=(int)$candidate['id'];if(news_can_view($db,$candidate,$user))$posts[]=$candidate;if(count($posts)>=21)break 2;}}while(count($batch)===100);
   }
   $more=count($posts)>20;$posts=array_slice($posts,0,20);
   $files=$db->prepare('SELECT id,name,mime,kind,size FROM news_files WHERE post_id=? AND complete=1 ORDER BY id');
   foreach($posts as &$post){$files->execute([$post['id']]);$post['files']=$files->fetchAll();$post['can_edit']=(int)$post['author_id']===$owner;$post['audience_levels']=json_decode($post['audience_levels'],true);$post+=news_social($db,(int)$post['id'],$owner);unset($post['author_id']);}
   news_ok(['posts'=>$posts,'has_more'=>$more]);
 }
 if($_SERVER['REQUEST_METHOD']!=='POST')news_fail('Method not allowed',405);
 if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))news_fail('กรุณาโหลดหน้าใหม่',403);
 $data=str_starts_with($_SERVER['CONTENT_TYPE']??'','multipart/form-data')?$_POST:json_decode(file_get_contents('php://input'),true);
 if(!is_array($data))news_fail('ข้อมูลไม่ถูกต้อง');
 $action=$data['action']??'';
 if(in_array($action,['react','comment_save','comment_delete'],true)){
   $postId=(int)($data['post_id']??0);$stmt=$db->prepare('SELECT * FROM news_posts WHERE id=?');$stmt->execute([$postId]);$post=$stmt->fetch();if(!$post||!news_can_view($db,$post,$user))news_fail('ไม่พบโพสต์',404);
   if($action==='react'){
     $reaction=$data['reaction']??'';if(!in_array($reaction,['','like','love','celebrate','care'],true))news_fail('ปฏิกิริยาไม่ถูกต้อง');
     $stmt=$db->prepare('SELECT reaction FROM news_reactions WHERE post_id=? AND user_id=?');$stmt->execute([$postId,$owner]);$current=$stmt->fetchColumn();
     $db->beginTransaction();
     if($reaction===''||$current===$reaction){$db->prepare('DELETE FROM news_reactions WHERE post_id=? AND user_id=?')->execute([$postId,$owner]);notify_reaction($db,$post,$owner,'');}
     else {$db->prepare('INSERT INTO news_reactions(post_id,user_id,reaction) VALUES(?,?,?) ON CONFLICT(post_id,user_id) DO UPDATE SET reaction=excluded.reaction')->execute([$postId,$owner,$reaction]);notify_reaction($db,$post,$owner,$reaction);}
     $db->commit();
   }else{
     $commentId=(int)($data['comment_id']??0);
     if($commentId){$stmt=$db->prepare('SELECT id FROM news_comments WHERE id=? AND post_id=? AND author_id=?');$stmt->execute([$commentId,$postId,$owner]);if(!$stmt->fetch())news_fail('ไม่พบความคิดเห็นที่คุณแก้ไขได้',404);}
     if($action==='comment_delete'){if(!$commentId)news_fail('ไม่พบความคิดเห็น',404);$db->prepare('DELETE FROM news_comments WHERE id=? AND author_id=?')->execute([$commentId,$owner]);}
     else{
       $text=trim((string)($data['body']??''));if($text===''||mb_strlen($text)>2000)news_fail('ความคิดเห็นต้องมีความยาว 1–2,000 ตัวอักษร');
       if($commentId)$db->prepare('UPDATE news_comments SET body=?,updated_at=? WHERE id=?')->execute([$text,time(),$commentId]);
       else {$db->beginTransaction();$db->prepare('INSERT INTO news_comments(post_id,author_id,body,created_at,updated_at) VALUES(?,?,?,?,?)')->execute([$postId,$owner,$text,time(),time()]);notify_comment($db,$post,$owner,(int)$db->lastInsertId());$db->commit();}
     }
   }
   news_ok(['ok'=>true,'social'=>news_social($db,$postId,$owner)]);
 }
 if($action==='begin'){
   $expired=$db->prepare('SELECT id,token FROM news_files WHERE post_id IS NULL AND created_at<?');$expired->execute([time()-86400]);
   foreach($expired->fetchAll() as $old){news_unlink($old['token']);$db->prepare('DELETE FROM news_files WHERE id=? AND post_id IS NULL')->execute([$old['id']]);}
   $name=mb_substr(str_replace(["\0","\r","\n",'/','\\'],'_',trim((string)($data['name']??''))),0,150);
   $size=(int)($data['size']??0);if($size<=0||$size>news_file_limit($name))news_fail('ไฟล์ต้องไม่ว่าง และไม่เกิน 25 MB (วิดีโอไม่เกิน 100 MB)');
   $stmt=$db->prepare('SELECT COUNT(*) FROM news_files WHERE owner_id=? AND post_id IS NULL');$stmt->execute([$owner]);if($stmt->fetchColumn()>=32)news_fail('มีไฟล์รอบันทึกจำนวนมาก กรุณาโพสต์หรือล้างไฟล์ร่างก่อน');
   $token=bin2hex(random_bytes(16));$db->prepare('INSERT INTO news_files(token,owner_id,name,size,created_at) VALUES(?,?,?,?,?)')->execute([$token,$owner,$name,$size,time()]);
   news_ok(['token'=>$token,'id'=>(int)$db->lastInsertId()]);
 }
 if(in_array($action,['chunk','finish','discard'],true)){
   $stmt=$db->prepare('SELECT * FROM news_files WHERE token=? AND owner_id=? AND post_id IS NULL');$stmt->execute([(string)($data['token']??''),$owner]);$file=$stmt->fetch();if(!$file)news_fail('ไม่พบไฟล์ร่างนี้',404);
   if($action==='discard'){news_unlink($file['token']);$db->prepare('DELETE FROM news_files WHERE id=?')->execute([$file['id']]);news_ok(['ok'=>true]);}
   if($file['complete'])news_fail('ไฟล์นี้อัปโหลดสำเร็จแล้ว');
   $path=news_file_path($file['token'],false);
   if($action==='chunk'){
     $upload=$_FILES['chunk']??null;if(!$upload||$upload['error']!==UPLOAD_ERR_OK||$upload['size']<1||$upload['size']>1024*1024)news_fail('อัปโหลดส่วนไฟล์ไม่สำเร็จ กรุณาลองใหม่');
     $handle=fopen($path,'c+b');if(!$handle||!flock($handle,LOCK_EX))throw new RuntimeException('ไม่สามารถจัดเก็บไฟล์ได้');
     try{
       $db->beginTransaction();$stmt=$db->prepare('SELECT * FROM news_files WHERE id=?');$stmt->execute([$file['id']]);$current=$stmt->fetch();
       if((int)($data['index']??-1)!==(int)$current['next_chunk'] || $current['received']+$upload['size']>$current['size']){ $db->rollBack();news_fail('ลำดับหรือขนาดไฟล์ไม่ถูกต้อง'); }
       ftruncate($handle,(int)$current['received']);fseek($handle,(int)$current['received']);$bytes=file_get_contents($upload['tmp_name']);if(fwrite($handle,$bytes)!==strlen($bytes))throw new RuntimeException('พื้นที่จัดเก็บไฟล์ไม่เพียงพอ');fflush($handle);
       $db->prepare('UPDATE news_files SET received=received+?,next_chunk=next_chunk+1 WHERE id=?')->execute([strlen($bytes),$file['id']]);$db->commit();
     }finally{flock($handle,LOCK_UN);fclose($handle);}
     news_ok(['ok'=>true]);
   }
   if($file['received']!==$file['size']||!is_file($path)||filesize($path)!==$file['size'])news_fail('ไฟล์ยังอัปโหลดไม่ครบ');
   try{[$mime,$kind]=news_file_type($path,$file['name']);}catch(RuntimeException $e){news_unlink($file['token']);$db->prepare('DELETE FROM news_files WHERE id=?')->execute([$file['id']]);throw $e;}
   if(!rename($path,news_file_path($file['token'])))throw new RuntimeException('บันทึกไฟล์ไม่สำเร็จ');
   $db->prepare('UPDATE news_files SET complete=1,mime=?,kind=? WHERE id=?')->execute([$mime,$kind,$file['id']]);
   news_ok(['id'=>$file['id'],'name'=>$file['name'],'kind'=>$kind,'size'=>$file['size']]);
 }
 if(!in_array($action,['save','delete'],true))news_fail('คำสั่งไม่ถูกต้อง');
 $id=(int)($data['id']??0);
 $existingPost=null;if($id){$stmt=$db->prepare('SELECT * FROM news_posts WHERE id=? AND author_id=?');$stmt->execute([$id,$owner]);$existingPost=$stmt->fetch();if(!$existingPost)news_fail('ไม่พบโพสต์ที่คุณแก้ไขได้',404);}
 if($action==='delete'){
   if(!$id)news_fail('ไม่พบโพสต์',404);
   $stmt=$db->prepare('SELECT token FROM news_files WHERE post_id=?');$stmt->execute([$id]);$tokens=$stmt->fetchAll(PDO::FETCH_COLUMN);
   $db->prepare('DELETE FROM news_posts WHERE id=? AND author_id=?')->execute([$id,$owner]);foreach($tokens as $token)news_unlink($token);news_ok(['ok'=>true]);
 }
 $body=trim((string)($data['body']??''));if(mb_strlen($body)>10000)news_fail('ข้อความต้องไม่เกิน 10,000 ตัวอักษร');
 [$audience,$audienceLevels]=news_audience($data,$existingPost);
 if($audience==='levels' && (empty($user['national_id'])||!isset(news_kinship($db)['edges'][$user['national_id']])))news_fail('กรุณาเพิ่มข้อมูลตัวคุณในทะเบียนด้วยเลขบัตรเดียวกับบัญชีก่อนเลือกระดับเครือญาติ');
 $selected=$data['file_ids']??[];if(!is_array($selected)||count($selected)>8)news_fail('แนบได้สูงสุด 8 ไฟล์ต่อโพสต์');$selected=array_values(array_unique(array_map('intval',$selected)));
 if($body===''&&!$selected)news_fail('กรุณาใส่ข้อความหรือแนบไฟล์อย่างน้อยหนึ่งรายการ');
 $isNewPost=!$id;$db->beginTransaction();
 $check=$db->prepare('SELECT * FROM news_files WHERE id=? AND owner_id=? AND complete=1 AND (post_id IS NULL OR post_id=?)');
 foreach($selected as $fileId){$check->execute([$fileId,$owner,$id?:-1]);if(!$check->fetch()){ $db->rollBack();news_fail('ไม่สามารถแนบไฟล์นี้ได้',403); }}
 if($id)$db->prepare('UPDATE news_posts SET body=?,updated_at=?,audience=?,audience_levels=? WHERE id=?')->execute([$body,time(),$audience,$audienceLevels,$id]);
 else{$db->prepare('INSERT INTO news_posts(author_id,body,created_at,updated_at,audience,audience_levels) VALUES(?,?,?,?,?,?)')->execute([$owner,$body,time(),time(),$audience,$audienceLevels]);$id=(int)$db->lastInsertId();}
 $old=$db->prepare('SELECT id,token FROM news_files WHERE post_id=?');$old->execute([$id]);$removed=[];
 foreach($old->fetchAll() as $file)if(!in_array((int)$file['id'],$selected,true)){$db->prepare('DELETE FROM news_files WHERE id=?')->execute([$file['id']]);$removed[]=$file['token'];}
 foreach($selected as $fileId)$db->prepare('UPDATE news_files SET post_id=? WHERE id=?')->execute([$id,$fileId]);
 if($isNewPost)notify_new_post($db,$id,$owner);
 $db->commit();foreach($removed as $token)news_unlink($token);news_ok(['ok'=>true,'id'=>$id]);
}catch(RuntimeException $e){if(isset($db)&&$db->inTransaction())$db->rollBack();news_fail($e instanceof PDOException?'บันทึกไม่สำเร็จ กรุณาลองใหม่':$e->getMessage());}
catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();news_fail('ระบบข่าวสารไม่พร้อมใช้งาน กรุณาลองใหม่',500);}
