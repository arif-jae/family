<?php
declare(strict_types=1);
require_once __DIR__.'/news-visibility.php';
require_once __DIR__.'/notifications-storage.php';
function news_database(): PDO {
    $db=database();
    $db->exec("CREATE TABLE IF NOT EXISTS news_posts (id INTEGER PRIMARY KEY AUTOINCREMENT,author_id INTEGER NOT NULL REFERENCES users(id),body TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)");
    $db->exec("CREATE TABLE IF NOT EXISTS news_files (id INTEGER PRIMARY KEY AUTOINCREMENT,token TEXT NOT NULL UNIQUE,owner_id INTEGER NOT NULL REFERENCES users(id),post_id INTEGER REFERENCES news_posts(id) ON DELETE CASCADE,name TEXT NOT NULL,mime TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL DEFAULT '',size INTEGER NOT NULL,received INTEGER NOT NULL DEFAULT 0,next_chunk INTEGER NOT NULL DEFAULT 0,complete INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)");
    $db->exec('CREATE INDEX IF NOT EXISTS news_files_post ON news_files(post_id)');
    $columns=array_column($db->query('PRAGMA table_info(news_posts)')->fetchAll(),'name');
    if(!in_array('audience',$columns,true))$db->exec("ALTER TABLE news_posts ADD COLUMN audience TEXT NOT NULL DEFAULT 'all'");
    if(!in_array('audience_levels',$columns,true))$db->exec("ALTER TABLE news_posts ADD COLUMN audience_levels TEXT NOT NULL DEFAULT '[]'");
    $db->exec('CREATE TABLE IF NOT EXISTS news_comments (id INTEGER PRIMARY KEY AUTOINCREMENT,post_id INTEGER NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,author_id INTEGER NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS news_comments_post ON news_comments(post_id,id)');
    $db->exec('CREATE TABLE IF NOT EXISTS news_reactions (post_id INTEGER NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id),reaction TEXT NOT NULL,PRIMARY KEY(post_id,user_id))');
    notifications_schema($db);
    return $db;
}
function news_file_path(string $token,bool $complete=true): string {
    if(!preg_match('/^[a-f0-9]{32}$/D',$token))throw new RuntimeException('Invalid file reference');
    $dir=__DIR__.'/storage/news_files';
    if(!is_dir($dir))mkdir($dir,0700,true);
    return $dir.'/'.$token.($complete?'.bin':'.part');
}
function news_unlink(string $token): void {
    foreach([true,false] as $complete){$path=news_file_path($token,$complete);if(is_file($path))unlink($path);}
}
function news_file_type(string $path,string $name): array {
    $extension=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);
    $images=['jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp','gif'=>'image/gif'];
    if(isset($images[$extension])){
        $info=@getimagesize($path);
        if(!$info||$info['mime']!==$images[$extension]||$info[0]*$info[1]>100000000)throw new RuntimeException('ไฟล์รูปไม่ถูกต้อง หรือรูปเกิน 100 ล้านพิกเซล');
        return [$images[$extension],'image'];
    }
    $types=[
        'mp4'=>[['video/mp4','application/mp4'],'video/mp4','video'],
        'webm'=>[['video/webm'],'video/webm','video'],
        'mov'=>[['video/quicktime'],'video/quicktime','video'],
        'mp3'=>[['audio/mpeg'],'audio/mpeg','audio'],
        'm4a'=>[['audio/mp4','video/mp4','audio/x-m4a'],'audio/mp4','audio'],
        'wav'=>[['audio/x-wav','audio/wav'],'audio/wav','audio'],
        'ogg'=>[['audio/ogg','application/ogg'],'audio/ogg','audio'],
        'pdf'=>[['application/pdf'],'application/pdf','pdf'],
        'txt'=>[['text/plain'],'text/plain','document'],
        'zip'=>[['application/zip','application/x-zip-compressed'],'application/zip','document'],
        'docx'=>[['application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document','document'],
        'xlsx'=>[['application/zip','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','document'],
        'pptx'=>[['application/zip','application/vnd.openxmlformats-officedocument.presentationml.presentation'],'application/vnd.openxmlformats-officedocument.presentationml.presentation','document']
    ];
    if(!isset($types[$extension])||!in_array($mime,$types[$extension][0],true))throw new RuntimeException('ชนิดหรือเนื้อหาไฟล์นี้ไม่รองรับ กรุณาเลือกภาพ วิดีโอ เสียง PDF หรือเอกสารที่ระบุ');
    return [$types[$extension][1],$types[$extension][2]];
}
function news_file_limit(string $name): int {
    $ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    $supported=['jpg','jpeg','png','webp','gif','mp4','webm','mov','mp3','m4a','wav','ogg','pdf','txt','zip','docx','xlsx','pptx'];
    if(!in_array($ext,$supported,true))throw new RuntimeException('ไม่รองรับไฟล์ชนิดนี้');
    return (in_array($ext,['mp4','webm','mov'],true)?100:25)*1024*1024;
}
function news_social(PDO $db,int $postId,int $viewer): array {
    $stmt=$db->prepare('SELECT reaction,COUNT(*) AS total FROM news_reactions WHERE post_id=? GROUP BY reaction');$stmt->execute([$postId]);
    $counts=['like'=>0,'love'=>0,'celebrate'=>0,'care'=>0];foreach($stmt->fetchAll() as $row)if(isset($counts[$row['reaction']]))$counts[$row['reaction']]=(int)$row['total'];
    $stmt=$db->prepare('SELECT reaction FROM news_reactions WHERE post_id=? AND user_id=?');$stmt->execute([$postId,$viewer]);$mine=$stmt->fetchColumn()?:'';
    $stmt=$db->prepare('SELECT COUNT(*) FROM news_comments WHERE post_id=?');$stmt->execute([$postId]);
    return ['reactions'=>$counts,'my_reaction'=>$mine,'comment_count'=>(int)$stmt->fetchColumn()];
}
