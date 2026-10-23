<?php

// This is used to manage the login request page.

//$db = new Database(); // Database abstraction class.
//$email_address = $db->esc($_POST['email']);
//$password = $db->esc($_POST['password']);
//$matching_users = $db->get_num_rows("SELECT 1 FROM `users` WHERE email_address='$email_address' AND password=crypt('$password', password) LIMIT 1");

if (isset($_POST['login'])) {
    session_start();
    require("../private/do-login-dbconn.php");

    // Reference, used frequently
    $email = $_POST['email'];
    $password = $_POST['password'];

    // Construction strings
    $auth_salt = 'select Salt from AuthTable where EmailAddr = ?;';
    $auth_pass = 'select UserId from AuthTable where EmailAddr = ? and PassHash = kdf(?, ?);';

    try {
        // First part: Get the salt
        $salt_stmt = $auth_conn->prepare($auth_salt);
        $salt_stmt->bindParam(1, $email);
        $salt_status = $salt_stmt->execute();
        // This filters it down if possible.
        $salt_res = $salt_stmt->fetchAll()[0]['Salt'];
//        echo "Salt is: "; print_r($salt_res);
        $row_count = $salt_stmt->rowCount();
        $result = $salt_res;
        if ($row_count == 1) {
            $uname_valid = true;
        } else {
            $uname_valid = false;
        }
        
        // Second part: Check the password
        $uid_stmt = $auth_conn->prepare($auth_pass);
        $uid_stmt->bindParam(1, $email);
        $uid_stmt->bindParam(2, $password);
        $uid_stmt->bindParam(3, $salt_res);
        $uid_status = $uid_stmt->execute();
        $result = $uid_stmt->fetchAll();
        $row_count = $uid_stmt->rowCount();
//        echo $row_count . " rows present.\n";
//        echo "UID is: "; print_r($result);
    } catch (PDOException $exc) {
        echo $exc->getMessage();
    }

    if ($row_count == 1) {
        // This is a row, which can be indexed by column name or numerical index.
        // Only thing I fetch is User Id.
        
//        echo "Results is: "; print_r($result);
        foreach ($result as $row) {
            $user_id = $row[0];
//            echo "Result is "; print_r($row);
        }
//        echo "User ID is " . $user_id . "\n";
    }

    if ($user_id) {
        // User exists; log user in.
        $_SESSION['email_address'] = $_POST['email'];
        $_SESSION['uid'] = $user_id;
        $_SESSION['last_active'] = time();
        $fingerprint = hash_hmac('sha256',
                                 $_SERVER['HTTP_USER_AGENT'],
                                 hash('sha256', $_SERVER['REMOTE_ADDR'], true));
        $_SESSION['fingerprint'] = $fingerprint;
        // Now we redirect to home page.
        header("HTTP/1.1 303 See Other");
        // Relative redirect: Parent directory
        header("Location: ..");
    }

}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Login to RecipeVault</title>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="../resources/style.css" />
</head>
<body>
  <header>
    <p class="site-name">Login to RecipeVault</p>
  </header>
  <main id="mainContent">
    <form method="post">
      <p>
        <label for="email">Email address:</label>
        <input id="email" type="text" name="email" />
      </p>
      <p>
        <label for="password">Password:</label>
        <input id="password" type="password" name="password" />
      </p>
      <p>
        <input type="submit" name="login" value="Login" />
      </p>
    </form>
    <?php
if (isset($_POST['login'])) {
    if ($row_count > 1) {
        echo "<p>Too many matching users, database is invalid!</p>";
    } else if ($row_count == 0) {
        echo "<p>No matching users.</p>";
    }

    if ($user_id) {
        // User exists; log user in.
        echo "<p>You are now logged in.</p>";
        // This is redirected away from.
    } else if ($uname_valid == true) {
        echo "<p>Password is incorrect (or there is a bug in the system).</p>";
    } else {
        // Login failed; re-display login form.
        echo "<p>I failed.</p>";
    }
}
    ?>
  </main>
</body>
</html>
