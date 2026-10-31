<?php
require __DIR__.'/bootstrap.php';
require __DIR__.'/database.php';
header('Cache-Control: no-store');
$db=database();$user=current_user($db);
if (!$user) { header('Location: auth.php'); exit; }
$error='';$message='';
if ($_SERVER['REQUEST_METHOD']==='POST') {
    if (!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??''))) $error='กรุณาโหลดหน้าใหม่';
    else try {
        $action=$_POST['action']??'';
        if ($action==='identity') {
            $nationalId=trim((string)($_POST['national_id']??''));
            if (!preg_match('/^[0-9]{13}$/D',$nationalId)) throw new RuntimeException('กรุณาระบุเลขบัตรประชาชน 13 หลัก');
            $stmt=$db->prepare('SELECT password_hash FROM users WHERE id=?');$stmt->execute([$user['id']]);
            if (!password_verify((string)($_POST['password']??''),$stmt->fetchColumn())) throw new RuntimeException('รหัสผ่านไม่ถูกต้อง');
            $db->prepare('UPDATE users SET national_id=? WHERE id=?')->execute([$nationalId,$user['id']]);
            $message='บันทึกเลขบัตรประชาชนแล้ว';$user=current_user($db);
        }
    } catch (PDOException $e) { $error='บันทึกไม่สำเร็จ เลขบัตรนี้อาจมีบัญชีใช้งานแล้ว'; }
      catch (RuntimeException $e) { $error=$e->getMessage(); }
}
function h($s):string{return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');}
function token():void {echo '<input type="hidden" name="csrf" value="'.h($_SESSION['csrf']).'">';}
?>
<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>บัญชีและการเชื่อมโยง — เครือญาติ</title><link rel="stylesheet" href="<?= asset_url('style.css') ?>"></head><body class="auth-page"><section class="account-card"><div class="account-notifications"><?php require __DIR__.'/notifications-ui.php'; ?></div><a class="text-btn" href="./">← กลับแผนผัง</a><h1>บัญชีและการเชื่อมโยง</h1><p><?= h($user['name']) ?> · <?= h($user['email']) ?></p><p class="error" role="alert"><?= h($error) ?></p><p role="status"><?= h($message) ?></p>
<form action="auth.php" method="post"><?php token(); ?><button name="action" value="logout" class="text-btn">ออกจากระบบ</button></form><h2>เลขบัตรประชาชนของคุณ</h2><p>ใช้ค้นหาตัวคุณในทะเบียนเพื่อเริ่มแผนผังจากพ่อแม่ ไม่ถือเป็นการยืนยันตัวตน และไม่ให้สิทธิ์แก้ไขข้อมูลที่บัญชีอื่นป้อน</p><form method="post" class="auth-form"><?php token(); ?><input type="hidden" name="action" value="identity"><label>เลขบัตรประชาชน<input name="national_id" value="<?= h($user['national_id']??'') ?>" required pattern="[0-9]{13}" maxlength="13" inputmode="numeric" autocomplete="off"></label><label>ยืนยันรหัสผ่านปัจจุบัน<input name="password" type="password" required autocomplete="current-password"></label><button class="primary">บันทึกเลขบัตรประชาชน</button></form>
<h2>เครือญาติเชื่อมโยงอัตโนมัติ</h2><p>เมื่อเข้าสู่ระบบ คุณจะดูข้อมูลเครือญาติที่เชื่อมโยงกันข้ามบัญชีได้ทันที ผ่านเลขบัตรประชาชนที่ตรงกันและความสัมพันธ์พ่อแม่ คู่สมรส และบุตร โดยไม่ต้องส่งคำขอหรือรออนุมัติ</p><p>แก้ไขได้เมื่อคุณเป็นผู้ป้อน หรือรายการนั้นมีเลขบัตรตรงกับบัญชีของคุณ ส่วนการลบทำได้เฉพาะผู้ป้อนเดิม การแก้ไขข้อมูลของตนที่ผู้อื่นป้อนจะคงผู้ป้อนเดิมและเลขบัตรไว้ ใช้ปุ่ม “ดูเครือญาติที่เชื่อมโยงทั้งหมด” เพื่อขยายทุกสาขาที่เชื่อมกัน</p>
</section></body></html>
