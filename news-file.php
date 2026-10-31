<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';require __DIR__.'/database.php';require __DIR__.'/news-storage.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
$db=news_database();$user=current_user($db);if(!$user){http_response_code(401);exit;}session_write_close();
$stmt=$db->prepare('SELECT f.*,p.author_id,p.audience,p.audience_levels FROM news_files f JOIN news_posts p ON p.id=f.post_id WHERE f.id=? AND f.complete=1');$stmt->execute([(int)($_GET['id']??0)]);$file=$stmt->fetch();
if(!$file||!news_can_view($db,$file,$user)||!is_file($path=news_file_path($file['token']))){http_response_code(404);exit;}
$size=filesize($path);$start=0;$end=$size-1;
header('Accept-Ranges: bytes');
if(isset($_SERVER['HTTP_RANGE'])){
 if(!preg_match('/^bytes=(\d*)-(\d*)$/D',$_SERVER['HTTP_RANGE'],$range)||($range[1]===''&&$range[2]==='')){header('Content-Range: bytes */'.$size);http_response_code(416);exit;}
 if($range[1]==='')$start=max(0,$size-(int)$range[2]);else{$start=(int)$range[1];if($range[2]!=='')$end=min($end,(int)$range[2]);}
 if($start>$end||$start>=$size){header('Content-Range: bytes */'.$size);http_response_code(416);exit;}
 http_response_code(206);header("Content-Range: bytes $start-$end/$size");
}
$inline=in_array($file['kind'],['image','video','audio','pdf'],true)&&!isset($_GET['download']);
header('Content-Type: '.$file['mime']);header('Content-Length: '.($end-$start+1));
header('Content-Disposition: '.($inline?'inline':'attachment').'; filename="attachment.'.pathinfo($file['name'],PATHINFO_EXTENSION).'"; filename*=UTF-8\'\''.rawurlencode($file['name']));
header("Content-Security-Policy: sandbox; default-src 'none'");
if($_SERVER['REQUEST_METHOD']==='HEAD')exit;
$handle=fopen($path,'rb');fseek($handle,$start);$remaining=$end-$start+1;
while($remaining>0&&!feof($handle)){ $chunk=fread($handle,min(65536,$remaining));if($chunk===false||$chunk==='')break;echo $chunk;$remaining-=strlen($chunk);if(connection_aborted())break; }
fclose($handle);
