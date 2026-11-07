<?php

session_start();
setcookie(session_name(), '', time() - 3600, '/');
session_destroy();

?>
<!DOCTYPE html>
<html>
<head>
  <title>Logout</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- Resets local storage, since user is logging out. -->
  <script>
      localStorage.clear();
  </script>
</head>
<body>
  <p>You are now logged out.</p>
  <p><a href="../login">Go to login page</a></p>
</body>
</html>
