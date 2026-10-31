<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function fail(string $message, int $status=400): never { http_response_code($status); echo json_encode(['error'=>$message], JSON_UNESCAPED_UNICODE); exit; }
try {
 require_once __DIR__.'/database.php';
 $db=database();
 $user=current_user($db);
 if (!$user) fail('กรุณาเข้าสู่ระบบ',401);
 $owner=(int)$user['id'];
 if ($_SERVER['REQUEST_METHOD']==='GET' && isset($_GET['person_search'])) {
   $query=preg_replace('/[\s-]/','',(string)$_GET['person_search']);
   if(!preg_match('/^[0-9]{1,13}$/D',$query)) { echo '[]'; exit; }
   $stmt=$db->prepare('SELECT id,national_id,first_name,last_name,owner_id FROM persons WHERE national_id LIKE ? ORDER BY CASE WHEN owner_id=? THEN 0 ELSE 1 END,id LIMIT 20');
   $stmt->execute(['%'.$query.'%',$owner]);$matches=$stmt->fetchAll();
   foreach($matches as &$match){$match=person_permissions($match,$user);unset($match['owner_id']);}
   echo json_encode($matches,JSON_UNESCAPED_UNICODE);exit;
 }
 if ($_SERVER['REQUEST_METHOD']==='GET') { echo json_encode(visible_people($db,$owner),JSON_UNESCAPED_UNICODE); exit; }
 if ($_SERVER['REQUEST_METHOD']!=='POST') fail('Method not allowed',405);
 if (!hash_equals($_SESSION['csrf']??'',$_SERVER['HTTP_X_CSRF_TOKEN']??'') || empty($_SESSION['csrf'])) fail('กรุณาโหลดหน้าใหม่',403);
 $data=str_starts_with($_SERVER['CONTENT_TYPE']??'','multipart/form-data')?$_POST:json_decode(file_get_contents('php://input'),true); if (!is_array($data)) fail('ข้อมูลไม่ถูกต้อง');
 $id=(int)($data['id']??0);
 $existing=null;
 if ($id) {
   $check=$db->prepare('SELECT * FROM persons WHERE id=?');$check->execute([$id]);$existing=$check->fetch();
   if(!$existing)fail('ไม่พบบุคคล',404);
   $permissions=person_permissions($existing,$user);
   if(!$permissions['can_edit'] || (($data['action']??'')==='delete' && !$permissions['can_delete']))fail('ไม่พบบุคคล',404);
 }
 if (($data['action']??'')==='delete') { $stmt=$db->prepare('DELETE FROM persons WHERE id=?'); $stmt->execute([$id]); echo '{"ok":true}'; exit; }
 $fields=['national_id','first_name','last_name','nickname','gender','birth_date','death_date','status','phone','address','notes','father_id','mother_id','spouse_id'];
 $values=[]; foreach($fields as $f) { $v=trim((string)($data[$f]??'')); if(strlen($v)>6000) fail('ข้อมูลยาวเกินไป'); $values[$f]=str_ends_with($f,'_id') && $f!=='national_id' ? ($v===''?null:(int)$v) : $v; }
 if(!preg_match('/^\d{13}$/D',$values['national_id'])) fail('กรุณาระบุเลขบัตรประชาชน 13 หลัก');
 if($existing && !$permissions['can_delete'] && $values['national_id']!==$existing['national_id'])fail('ไม่สามารถเปลี่ยนเลขบัตรของรายการที่ผู้อื่นป้อนได้',403);
 if(!$values['first_name'] || !$values['last_name']) fail('กรุณาระบุชื่อและนามสกุล');
 if(!in_array($values['gender'],['male','female','other']) || !in_array($values['status'],['living','deceased'])) fail('ข้อมูลเพศหรือสถานะไม่ถูกต้อง');
 if($values['birth_date'] && (!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$values['birth_date']) || !checkdate((int)substr($values['birth_date'],5,2),(int)substr($values['birth_date'],8,2),(int)substr($values['birth_date'],0,4)) || $values['birth_date']>date('Y-m-d'))) fail('วันเกิดไม่ถูกต้อง');
 if($values['status']!=='deceased') $values['death_date']='';
 $death=$values['death_date'];
 $today=(new DateTimeImmutable('now',new DateTimeZone('Asia/Bangkok')))->format('Y-m-d');
 if($death && (!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$death) || !checkdate((int)substr($death,5,2),(int)substr($death,8,2),(int)substr($death,0,4)) || $death>$today)) fail('วันที่เสียชีวิตไม่ถูกต้อง');
 if($death && $values['birth_date'] && $death<$values['birth_date']) fail('วันที่เสียชีวิตต้องไม่ก่อนวันเกิด');
 $all=$db->query('SELECT * FROM persons')->fetchAll(PDO::FETCH_UNIQUE);
 if($id && !isset($all[$id])) fail('ไม่พบบุคคล',404);
 foreach(['father_id','mother_id','spouse_id'] as $f) if($values[$f]!==null && ($values[$f]===$id || !isset($all[$values[$f]]))) fail('ไม่สามารถเชื่อมโยงบุคคลนี้ได้');
 foreach(['father_id','mother_id','spouse_id'] as $f) if($values[$f] && $all[$values[$f]]['national_id']===$values['national_id']) fail('ไม่สามารถเชื่อมโยงบุคคลกับตนเองได้');
 if($values['father_id'] && $values['father_id']===$values['mother_id']) fail('บิดาและมารดาต้องเป็นคนละคน');
 if($values['father_id'] && $values['mother_id'] && $all[$values['father_id']]['national_id']===$all[$values['mother_id']]['national_id']) fail('บิดาและมารดาต้องเป็นคนละคน');
 $identities=[];foreach($all as $recordId=>$record)$identities[$record['national_id']][]=$recordId;
 $walk=function($current,$seen=[]) use (&$walk,$all,$values,$identities): bool {
   if(!$current||!isset($all[$current]))return false;
   $nationalId=$all[$current]['national_id'];if($nationalId===$values['national_id'])return true;
   if(isset($seen[$nationalId]))return false;$seen[$nationalId]=true;
   foreach($identities[$nationalId] as $recordId)if($walk((int)$all[$recordId]['father_id'],$seen)||$walk((int)$all[$recordId]['mother_id'],$seen))return true;
   return false;
 };
 if($walk($values['father_id'])||$walk($values['mother_id'])) fail('ความสัมพันธ์พ่อแม่ทำให้เกิดวงวน');
 $spouse=$values['spouse_id'];
 if($spouse && !empty($all[$spouse]['spouse_id']) && (int)$all[$spouse]['spouse_id']!==$id) fail('บุคคลนี้มีคู่สมรสแล้ว กรุณาแก้ไขความสัมพันธ์เดิมก่อน');
 $fields[]='owner_id'; $values['owner_id']=$existing?$existing['owner_id']:$owner;
 $photoContent=null;$photoMime=null;
 $upload=$_FILES['photo']??null;
 if($upload && $upload['error']!==UPLOAD_ERR_NO_FILE){
   if($upload['error']!==UPLOAD_ERR_OK)fail('อัปโหลดรูปไม่สำเร็จ กรุณาเลือกไฟล์ขนาดไม่เกิน 2 MB');
   if($upload['size']>2*1024*1024)fail('รูปต้องมีขนาดไม่เกิน 2 MB');
   $image=@getimagesize($upload['tmp_name']);
   if(!$image || !in_array($image['mime'],['image/jpeg','image/png','image/webp'],true) || $image[0]*$image[1]>16000000)fail('กรุณาเลือกภาพ JPG, PNG หรือ WebP ขนาดไม่เกิน 16 ล้านพิกเซล');
   $photoContent=file_get_contents($upload['tmp_name']);$photoMime=$image['mime'];
 }
 $removePhoto=($data['remove_photo']??'')==='1';
 if($photoContent!==null || $removePhoto){$fields[]='photo_version';$values['photo_version']=$photoContent!==null?bin2hex(random_bytes(12)):'';}
 $db->beginTransaction();
 if($id) { $db->prepare('UPDATE persons SET spouse_id=NULL WHERE spouse_id=? AND owner_id=?')->execute([$id,$owner]); $sql='UPDATE persons SET '.implode(',',array_map(fn($f)=>"$f=?",$fields)).' WHERE id=?'; $db->prepare($sql)->execute([...array_values($values),$id]); }
 else { $db->prepare('INSERT INTO persons ('.implode(',',$fields).') VALUES ('.implode(',',array_fill(0,count($fields),'?')).')')->execute(array_values($values)); $id=(int)$db->lastInsertId(); }
 if($spouse) $db->prepare('UPDATE persons SET spouse_id=? WHERE id=? AND owner_id=?')->execute([$id,$spouse,$owner]);
 if($photoContent!==null){
   $stmt=$db->prepare('INSERT INTO person_photos(person_id,mime,content) VALUES(?,?,?) ON CONFLICT(person_id) DO UPDATE SET mime=excluded.mime,content=excluded.content');
   $stmt->bindValue(1,$id,PDO::PARAM_INT);$stmt->bindValue(2,$photoMime);$stmt->bindValue(3,$photoContent,PDO::PARAM_LOB);$stmt->execute();
 } elseif($removePhoto) $db->prepare('DELETE FROM person_photos WHERE person_id=?')->execute([$id]);
 $db->commit(); echo json_encode(['ok'=>true,'id'=>$id]);
} catch(PDOException $e) { if(isset($db)&&$db->inTransaction()) $db->rollBack(); fail(str_contains($e->getMessage(),'UNIQUE')?'เลขบัตรประชาชนนี้มีในระบบแล้ว':'ไม่สามารถจัดเก็บข้อมูลได้ โปรดตรวจสอบ SQLite และสิทธิ์โฟลเดอร์ storage',500); } catch(Throwable $e) { fail('ระบบไม่พร้อมใช้งาน โปรดตรวจสอบ PHP และสิทธิ์จัดเก็บข้อมูล',500); }
