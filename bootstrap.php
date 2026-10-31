<?php
declare(strict_types=1);
$storage = __DIR__ . '/storage';
if (!is_dir($storage)) mkdir($storage, 0700, true);
if (!is_dir($storage . '/sessions')) mkdir($storage . '/sessions', 0700, true);
session_save_path($storage . '/sessions');
session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Strict', 'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'use_strict_mode' => true]);
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
function asset_url(string $file): string {
    $path=__DIR__.'/'.$file;
    $version=is_file($path)?substr(hash_file('sha256',$path),0,16):'missing';
    return htmlspecialchars($file.'?v='.$version,ENT_QUOTES,'UTF-8');
}
