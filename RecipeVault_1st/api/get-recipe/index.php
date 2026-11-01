<?php

// Endpoint is currently /api/get-recipe/
require("../../auth.php");

if (isset($_SESSION["email_address"])) {
    $recipeId = $_GET["id"];
    $recipeRevId = $_GET["revid"];

    require("../../private/do-recipe-dbconn.php");

//    // Enable for testing, and comment out the line setting output to application/json
//    header('Content-Type: text/plain; charset=utf-8');

    // Determines whether output is blank
    $recipe_is_valid = false;
    $recipe_rev_is_valid = false;
    $recipe_is_allowed = true;

    $check_uid = 'select UserId from AuthTable where EmailAddr = ?;';
    $recipe_metadata_check = 'select RecipeId, UserId, IsPublic, LatestPublishedRevisionId, LatestRevisionId from Recipes where RecipeId = ?;';
    $recipe_fetch_data = 'select RecipeId, RecipeRevisionId, JsonBlob from RecipeData where RecipeId = ? and RecipeRevisionId = ?;';

    try {
        // Part 1: Get the User ID for checking permissions.
        $uid_stmt = $recipe_conn->prepare($check_uid);
        $uid_stmt->bindParam(1, $_SESSION['email_address']);
        $uid_stmt_status = $uid_stmt->execute();
        $uid = $uid_stmt->fetch()[0];

        // Part 2: Check that either UID matches, or it is public
        $rec_meta_stmt = $recipe_conn->prepare($recipe_metadata_check);
        $rec_meta_stmt->bindParam(1, $recipeId);
        $rm_stmt_status = $rec_meta_stmt->execute();
        if ($rec_meta_stmt->rowCount() == 1) {
            // Here we handle it.
            $recipe_is_valid = true;
            $recipe_data = $rec_meta_stmt->fetch();
            $rec_uid = $recipe_data["UserId"];
            $rec_is_public = $recipe_data["IsPublic"];
            $rec_latest_public = $recipe_data["LatestPublishedRevisionId"];
            $rec_latest = $recipe_data["LatestRevisionId"];

            if ($rec_uid != $uid && $rec_is_public == false) {
                // Private recipe we don't own
                // We could consider 1 of the 2: Pretend like it doesn't exist, or
                // give a 403 Forbidden error and signal that it is not accessible.
                $recipe_is_allowed = false;
            } else if ($rec_uid != $uid && $recipeRevId > $rec_latest_public) {
                // We are trying to access a version we aren't allowed to.
                $recipe_is_allowed = false;
            } else {
                // Part 3: Get the recipe for the given revision.
                if ($rec_uid == $uid) {
                    if ($recipeRevId == null) {
                        // Default to latest revision
                        $recipeRevId = $rec_latest;
                    }
                } else {
                    if ($recipeRevId == null) {
                        // Default to latest public revision
                        $recipeRevId = $rec_latest_public;
                    }
                }
                $rec_fetch_stmt = $recipe_conn->prepare($recipe_fetch_data);
                $rec_fetch_stmt->bindParam(1, $recipeId);
                $rec_fetch_stmt->bindParam(2, $recipeRevId);

                $rec_fetch_stmt_status = $rec_fetch_stmt->execute();
                if ($rec_fetch_stmt->rowCount() == 1) {
                    $recipe_rev_is_valid = true;
                    $row = $rec_fetch_stmt->fetch();
                    $outJson = $row["JsonBlob"];
                }
            }
        }

        // We now do output.
        if ($recipe_is_valid == false ||
            $recipe_rev_is_valid == false ||
            $recipe_is_allowed == false) {
            // Return something, although empty to signify no response.
            $outJson = '{}';
        }

        header("HTTP/1.1 200 OK");
        header("Content-Type: application/json; charset=utf-8");

        echo $outJson;

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
