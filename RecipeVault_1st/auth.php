<?php

// This file can be used with include() or require().

$timeout = 60 * 120; // In seconds, i.e. 30 minutes.
$fingerprint = hash_hmac('sha256', $_SERVER['HTTP_USER_AGENT'], hash('sha256', $_SERVER['REMOTE_ADDR'], true));
session_start();
if ((isset($_SESSION['last_active']) && $_SESSION['last_active'] < (time()-$timeout))
    || (isset($_SESSION['fingerprint']) && $_SESSION['fingerprint'] != $fingerprint)
    || isset($_GET['logout'])
    ) {
    // Expire session cookie
    setcookie(session_name(), '', time() - 3600, '/');
    session_destroy();
    // Unsets session variables
    $_SESSION = [];
}
session_regenerate_id(); 
$_SESSION['last_active'] = time();
$_SESSION['fingerprint'] = $fingerprint;
// User authenticated at this point (i.e. $_SESSION['email_address'] can be trusted).
