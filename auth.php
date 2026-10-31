<?php
require __DIR__.'/bootstrap.php';
require __DIR__.'/database.php';
header('Cache-Control: no-store');
$db = database();
$mode = ($_GET['mode']??'') === 'register' ? 'register' : 'login';
$error = '';
$name = trim((string)($_POST['name']??''));
$email = strtolower(trim((string)($_POST['email']??'')));
$nationalId = trim((string)($_POST['national_id']??''));
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($_SESSION['csrf'], (string)($_POST['csrf']??''))) {
        $error = 'เซสชันหมดอายุ กรุณาลองใหม่';
    } elseif (($_POST['action']??'') === 'logout') {
        $_SESSION = [];
        session_regenerate_id(true);
        header('Location: auth.php'); exit;
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email)>254) {
        $error = 'กรุณาระบุอีเมลให้ถูกต้อง';
    } else {
        $password = (string)($_POST['password']??'');
        if ($mode === 'register') {
            if ($name === '' || mb_strlen($name)>100) $error = 'กรุณาระบุชื่อไม่เกิน 100 ตัวอักษร';
            elseif (!preg_match('/^[0-9]{13}$/D', $nationalId)) $error = 'กรุณาระบุเลขบัตรประชาชน 13 หลัก';
            elseif (strlen($password)<8 || strlen($password)>72) $error = 'รหัสผ่านต้องมีความยาว 8–72 ไบต์';
            elseif ($password !== (string)($_POST['password_confirm']??'')) $error = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
            else {
                try {
                    $stmt=$db->prepare('INSERT INTO users(name,email,password_hash,national_id) VALUES(?,?,?,?)');
                    $stmt->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$nationalId]);
                    session_regenerate_id(true);
                    $_SESSION['user_id']=(int)$db->lastInsertId();
                    $_SESSION['csrf']=bin2hex(random_bytes(24));
                    header('Location: ./'); exit;
                } catch (PDOException $e) { $error = str_contains($e->getMessage(),'UNIQUE') ? 'อีเมลหรือเลขบัตรประชาชนนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ' : 'ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่'; }
            }
        } else {
            // Persistent per-email throttling also applies across browser sessions.
            $db->exec('CREATE TABLE IF NOT EXISTS login_attempts (email TEXT PRIMARY KEY, attempts INTEGER NOT NULL, last_attempt INTEGER NOT NULL)');
            $stmt=$db->prepare('SELECT * FROM login_attempts WHERE email=?');$stmt->execute([$email]);$attempt=$stmt->fetch();
            if ($attempt && $attempt['attempts']>=5 && $attempt['last_attempt']>time()-900) $error='เข้าสู่ระบบไม่สำเร็จหลายครั้ง กรุณารอ 15 นาที';
            else {
                $stmt=$db->prepare('SELECT * FROM users WHERE email=?');$stmt->execute([$email]);$user=$stmt->fetch();
                $valid=password_verify($password,$user['password_hash']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
                if ($user && $valid) {
                    $db->prepare('DELETE FROM login_attempts WHERE email=?')->execute([$email]);
                    session_regenerate_id(true);$_SESSION['user_id']=(int)$user['id'];$_SESSION['csrf']=bin2hex(random_bytes(24));
                    header('Location: ./');exit;
                }
                $count=$attempt && $attempt['last_attempt']>time()-900 ? $attempt['attempts']+1 : 1;
                $db->prepare('INSERT INTO login_attempts(email,attempts,last_attempt) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET attempts=excluded.attempts,last_attempt=excluded.last_attempt')->execute([$email,$count,time()]);
                $error='อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            }
        }
    }
}
if (current_user($db)) { header('Location: ./'); exit; }
function h(string $s): string {return htmlspecialchars($s,ENT_QUOTES,'UTF-8');}
$register=$mode==='register';
?>
<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= $register?'ลงทะเบียน':'เข้าสู่ระบบ' ?> — เครือญาติ</title><link rel="stylesheet" href="<?= asset_url('style.css') ?>"></head><body class="auth-page"><section class="auth-card"><a class="brand" href="auth.php">❋ เครือญาติ<small>FAMILY CONNECTIONS</small></a><h1><?= $register?'สร้างบัญชีของคุณ':'ยินดีต้อนรับกลับ' ?></h1><p><?= $register?'ลงทะเบียนเพื่อเริ่มบันทึกเรื่องราวของครอบครัว':'เข้าสู่ระบบเพื่อดูแลข้อมูลเครือญาติของคุณ' ?></p><form method="post" class="auth-form"><input type="hidden" name="csrf" value="<?= h($_SESSION['csrf']) ?>"><?php if($register): ?><label>ชื่อผู้ใช้งาน<input name="name" value="<?= h($name) ?>" required maxlength="100" autocomplete="name"></label><?php endif; ?><?php if($register): ?><label>เลขบัตรประชาชน<input name="national_id" value="<?= h($nationalId) ?>" required pattern="[0-9]{13}" maxlength="13" inputmode="numeric" autocomplete="off"></label><?php endif; ?><label>อีเมล<input type="email" name="email" value="<?= h($email) ?>" required maxlength="254" autocomplete="email"></label><label>รหัสผ่าน<input type="password" name="password" required <?= $register?'minlength="8"':'' ?> maxlength="72" autocomplete="<?= $register?'new-password':'current-password' ?>"></label><?php if($register): ?><small>อย่างน้อย 8 ตัวอักษร (สูงสุด 72 ไบต์)</small><label>ยืนยันรหัสผ่าน<input type="password" name="password_confirm" required maxlength="72" autocomplete="new-password"></label><?php endif; ?><p class="error" role="alert"><?= h($error) ?></p><button class="primary" type="submit"><?= $register?'ลงทะเบียน':'เข้าสู่ระบบ' ?></button></form><p class="auth-switch"><?= $register?'มีบัญชีแล้ว?':'ยังไม่มีบัญชี?' ?> <a href="auth.php<?= $register?'':'?mode=register' ?>"><?= $register?'เข้าสู่ระบบ':'ลงทะเบียนด้วยตัวเอง' ?></a></p><small class="auth-note">ข้อมูลครอบครัวแยกตามบัญชีผู้ใช้งาน</small></section></body></html>
