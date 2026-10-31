<?php
declare(strict_types=1);
function news_kinship(PDO $db): array {
    static $cache=[];$key=spl_object_id($db);
    if(isset($cache[$key]))return $cache[$key];
    $people=$db->query('SELECT id,national_id,father_id,mother_id,spouse_id FROM persons')->fetchAll(PDO::FETCH_UNIQUE);
    $edges=[];foreach($people as $person)$edges[$person['national_id']]??=[];
    foreach($people as $person)foreach(['father_id','mother_id','spouse_id'] as $field){
        if(empty($person[$field])||!isset($people[$person[$field]]))continue;
        $a=$person['national_id'];$b=$people[$person[$field]]['national_id'];if($a===$b)continue;
        $edges[$a][$b]=true;$edges[$b][$a]=true;
    }
    $users=$db->query('SELECT id,national_id FROM users')->fetchAll(PDO::FETCH_KEY_PAIR);
    return $cache[$key]=['edges'=>$edges,'users'=>$users];
}
function news_can_view(PDO $db,array $post,array $viewer): bool {
    if((int)$post['author_id']===(int)$viewer['id']||($post['audience']??'all')==='all')return true;
    if(($post['audience']??'')!=='levels'||empty($viewer['national_id']))return false;
    $levels=json_decode($post['audience_levels']??'[]',true);if(!is_array($levels)||!$levels)return false;
    $graph=news_kinship($db);$source=$graph['users'][$post['author_id']]??null;$target=$viewer['national_id'];
    if(!$source||!isset($graph['edges'][$source])||!isset($graph['edges'][$target]))return false;
    $limit=min(10,max(array_map('intval',$levels)));$seen=[$source=>true];$queue=[[$source,0]];
    for($index=0;$index<count($queue);$index++){
        [$current,$distance]=$queue[$index];if((string)$current===(string)$target)return in_array($distance,array_map('intval',$levels),true);
        if($distance>=$limit)continue;
        foreach($graph['edges'][$current]??[] as $next=>$unused)if(!isset($seen[$next])){$seen[$next]=true;$queue[]=[(string)$next,$distance+1];}
    }
    return false;
}
function news_audience(array $data,?array $existing): array {
    $audience=$data['audience']??($existing['audience']??'all');
    if(!in_array($audience,['all','levels'],true))throw new RuntimeException('ตัวเลือกผู้ชมไม่ถูกต้อง');
    if($audience==='all')return ['all','[]'];
    $levels=$data['audience_levels']??json_decode($existing['audience_levels']??'[]',true);
    if(!is_array($levels)||!$levels||count($levels)>10)throw new RuntimeException('กรุณาเลือกระดับผู้ชมอย่างน้อยหนึ่งระดับ');
    $result=[];foreach($levels as $level){if(!(is_int($level)||(is_string($level)&&ctype_digit($level)))||(int)$level<1||(int)$level>10)throw new RuntimeException('เลือกระดับความสัมพันธ์ได้ตั้งแต่ 1 ถึง 10');$result[]=(int)$level;}
    $result=array_values(array_unique($result));sort($result);return ['levels',json_encode($result)];
}
