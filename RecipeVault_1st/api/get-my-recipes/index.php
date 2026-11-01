<?php

// Endpoint is currently /api/get-my-recipes/
require("../../auth.php");

if (isset($_SESSION["email_address"])) {
    require("../../private/do-recipe-dbconn.php");
    // We call out to the "get available recipes" script for minimizing lookups
//    $isSubscript = true;
//    require("../get-available-recipes/index.php");
//    $isSubscript = false;

    // Feature: If this is null, appending to an "array" at this variable creates an array.
    $rec_mine = null;

    $check_uid = 'select UserId from AuthTable where EmailAddr = ?;';
    $recipe_metadata_fetch_mine = 'select RecipeId, UserId, IsPublic, LatestPublishedRevisionId, LatestRevisionId from Recipes where UserId = ? order by RecipeId;';
    try {
        // Part 1: Get the User ID for checking permissions.
        $uid_stmt = $recipe_conn->prepare($check_uid);
        $uid_stmt->bindParam(1, $_SESSION['email_address']);
        $uid_stmt_status = $uid_stmt->execute();
        $uid = $uid_stmt->fetch()[0];

        // Part 2: Fetch my recipes and public recipes not ours.
        $rec_meta_mine_stmt = $recipe_conn->prepare($recipe_metadata_fetch_mine);
        $rec_meta_mine_stmt->bindParam(1, $uid);
        $rmm_stmt_status = $rec_meta_mine_stmt->execute();

        // Part 3: Build JSON output
        foreach ($rec_meta_mine_stmt->fetchAll() as $mrow) {
            $rec_mine[] = [
              "id" => $mrow["RecipeId"],
              "latestRevision" => $mrow["LatestRevisionId"],
              "latestPublicRevision" => $mrow["LatestPublishedRevisionId"],
              "visibility" => $mrow["IsPublic"] == true? "public" : "private",
              "authorId" => $mrow["UserId"],
              "isMine" => true
            ];
        }
        if ($isSubscript != true) {
            header("HTTP/1.1 200 OK");
            header("Content-Type: application/json; charset=utf-8");
            $outJson = json_encode($rec_mine);
            echo $outJson;
        } else {
            // We are being run as subscript, export our data.
            global $rvMyAvailRecipes, $rvUid;
            $rvMyAvailRecipes = $rec_mine;
            $rvUid = $uid;
        }
    } catch (PDOException $exc) {
        header('Content-Type: text/plain; charset=utf-8');
        echo $exc->getMessage();
        exit;
    }
} else {
    header("HTTP/1.1 403 Forbidden");
    header("Content-Type: application/json; charset=utf-8");
    // Signal that authentication is required
    echo '{"sessionIsValid": false}';
}
?>
