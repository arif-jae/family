<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
require __DIR__.'/database.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$db=database();$user=current_user($db);
if(!$user){http_response_code(401);exit;}
$id=(int)($_GET['id']??0);
$visible=visible_people($db,(int)$user['id']);
if(!in_array($id,array_column($visible,'id'),true)){http_response_code(404);exit;}
$stmt=$db->prepare('SELECT mime,content FROM person_photos WHERE person_id=?');$stmt->execute([$id]);$photo=$stmt->fetch();
if(!$photo){http_response_code(404);exit;}
header('Content-Type: '.$photo['mime']);
header("Content-Security-Policy: default-src 'none'; sandbox");
echo $photo['content'];
