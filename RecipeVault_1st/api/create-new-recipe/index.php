<?php

// Endpoint is currently /api/create-new-recipe/
require("../../auth.php");

// Notes the reasons why it is invalid.
// Empty is valid.
$whyInvalid = [];

function recipeInputIsValid($recipeToCheck) {
    $is_valid = true;
    $num_valid_ingredients = 0;
    if (!is_array($recipeToCheck)) {
        // We require an associative array (dict)
        $whyInvalid[] = "NotArray";
        return false;
    }
    foreach (["title", "servings", "visibility",
              "ingredients", "instructions"] as $testvalue) {
        // Check if all are present.
        if (!in_array($testvalue, $recipeToCheck)) {
            // These values are mandatory.
            $whyInvalid[] = "Not in array: ".$testvalue;
            return false;
        }
    }
    foreach (array_keys($recipeToCheck) as $testKey) {
        switch ($testKey) {
            case "title":
                if (!is_a($recipeToCheck[$testKey], "string") ||
                    strlen($recipeToCheck[$testKey]) > 33) {
                    $is_valid = false;
                    $whyInvalid[] = "Title too long";
                }
                break;
            case "servings":
                if ($recipeToCheck[$testKey] < 1) {
                    $is_valid = false;
                    $whyInvalid[] = "Servings must be 1 or greater";
                }
                if ($recipeToCheck[$testKey] != (int)$recipeToCheck) {
                    // Check for floating-point values here.
                    $is_valid = false;
                    $whyInvalid[] = "Servings must be an integer";
                }
            case "visibility":
                switch ($recipeToCheck[$testKey]) {
                    case "public":
                    case "private":
                        break;
                    default:
                        $is_valid = false;
                        $whyInvalid[] = "Visibility must be public or private";
                        break;
                }
                break;
            case "ingredients":
                foreach ($recipeToCheck[$testKey] as $ingredient) {
                    // name (string), count (float), unit (null | string)
                    if (!is_a($ingredient["name"], "string") ||
                        strlen($ingredient["name"]) > 129) {
                        $is_valid = false;
                        $whyInvalid[] = "Ingredient name must be a string 128 or less characters long";
                    }
                    if ($ingredient["count"] <= 0) {
                        $is_valid = false;
                        $whyInvalid[] = "Ingredient must have more than 0 of itself";
                    }
                    if ($ingredient["unit"] != null &&
                        !is_a($ingredient["unit"], "string") ||
                        strlen($ingredient["unit"]) > 17) {
                        $is_valid = false;
                        $whyInvalid[] = "Ingredient unit must be null or a string 16 characters or less";
                    }
                }
                break;
            case "instructions":
                if (!is_a($recipeToCheck[$testKey], "string") ||
                    strlen($recipeToCheck[$testKey]) > 2049) {
                    $is_valid = false;
                    $whyInvalid = "Instructions must be a string 2KiB or less";
                }
                break;
        }
    }
    return $is_valid;
}

if (isset($_SESSION["email_address"])) {
    $recipeId = $_GET["id"];
    $recipeRevId = $_GET["revid"];

    require("../../private/do-recipe-dbconn.php");

//    // Enable for testing, and comment out the line setting output to application/json
//    header('Content-Type: text/plain; charset=utf-8');

    if (strtoupper($_SERVER["REQUEST_METHOD"]) != "POST") {
        header("HTTP/1.1 405 Method Not Allowed");
        header("Content-Type: application/json; charset=utf-8");
        echo '{"invalidRequest": true,"methodRequired":"post"}';
        exit;
    }

    // Read in the recipe JSON data
    $inputRecipeJson = file_get_contents("php://input");
    if ($inputRecipeJson == false) {
        header("HTTP/1.1 400 Bad Request");
        header("Content-Type: application/json; charset=utf-8");
        echo '{"invalidRequest":true,"requiresJsonResponse:true}';
        exit;
    }

    /*
     * The input JSON is similar to a recipe output JSON, but missing the id,
     * revision, and authorId properties (it is automatically set to caller's UID.
     */

    // Used to make it return an associative array (dict) instead of an object
    $inputRecipe = json_decode($inputRecipeJson, associative: true);

    // We need to validate the recipe first.
    $recipe_input_valid = recipeInputIsValid($inputRecipe);

    $rec_is_public = null;
    if ($inputRecipe["visibility"] == "public") {
        $rec_is_public = true;
    } else if ($inputRecipe["visibility"] == "private") {
        $rec_is_public = false;
    }

    if (!$recipe_input_valid) {
        header("HTTP/1.1 400 Bad Request");
        header("Content-Type: application/json; charset=utf-8");
        $invalResponseObj = [
            "invalidRequest" => true,
            "invalidReasons" => $whyInvalid
        ];
        $invalResponseJson = json_encode($invalResponseObj);
        echo $invalResponseJson;
        exit;
    }

    $check_uid = 'select UserId from AuthTable where EmailAddr = ?;';
    $recipe_metadata_check = 'select RecipeId, UserId, IsPublic, LatestPublishedRevisionId, LatestRevisionId from Recipes where RecipeId = ?;';
    $recipe_fetch_data = 'select RecipeId, RecipeRevisionId, JsonBlob from RecipeData where RecipeId = ? and RecipeRevisionId = ?;';

    # Prepared data insertion statements
    $recipe_insert_toplevel = 'insert into Recipes(UserId, RecipeName, IsPublic) values (?, ?, ?);';
    # Should be run AFTER lastInsertId()
    $recipe_get_revision_num = 'select recipe_new_revision(?);';
    $recipe_insert_data = 'insert into RecipeData(RecipeId, RecipeRevisionId, NumServings, Instructions) values (?, ?, ?, ?);';
    $recipe_insert_ingredients = 'insert ignore into Ingredients(IngredientName) values (?);';
    $recipe_insert_ingredient_mapping = 'insert into RecipeIngredients(RecipeId, RecipeRevisionId, IngredientId, IngredientCount, IngredientUnit) values (?, ?, ingredient_id(?), ?, ?);';
    $recipe_build_json = 'call build_recipe_json(?, ?);';
    # Mark revisions
    $recipe_mark_latest_overall = 'update Recipes set LatestRevisionId = ? where RecipeId = ?;';
    # Only run if the recipe is public
    $recipe_mark_latest_public = 'update Recipes set LatestPublishedRevisionId = ? where RecipeId = ?;';

    try {
        // Part 1: Get the User ID for checking permissions.
        $uid_stmt = $recipe_conn->prepare($check_uid);
        $uid_stmt->bindParam(1, $_SESSION['email_address']);
        $uid_stmt_status = $uid_stmt->execute();
        $uid = $uid_stmt->fetch()[0];

        // Disable autocommit, we want a big transaction.
        // Make sure to $recipe_conn->commit() later.
        $recipe_conn->beginTransaction();

        // Part 2: Insert the toplevel Recipe record.
        $toplvl_stmt = $recipe_conn->prepare($recipe_insert_toplevel);
        $toplvl_stmt->bindParam(1, $uid);
        $toplvl_stmt->bindParam(2, $inputRecipe["title"]);
        $toplvl_stmt->bindParam(3, $rec_is_public);
        $toplvl_status = $toplvl_stmt->execute();

        // Now we get the important data.
        $recipe_id = $recipe_conn->lastInsertId();
        $recipe_rid_stmt = $recipe_conn->prepare($recipe_get_revision_num);
        $recipe_rid_stmt->bindParam(1, $recipe_id);
        $recipe_rid_status = $recipe_rid_stmt->execute();
        // The only parameter from the select query.
        $recipe_rid = $recipe_rid_stmt->fetch()[0];

        // Part 3: Insert recipe data.
        $recipe_data_stmt = $recipe_conn->prepare($recipe_insert_data);
        $recipe_data_stmt->bindParam(1, $recipe_id);
        $recipe_data_stmt->bindParam(2, $recipe_rid);
        $recipe_data_stmt->bindParam(3, $num_servings);
        $recipe_data_stmt->bindParam(4, $instructions);
        $recipe_data_status = $recipe_data_stmt->execute();

        // Part 4: Insert recipe ingredients.
        $recipe_ins_ingr_stmt = $recipe_conn->prepare($recipe_insert_ingredients);
        $recipe_ingredient = null;
        $recipe_ins_ingr_status = [];
        // This binds to the parameter *name*.
        $recipe_ins_ingr_stmt->bindParam(1, $recipe_ingredient);
        foreach ($inputRecipe["ingredients"] as $ingredient) {
            $recipe_ingredient = $ingredient["name"];
            $recipe_ins_ingr_status[] = recipe_ins_ingr_stmt->execute();
        }

        // Part 5: Map the ingredients to the recipe revision.
        $recipe_ingr_map_stmt = $recipe_conn->prepare($recipe_insert_ingredient_mapping);
        $recipe_ingr_name = null;
        $recipe_ingr_count = null;
        $recipe_ingr_unit = null;
        // These bind to the parameter names.
        $recipe_ingr_map_stmt->bindParam(1, $recipe_id);
        $recipe_ingr_map_stmt->bindParam(2, $recipe_rid);
        // This is ingredient_id(name)
        $recipe_ingr_map_stmt->bindParam(3, $recipe_ingr_name);
        $recipe_ingr_map_stmt->bindParam(4, $recipe_ingr_count);
        $recipe_ingr_map_stmt->bindParam(5, $recipe_ingr_unit);
        // Go through the list of ingredients again.
        foreach ($inputRecipe["ingredients"] as $ingredient) {
            $recipe_ingr_name = $ingredient["name"];
            $recipe_ingr_count = $ingredient["count"];
            $recipe_ingr_unit = $ingredient["unit"];
        }

        // Part 6: Build the JSON.
        $recipe_bjson_stmt = $recipe_conn->prepare($recipe_build_json);
        $recipe_bjson_stmt->bindParam(1, $recipe_id);
        $recipe_bjson_stmt->bindParam(2, $recipe_rid);
        $recipe_bjson_status = $recipe_bjson_stmt->execute();

        // Part 7: Mark the latest revision.
        // TODO: Write the code to do this. This needs to distinguish between public and private.
        $recipe_latest_overall_stmt = $recipe_conn->prepare($recipe_mark_latest_overall);
        $recipe_latest_overall_stmt->bindParam(1, $recipe_rid);
        $recipe_latest_overall_stmt->bindParam(2, $recipe_id);
        $recipe_latest_overall_status = $recipe_latest_overall_stmt->execute();
        $recipe_latest_public_status = null;
        if ($rec_is_public) {
            $recipe_latest_public_stmt = $recipe_conn->prepare($recipe_mark_latest_public);
            $recipe_latest_public_stmt->bindParam(1, $recipe_rid);
            $recipe_latest_public_stmt->bindParam(2, $recipe_id);
            $recipe_latest_public_status = $recipe_latest_public_stmt->execute();
        }

        // Part 8: We should be good to commit this.
        $commit_status = $recipe_conn->commit();

        // Part 9: Send the JSON back.
        // TODO: Refetch the JSON (like api/get-recipe)
        $recipe_json_refetch = $recipe_conn->prepare($recipe_fetch_data);
        $recipe_json_refetch->bindParam(1, $recipe_id);
        $recipe_json_refetch->bindParam(2, $recipe_rid);
        $recipe_json_refetch_status = $recipe_json_refetch->execute();
        $recipe_json_refetch_res = $recipe_json_refetch->fetch();
        $recipe_refetched_json = $recipe_json_refetch_res["JsonBlob"];

        // FIXME: This code is disabled, and kept for reference.
        exit;
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
