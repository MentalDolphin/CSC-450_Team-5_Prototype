<?php

const PDO_AUTHSERVER = 'mysql:dbname=RecipeVault;host=localhost';
const PDO_AUTHUSER = 'serverrecipe';
// This is set by the code in the recipe-tables.sql setup file.
// Not stated for security reasons
const PDO_AUTHPASS = 'FILL_ME_PLEASE';

try {
    $recipe_conn = new PDO(PDO_AUTHSERVER, PDO_AUTHUSER, PDO_AUTHPASS);
} catch (PDOException $exc) {
    echo 'There was a problem connecting to Database: ' . $exc.getMessage();
}

?>
