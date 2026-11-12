<?php

// Endpoint is currently /api/create-new-recipe/
require("../../auth.php");

// Notes the reasons why it is invalid.
// Empty is valid.
$whyInvalid = [];
// Notes the reasons why it failed.
$whyFailed = [];

function recipeInputIsValid($recipeToCheck) {
    $is_valid = true;
    global $whyInvalid;
    $num_valid_ingredients = 0;
    if (!is_array($recipeToCheck)) {
        // We require an associative array (dict)
        $whyInvalid[] = "NotArray";
        $is_valid = false;
//        echo "Not an array.\n";
        return false;
    }
    foreach (["title", "servings", "visibility",
              "ingredients", "instructions"] as $testvalue) {
        // Check if all are present.
//        echo "Checking for key $testvalue\n";
        if (!array_key_exists($testvalue, $recipeToCheck)) {
            // These values are mandatory.
            $whyInvalid[] = "Not in array: $testvalue\n";
            $is_valid = false;
            return false;
        }
    }
    foreach (array_keys($recipeToCheck) as $testKey) {
//        echo "\n\nRunning iteration on key $testKey...\n";
        switch ($testKey) {
            case "title":
                if (!is_string($recipeToCheck[$testKey]) ||
                    strlen($recipeToCheck[$testKey]) > 33) {
                    $is_valid = false;
                    $whyInvalid[] = "Title too long";
//                    echo "Title invalid\n";
                }
                break;
            case "servings":
                if ($recipeToCheck[$testKey] < 1) {
                    $is_valid = false;
                    $whyInvalid[] = "Servings must be 1 or greater";
//                    echo "Serving size too small\n";
                }
                if ($recipeToCheck[$testKey] != (int)$recipeToCheck[$testKey]) {
                    // Check for floating-point values here.
                    $is_valid = false;
                    $whyInvalid[] = "Servings must be an integer";
//                    echo "Non-integer serving size\n";
                }
                break;
            case "visibility":
                switch ($recipeToCheck[$testKey]) {
                    case "public":
                    case "private":
                        break;
                    default:
                        $is_valid = false;
                        $whyInvalid[] = "Visibility must be public or private";
//                        echo "Visibility $recipeToCheck[$testKey] is invalid\n";
                        break;
                }
                break;
            case "ingredients":
                foreach ($recipeToCheck[$testKey] as $ingredient) {
                    // name (string), count (float), unit (null | string)
                    $_tmp_igr_name = $ingredient["name"];
//                    echo "Testing ingredient $_tmp_igr_name...\n";
                    if (!is_string($ingredient["name"]) ||
                        strlen($ingredient["name"]) > 129) {
                        $is_valid = false;
                        $whyInvalid[] = "Ingredient name must be a string 128 or less characters long";
//                        echo "Ingredient name too long\n";
                    }
                    if ($ingredient["count"] <= 0) {
                        $is_valid = false;
                        $whyInvalid[] = "Ingredient must have more than 0 of itself";
//                        echo "Ingredient count must be > 0\n";
                    }
                    if ($ingredient["unit"] != null &&
                        !is_string($ingredient["unit"]) ||
                        strlen($ingredient["unit"]) > 17) {
                        $is_valid = false;
                        $whyInvalid[] = "Ingredient unit must be null or a string 16 characters or less";
//                        echo "Ingredient unit is invalid\n";
                    }
                }
                break;
            case "instructions":
                if (!is_string($recipeToCheck[$testKey]) ||
                    strlen($recipeToCheck[$testKey]) > 2049) {
                    $is_valid = false;
                    $whyInvalid[] = "Instructions must be a string 2KiB or less";
//                    echo "Instructions are invalid\n";
                }
                break;
            default:
                break;
        }
    }
    return $is_valid;
}

if (isset($_SESSION["email_address"])) {
    require("../../private/do-recipe-dbconn.php");

//    // Enable for testing, and comment out the line setting output to application/json
//    header('Content-Type: text/plain; charset=utf-8');

    if (strtoupper($_SERVER["REQUEST_METHOD"]) != "POST") {
        header("HTTP/1.1 405 Method Not Allowed");
        header("Content-Type: application/json; charset=utf-8");
        echo '{"invalidRequest":true,"methodRequired":"post"}';
        exit;
    }

    // Read in the recipe JSON data
    $inputRecipeJson = file_get_contents("php://input");
    if ($inputRecipeJson == false) {
        header("HTTP/1.1 400 Bad Request");
        header("Content-Type: application/json; charset=utf-8");
        echo '{"invalidRequest":true,"requiresJsonResponse":true}';
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
    $recipe_creation_success = true;

    $rec_is_public = null;
    if ($inputRecipe["visibility"] == "public") {
        $rec_is_public = true;
    } else if ($inputRecipe["visibility"] == "private") {
        $rec_is_public = false;
    }

    if ($recipe_input_valid == false) {
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
    $recipe_fetch_data = 'select RecipeId, RecipeRevisionId, JsonBlob from RecipeData where RecipeId = ? and RecipeRevisionId = ?;';

    # Prepared data insertion statements
    $recipe_insert_toplevel = 'insert into Recipes(UserId, RecipeName, IsPublic) values (:uid, :renam, :ispub);';
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
        $toplvl_stmt->bindParam('uid', $uid);
        $toplvl_stmt->bindParam('renam', $inputRecipe["title"]);
        // Work around a bug: Sometimes it thinks this is null.
        $toplvl_stmt->bindValue('ispub', $rec_is_public? '1' : '0');
        $toplvl_status = $toplvl_stmt->execute();
        if (!$toplvl_status) {
            // We failed to insert it.
            $recipe_creation_success = false;
            $whyFailed[] = "Failed to insert toplevel data";
            goto FailedCreationShortcut;
        }

        // Now we get the important data.
        $recipe_id = $recipe_conn->lastInsertId();
        $recipe_rid_stmt = $recipe_conn->prepare($recipe_get_revision_num);
        $recipe_rid_stmt->bindParam(1, $recipe_id);
        $recipe_rid_status = $recipe_rid_stmt->execute();
        if (!$recipe_rid_status) {
            // We failed to get recipe revision ID.
            $recipe_creation_success = false;
            $whyFailed[] = "Failed to get new recipe revision";
            goto FailedCreationShortcut;
        }
        // The only parameter from the select query.
        $recipe_rid = $recipe_rid_stmt->fetch()[0];

        // Part 3: Insert recipe data.
        $recipe_data_stmt = $recipe_conn->prepare($recipe_insert_data);
        $num_servings = $inputRecipe["servings"];
        $instructions = $inputRecipe["instructions"];
        $recipe_data_stmt->bindParam(1, $recipe_id);
        $recipe_data_stmt->bindParam(2, $recipe_rid);
        $recipe_data_stmt->bindParam(3, $num_servings);
        $recipe_data_stmt->bindParam(4, $instructions);
        $recipe_data_status = $recipe_data_stmt->execute();
        if (!$recipe_data_status) {
            // We failed to insert revision-specific data
            $recipe_creation_success = false;
            $whyFailed[] = "Failed to insert revision data (RecipeData)";
            goto FailedCreationShortcut;
        }

        // Part 4: Insert recipe ingredients.
        $recipe_ins_ingr_stmt = $recipe_conn->prepare($recipe_insert_ingredients);
        $recipe_ingredient = null;
        $recipe_ins_ingr_status = [];
        // This binds to the parameter *name*.
        $recipe_ins_ingr_stmt->bindParam(1, $recipe_ingredient);
        foreach ($inputRecipe["ingredients"] as $ingredient) {
            $recipe_ingredient = $ingredient["name"];
            $recipe_ins_ingr_item_status = $recipe_ins_ingr_stmt->execute();
            $recipe_ins_ingr_status[] = $recipe_ins_ingr_item_status;
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
        $recipe_ingr_map_status = [];
        // Go through the list of ingredients again.
        foreach ($inputRecipe["ingredients"] as $ingredient) {
            $recipe_ingr_name = $ingredient["name"];
            $recipe_ingr_count = $ingredient["count"];
            $recipe_ingr_unit = $ingredient["unit"];
            $recipe_map_ingr_item_status = $recipe_ingr_map_stmt->execute();
            $recipe_ingr_map_status[] = $recipe_map_ingr_item_status;
            if (!$recipe_map_ingr_item_status) {
                $recipe_creation_success = false;
            }
        }
        if (!$recipe_creation_success) {
            // We failed to set up the mappings.
            $whyFailed[] = [
                "failedItem" => "ingredients",
                "failureList" => $recipe_ingr_map_status
            ];
            goto FailedCreationShortcut;
        }

        // Part 6: Build the JSON.
        $recipe_bjson_stmt = $recipe_conn->prepare($recipe_build_json);
        $recipe_bjson_stmt->bindParam(1, $recipe_id);
        $recipe_bjson_stmt->bindParam(2, $recipe_rid);
        $recipe_bjson_status = $recipe_bjson_stmt->execute();
        if (!$recipe_bjson_status) {
            // We failed to build the JSON
            $recipe_creation_success = false;
            $whyFailed[] = "Failed to build recipe JSON";
            goto FailedCreationShortcut;
        }

        // Part 7: Mark the latest revision.
        // TODO: Write the code to do this. This needs to distinguish between public and private.
        $recipe_latest_overall_stmt = $recipe_conn->prepare($recipe_mark_latest_overall);
        $recipe_latest_overall_stmt->bindParam(1, $recipe_rid);
        $recipe_latest_overall_stmt->bindParam(2, $recipe_id);
        $recipe_latest_overall_status = $recipe_latest_overall_stmt->execute();
        if (!$recipe_latest_overall_status) {
            $recipe_creation_success = false;
            $whyFailed[] = "Failed to set latest revision ID";
            goto FailedCreationShortcut;
        }
        $recipe_latest_public_status = null;
        if ($rec_is_public) {
            $recipe_latest_public_stmt = $recipe_conn->prepare($recipe_mark_latest_public);
            $recipe_latest_public_stmt->bindParam(1, $recipe_rid);
            $recipe_latest_public_stmt->bindParam(2, $recipe_id);
            $recipe_latest_public_status = $recipe_latest_public_stmt->execute();
            if (!$recipe_latest_public_status) {
                $recipe_creation_success = false;
                $whyFailed[] = "Failed to set latest published revision ID";
                goto FailedCreationShortcut;
            }
        }

        // Part 8: We should be good to commit this.
        $commit_status = $recipe_conn->commit();
        if (!$commit_status) {
            $recipe_creation_success = false;
            $whyFailed[] = "Failed to commit recipe";
            goto FailedCreationShortcut;
        }

        // Part 9: Send the JSON back.
        // TODO: Refetch the JSON (like api/get-recipe)
        $recipe_json_refetch = $recipe_conn->prepare($recipe_fetch_data);
        $recipe_json_refetch->bindParam(1, $recipe_id);
        $recipe_json_refetch->bindParam(2, $recipe_rid);
        $recipe_json_refetch_status = $recipe_json_refetch->execute();
        if (!$recipe_json_refetch_status) {
            $recipe_creation_success = false;
            $whyFailed[] = "Failed to refetch recipe";
            goto FailedCreationShortcut;
        } else if ($recipe_json_refetch->rowCount() != 1) {
            $recipe_creation_success = false;
            $recipe_refetch_count = $recipe_json_refetch->rowCount();
            $whyFailed[] = "Wrong number of recipes ($recipe_refetch_count)";
            goto FailedCreationShortcut;
        }
        $recipe_json_refetch_res = $recipe_json_refetch->fetch();
        $recipe_refetched_json = $recipe_json_refetch_res["JsonBlob"];

        FailedCreationShortcut:
        if (!$recipe_creation_success) {
            $outJson = [
                "creationSuccess" => false,
                "failureReasons" => $whyFailed,
            ];
            header("HTTP/1.1 500 Internal Server Error");
            header("Content-Type: application/json; charset=utf-8");
            $recipe_conn->rollBack();
            echo $outJson;
            exit;
        }

        header("HTTP/1.1 201 Created");
        header("Content-Type: application/json; charset=utf-8");

        $outJson = $recipe_refetched_json;
        echo $outJson;

    } catch (PDOException $exc) {
        header('HTTP/1.1 500 Internal Server Error');
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
