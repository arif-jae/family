<?php
declare(strict_types=1);
function notifications_schema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,post_id INTEGER NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
      comment_id INTEGER REFERENCES news_comments(id) ON DELETE CASCADE,kind TEXT NOT NULL, event_key INTEGER NOT NULL DEFAULT 0,
      reaction TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,read_at INTEGER,
      UNIQUE(recipient_id,actor_id,post_id,kind,event_key))");
    $db->exec('CREATE INDEX IF NOT EXISTS notifications_recipient ON notifications(recipient_id,id)');
}
function notification_add(PDO $db,int $recipient,int $actor,array $post,string $kind,?int $comment=null,string $reaction=''): void {
    if($recipient===$actor)return;
    $stmt=$db->prepare('SELECT id,national_id FROM users WHERE id=?');$stmt->execute([$recipient]);$viewer=$stmt->fetch();
    if(!$viewer||!news_can_view($db,$post,$viewer))return;
    $db->prepare('INSERT INTO notifications(recipient_id,actor_id,post_id,comment_id,kind,event_key,reaction,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(recipient_id,actor_id,post_id,kind,event_key) DO UPDATE SET reaction=excluded.reaction,created_at=excluded.created_at,read_at=NULL')->execute([$recipient,$actor,$post['id'],$comment,$kind,$comment??0,$reaction,time()]);
}
function notify_new_post(PDO $db,int $postId,int $actor): void {
    $stmt=$db->prepare('SELECT * FROM news_posts WHERE id=?');$stmt->execute([$postId]);$post=$stmt->fetch();
    foreach($db->query('SELECT id,national_id FROM users')->fetchAll() as $viewer)if((int)$viewer['id']!==$actor&&news_can_view($db,$post,$viewer))notification_add($db,(int)$viewer['id'],$actor,$post,'post');
}
function notify_comment(PDO $db,array $post,int $actor,int $commentId): void {
    $stmt=$db->prepare('SELECT DISTINCT author_id FROM news_comments WHERE post_id=?');$stmt->execute([$post['id']]);
    $recipients=array_unique([(int)$post['author_id'],...array_map('intval',$stmt->fetchAll(PDO::FETCH_COLUMN))]);
    foreach($recipients as $recipient)notification_add($db,$recipient,$actor,$post,'comment',$commentId);
}
function notify_reaction(PDO $db,array $post,int $actor,string $reaction): void {
    if($reaction==='')$db->prepare("DELETE FROM notifications WHERE post_id=? AND actor_id=? AND kind='reaction'")->execute([$post['id'],$actor]);
    else notification_add($db,(int)$post['author_id'],$actor,$post,'reaction',null,$reaction);
}
function visible_notifications(PDO $db,array $user): array {
    $stmt=$db->prepare('SELECT n.*,u.name AS actor_name,p.body,p.author_id,p.audience,p.audience_levels,c.body AS comment_body FROM notifications n JOIN users u ON u.id=n.actor_id JOIN news_posts p ON p.id=n.post_id LEFT JOIN news_comments c ON c.id=n.comment_id WHERE n.recipient_id=? ORDER BY n.id DESC');$stmt->execute([$user['id']]);
    $result=[];foreach($stmt->fetchAll() as $row)if(news_can_view($db,$row,$user))$result[]=$row;
    return $result;
}
