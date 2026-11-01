<?php

// Endpoint is currently /api/get-recipe-revisions/
require("../../auth.php");

if (isset($_SESSION["email_address"])) {
    $recipeId = $_GET["id"];

    require("../../private/do-recipe-dbconn.php");

//    // Enable for testing, and comment out the line setting output to application/json
//    header('Content-Type: text/plain; charset=utf-8');

    // Determines whether output is blank
    $recipe_is_valid = false;
    $recipe_is_allowed = true;

    $rec_public_revisions = null;
    $rec_private_revisions = null;

    $check_uid = 'select UserId from AuthTable where EmailAddr = ?;';
    $recipe_metadata_check = 'select RecipeId, UserId, IsPublic, LatestPublishedRevisionId from Recipes where RecipeId = ?;';
    $recipe_revcheck = 'select RecipeId, RecipeRevisionId from RecipeData where RecipeId = ? order by RecipeRevisionId;';
    // Use when not authorized to access private revisions
    $recipe_revcheck_public_only = 'select RecipeId, RecipeRevisionId from RecipeData where RecipeId = ? and RecipeRevisionId <= ? order by RecipeRevisionId;';

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

            if ($rec_uid != $uid && $rec_is_public == false) {
                // Private recipe we don't own
                // We could consider 1 of the 2: Pretend like it doesn't exist, or
                // give a 403 Forbidden error and signal that it is not accessible.
                $recipe_is_allowed = false;
            } else {
                // Part 3: Find allowed revisions
                if ($rec_uid == $uid) {
                    $rec_rc_stmt = $recipe_conn->prepare($recipe_revcheck);
                    $rec_rc_stmt->bindParam(1, $recipeId);
                } else {
                    $rec_rc_stmt = $recipe_conn->prepare($recipe_revcheck_public_only);
                    $rec_rc_stmt->bindParam(1, $recipeId);
                    $rec_rc_stmt->bindParam(2, $rec_latest_public);
                }


                $rec_rc_stmt_status = $rec_rc_stmt->execute();
                foreach ($rec_rc_stmt->fetchAll() as $row) {
                    $res_rev = $row["RecipeRevisionId"];
                    if ($res_rev <= $rec_latest_public) {
                        // It is public
                        $rec_public_revisions[] = $res_rev;
                    } else {
                        // It is private
                        $rec_private_revisions[] = $res_rev;
                    }
                }
            }
        }

        // We now do output.
        $recipe_rev_data = [
          "publicRevisions" => $rec_public_revisions,
          "privateRevisions" => $rec_private_revisions,
          // FIXME: These are solely for debugging, remove when tested
          "latestPublic" => $rec_latest_public,
          "isMine" => $rec_uid == $uid
        ];

        if ($recipe_is_valid == false || $recipe_is_allowed == false) {
            // Delete Private from representation
            unset($recipe_rev_data["privateRevisions"]);
            $recipe_rev_data["publicRevisions"] = null;
        } else if ($recipe_is_allowed == false) {
            $recipe_rev_data["latestPublic"] = $rec_latest_public;
            $recipe_rev_data["privateIntendedRevisions"] = $rec_private_revisions;
            unset($recipe_rev_data["privateRevisions"]);
        }

        $outJson = json_encode($recipe_rev_data);

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
