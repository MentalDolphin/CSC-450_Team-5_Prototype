<?php

// Endpoint is currently /api/get-available-recipes/
require("../../auth.php");

if (isset($_SESSION["email_address"])) {
    // Import my recipes from existing script.
    // This also sets up the database connection.
    $isSubscript = true;
    require("../get-my-recipes/index.php");
    $isSubscript = false;

//    // Enable for testing, and comment out the line setting output to application/json
//    header('Content-Type: text/plain; charset=utf-8');

    // Feature: If this is null, appending to an "array" at this variable creates an array.
    // My Recipes data is imported from global variable in that subscript.
    $rec_mine = $rvMyAvailRecipes;
    $rec_public = null;

    // Public recipes not owned by us
    $recipe_metadata_fetch_public = 'select RecipeId, UserId, IsPublic, LatestPublishedRevisionId from Recipes where UserId != ? and IsPublic is true order by RecipeId;';

    try {
        // Part 1: Get the User ID for checking permissions.
        $uid = $rvUid;

        // Part 2: Fetch my recipes and public recipes not ours.

        $rec_meta_public_stmt = $recipe_conn->prepare($recipe_metadata_fetch_public);
        $rec_meta_public_stmt->bindParam(1, $uid);
        $rmp_stmt_status = $rec_meta_public_stmt->execute();

        // Part 3: Build JSON output
        foreach ($rec_meta_public_stmt->fetchAll() as $prow) {
            $rec_public[] = [
              "id" => $prow["RecipeId"],
              "latestRevision" => $prow["LatestPublishedRevisionId"],
              "latestPublicRevision" => $prow["LatestPublishedRevisionId"],
              "visibility" => "public",
              "authorId" => $prow["UserId"],
              "isMine" => false
            ];
        }

        // We now do output.
        $recipes_available = [
          "myRecipes" => $rec_mine,
          "otherPublicRecipes" => $rec_public
        ];

        $outJson = json_encode($recipes_available);

        if ($isSubscript != true) {
            header("HTTP/1.1 200 OK");
            header("Content-Type: application/json; charset=utf-8");
            echo $outJson;
        } else {
            // When run in subscript, we pass on our data for others to use.
            global $rvAvailRecipes, $rvAvailRecipesJson;
            $rvAvailRecipes = $recipes_available;
            $rvAvailRecipesJson = $outJson;
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
