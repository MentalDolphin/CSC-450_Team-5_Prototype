<?php

// This performs the authentication check before serving the page.
// The original page continues unmodified below.

require("auth.php");

if (isset($_SESSION['email_address'])) {
    // Session is valid, serve the page.
//    echo "<h2>You are logged in.</h2>";
//    echo "<p>Your email address is: " . $_SESSION['email_address'] . "</p>";
//    echo "<p>Your uid is: " . $_SESSION['uid'] . "</p>";
} else {
    // Session is invalid, redirect to login page.
//    $url = parse_url(
    header("HTTP/1.1 302 Found");
    header("Location: login");
//    echo "<h2>You are not logged in.</h2>";
}

?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>RecipeVault</title>

    <link rel="stylesheet" href="resources/style.css" />
    <script src="script.js" defer="defer"></script>
</head>

<body>

    <!-- ==================================================
         HEADER AND NAVIGATION
    =================================================== -->

    <a href="#mainContent" class="skip-link">Skip to content</a>

    <header>
        <p class="site-name">RecipeVault</p>

        <nav aria-label="Main navigation">
            <button id="searchPageButton" type="button">
                Search Recipes
            </button>

            <button id="myRecipesButton" type="button">
                My Recipes
            </button>

            <button id="addRecipeButton" type="button">
                Add Recipe
            </button>
            <a href="logout">
                <div class="linkButton">Log out</div>
            </a>
        </nav>
    </header>

    <main id="mainContent">

        <h1 id="pageHeading" tabindex="-1">Search Recipes</h1>

        <p class="prototype-note">
            Class prototype: you are using the demo author account.
            Recipes are saved only in this browser.
        </p>

        <p id="statusMessage" role="status" aria-live="polite"></p>


        <!-- ==================================================
             SEARCH AND RECIPE LIST
        =================================================== -->

        <section id="recipeListSection">

            <form id="searchForm" novalidate>
                <label for="searchInput">Recipe name or ingredient</label>

                <div class="search-controls">
                    <input
                        id="searchInput"
                        type="search"
                        placeholder="Try chicken, milk, or olive oil"
                        aria-describedby="searchHelp searchError"
                    >

                    <button id="basicSearchButton" type="button">Search</button>

                    <button
                        id="showAllButton"
                        type="button"
                        class="secondary-button"
                    >
                        Show All
                    </button>
                </div>

                <p id="searchHelp" class="help-text">
                    Search using a full or partial recipe name, or a single ingredient.
                </p>

                <p id="searchError" class="error-message" role="alert"></p>
            </form>

            <button id="advancedSearchButton" type="button"
                class="secondary-button" aria-expanded="false"
                aria-controls="advancedSearchPanel">Advanced Search</button>

            <section id="advancedSearchPanel" hidden aria-labelledby="advancedSearchHeading">
                <h2 id="advancedSearchHeading">Search by Ingredients</h2>
                <form id="advancedSearchForm" novalidate>
                    <label for="advancedIngredients">Ingredients to include</label>
                    <textarea id="advancedIngredients" rows="3" maxlength="1000"
                        placeholder="chicken, lemon, olive oil"
                        aria-describedby="advancedSearchHelp advancedSearchError" required></textarea>
                    <p id="advancedSearchHelp" class="help-text">
                        Separate ingredients with commas or new lines. Recipes must contain
                        all ingredients. Matches ignore capitalization and allow partial names.
                        Enter up to 20 ingredients, each up to 60 characters (1,000 characters total).
                    </p>
                    <p id="advancedSearchError" class="error-message" role="alert"></p>
                    <div class="button-row">
                        <button id="searchIngredientsButton" type="button">Search Ingredients</button>
                        <button id="clearAdvancedSearchButton" type="button"
                            class="secondary-button">Clear Search</button>
                    </div>
                </form>
            </section>

            <h2 id="resultsHeading">Available Recipes</h2>

            <p id="recipeCount"></p>

            <div id="recipeCards" class="recipe-grid"></div>
        </section>


        <!-- ==================================================
             ADD AND EDIT FORM
        =================================================== -->

        <section id="recipeFormSection" hidden>

            <p>
                All fields are required. Enter ingredients and instructions
                on separate lines.
            </p>

            <form id="recipeForm" novalidate>

                <p
                    id="formError"
                    class="error-message"
                    role="alert"
                    tabindex="-1"
                ></p>

                <label for="recipeTitle">Recipe name</label>

                <input
                    id="recipeTitle"
                    type="text"
                    maxlength="120"
                    aria-describedby="formError"
                    required
                >

                <div class="form-row">
                    <div>
                        <label for="recipeServings">Servings</label>

                        <input
                            id="recipeServings"
                            type="number"
                            min="1"
                            max="1000"
                            step="1"
                            value="4"
                            aria-describedby="formError"
                            required
                        >
                    </div>

                    <div>
                        <label for="recipeVisibility">Visibility</label>

                        <select id="recipeVisibility">
                            <option value="private">Private</option>
                            <option value="public">Public</option>
                        </select>
                    </div>
                </div>

                <label for="recipeIngredients">Ingredients</label>

                <textarea
                    id="recipeIngredients"
                    rows="5"
                    placeholder="2 cups rice&#10;1 tablespoon olive oil"
                    aria-describedby="formError"
                    required
                ></textarea>

                <label for="recipeInstructions">Instructions</label>

                <textarea
                    id="recipeInstructions"
                    rows="6"
                    placeholder="Rinse the rice.&#10;Cook until tender."
                    aria-describedby="formError"
                    required
                ></textarea>

                <p id="revisionMessage" class="help-text"></p>

                <div class="button-row">
                    <button id="saveRecipeButton" type="submit">
                        Save Recipe
                    </button>

                    <button
                        id="cancelButton"
                        type="button"
                        class="secondary-button"
                    >
                        Cancel
                    </button>
                </div>

            </form>
        </section>


        <!-- ==================================================
             RECIPE DETAILS
        =================================================== -->

        <section id="recipeDetailsSection" hidden>

            <p id="recipeDetailsSummary"></p>

            <h2>Ingredients</h2>
            <p id="recipeDetailsIngredients" class="multiline-text"></p>

            <h2>Instructions</h2>
            <p id="recipeDetailsInstructions" class="multiline-text"></p>

            <div class="button-row">
                <button id="editRecipeButton" type="button">
                    Edit Recipe
                </button>

                <button
                    id="backButton"
                    type="button"
                    class="secondary-button"
                >
                    Back to Recipes
                </button>
            </div>

            <div id="revisionHistorySection" hidden>
                <h2>Previous Published Revisions</h2>

                <div id="revisionHistory"></div>
            </div>

        </section>

    </main>


    <!-- ==================================================
         FOOTER
    =================================================== -->

    <footer>
        <p>RecipeVault — Software Engineering Team Project</p>
    </footer>

</body>
</html>
