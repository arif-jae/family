<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';require __DIR__.'/database.php';require __DIR__.'/news-storage.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function notification_fail(string $message,int $status): never {http_response_code($status);echo json_encode(['error'=>$message],JSON_UNESCAPED_UNICODE);exit;}
try{
 $db=news_database();$user=current_user($db);if(!$user)notification_fail('กรุณาเข้าสู่ระบบ',401);
 $rows=visible_notifications($db,$user);
 if($_SERVER['REQUEST_METHOD']==='POST'){
   if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))notification_fail('กรุณาโหลดหน้าใหม่',403);
   $data=json_decode(file_get_contents('php://input'),true);if(!is_array($data))notification_fail('ข้อมูลไม่ถูกต้อง',400);
   if(($data['action']??'')==='read_all'){
     $stmt=$db->prepare('UPDATE notifications SET read_at=? WHERE id=? AND recipient_id=? AND read_at IS NULL');foreach($rows as $row)$stmt->execute([time(),$row['id'],$user['id']]);
   }elseif(($data['action']??'')==='read'){
     $id=(int)($data['id']??0);if(!in_array($id,array_column($rows,'id'),true))notification_fail('ไม่พบการแจ้งเตือน',404);
     $db->prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_id=?')->execute([time(),$id,$user['id']]);
   }else notification_fail('คำสั่งไม่ถูกต้อง',400);
   $rows=visible_notifications($db,$user);
 }elseif($_SERVER['REQUEST_METHOD']!=='GET')notification_fail('Method not allowed',405);
 $unread=count(array_filter($rows,fn($row)=>$row['read_at']===null));$before=max(0,(int)($_GET['before']??0));
 $rows=array_values(array_filter($rows,fn($row)=>!$before||$row['id']<$before));$more=count($rows)>20;$rows=array_slice($rows,0,20);
 $labels=['like'=>'ถูกใจ','love'=>'ส่งความรักให้','celebrate'=>'แสดงความยินดีกับ','care'=>'ส่งกำลังใจให้'];$items=[];
 foreach($rows as $row){
   $message=match($row['kind']){'post'=>$row['actor_name'].' โพสต์ข่าวสารใหม่','comment'=>$row['actor_name'].' แสดงความคิดเห็นในข่าวสาร',default=>$row['actor_name'].' '.($labels[$row['reaction']]??'ส่งปฏิกิริยาให้').'โพสต์ของคุณ'};
   $items[]=['id'=>(int)$row['id'],'kind'=>$row['kind'],'message'=>$message,'excerpt'=>mb_substr($row['kind']==='comment'?($row['comment_body']??''):$row['body'],0,140),'created_at'=>(int)$row['created_at'],'is_read'=>$row['read_at']!==null,'url'=>'news.php?post='.(int)$row['post_id'].($row['kind']==='comment'?'&comments=1':'')];
 }
 echo json_encode(['items'=>$items,'unread_count'=>$unread,'has_more'=>$more],JSON_UNESCAPED_UNICODE);
}catch(Throwable $e){notification_fail('ไม่สามารถโหลดการแจ้งเตือนได้ กรุณาลองใหม่',500);}
