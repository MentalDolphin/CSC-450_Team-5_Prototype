<?php

// Endpoint is currently /api/get-authdata/
require("../../auth.php");

if (isset($_SESSION["email_address"])) {
    $acctValid = true;
} else {
    $acctValid = false;
}

$authdata = [
  "userDisplayName" => null,
  "sessionIsValid" => $acctValid,
  "email" => $_SESSION["email_address"]
];

header("HTTP/1.1 200 OK");
header("Content-Type: application/json; charset=utf-8");

$outJson = json_encode($authdata);

print($outJson);
?>
