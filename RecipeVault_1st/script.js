"use strict";

/* ==================================================
   SETTINGS AND SAMPLE DATA
================================================== */

// This is a demo identity, not a real login system.
const CURRENT_AUTHOR = "demo-author";

const STORAGE_KEY = "recipevault-readable-v1";

const sampleRecipes = [
    {
        id: "recipe-1",
        author: CURRENT_AUTHOR,
        title: "Lemon Chicken",
        servings: 4,
        visibility: "public",
        ingredients:
            "2 chicken breasts\n" +
            "1 lemon\n" +
            "1 tablespoon olive oil",
        instructions:
            "Heat the olive oil in a pan.\n" +
            "Cook the chicken thoroughly.\n" +
            "Add lemon juice before serving.",
        revision: 1,
        history: []
    },

    {
        id: "recipe-2",
        author: "another-author",
        title: "Tomato Basil Pasta",
        servings: 2,
        visibility: "public",
        ingredients:
            "200 grams pasta\n" +
            "2 tomatoes\n" +
            "6 basil leaves",
        instructions:
            "Boil the pasta.\n" +
            "Cook the tomatoes in a separate pan.\n" +
            "Combine the pasta, tomatoes, and basil.",
        revision: 1,
        history: []
    },

    {
        id: "recipe-3",
        author: CURRENT_AUTHOR,
        title: "Weekend Pancakes",
        servings: 4,
        visibility: "private",
        ingredients:
            "1 cup flour\n" +
            "1 cup milk\n" +
            "1 egg",
        instructions:
            "Mix the ingredients.\n" +
            "Pour small portions onto a warm skillet.\n" +
            "Cook both sides until done.",
        revision: 1,
        history: []
    }
];


/* ==================================================
   PAGE ELEMENTS
================================================== */

const pageHeading = document.getElementById("pageHeading");
const statusMessage = document.getElementById("statusMessage");

const recipeListSection =
    document.getElementById("recipeListSection");

const recipeFormSection =
    document.getElementById("recipeFormSection");

const recipeDetailsSection =
    document.getElementById("recipeDetailsSection");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchError = document.getElementById("searchError");

const resultsHeading = document.getElementById("resultsHeading");
const recipeCount = document.getElementById("recipeCount");
const recipeCards = document.getElementById("recipeCards");

const recipeForm = document.getElementById("recipeForm");
const formError = document.getElementById("formError");

const titleInput = document.getElementById("recipeTitle");
const servingsInput = document.getElementById("recipeServings");
const visibilityInput = document.getElementById("recipeVisibility");

const ingredientsInput =
    document.getElementById("recipeIngredients");

const instructionsInput =
    document.getElementById("recipeInstructions");

const revisionMessage = document.getElementById("revisionMessage");
const saveRecipeButton = document.getElementById("saveRecipeButton");

const detailsSummary =
    document.getElementById("recipeDetailsSummary");

const detailsIngredients =
    document.getElementById("recipeDetailsIngredients");

const detailsInstructions =
    document.getElementById("recipeDetailsInstructions");

const editRecipeButton = document.getElementById("editRecipeButton");

const revisionHistorySection =
    document.getElementById("revisionHistorySection");

const revisionHistory = document.getElementById("revisionHistory");


/* ==================================================
   APPLICATION STATE
================================================== */

// null means the form is adding a recipe instead of editing one.
let editingRecipeId = null;

let selectedRecipeId = null;

let showingMyRecipes = false;

let recipes = loadRecipes();


/* ==================================================
   STORAGE FUNCTIONS
================================================== */

function copyData(data) {
    return JSON.parse(JSON.stringify(data));
}


function isValidStoredRecipe(recipe) {
    if (recipe === null || typeof recipe !== "object") {
        return false;
    }

    return (
        typeof recipe.id === "string" &&
        typeof recipe.author === "string" &&
        typeof recipe.title === "string" &&
        typeof recipe.ingredients === "string" &&
        typeof recipe.instructions === "string" &&
        Number.isInteger(recipe.servings) &&
        recipe.servings >= 1 &&
        recipe.servings <= 1000 &&
        Number.isInteger(recipe.revision) &&
        recipe.revision >= 1 &&
        ["public", "private"].includes(recipe.visibility) &&
        Array.isArray(recipe.history)
    );
}


function loadRecipes() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData === null) {
            return copyData(sampleRecipes);
        }

        const savedRecipes = JSON.parse(savedData);

        if (
            !Array.isArray(savedRecipes) ||
            !savedRecipes.every(isValidStoredRecipe)
        ) {
            throw new Error("Invalid saved recipe data.");
        }

        return savedRecipes;
    } catch (error) {
        showStatus(
            "Saved recipes could not be loaded. Sample recipes are shown."
        );

        return copyData(sampleRecipes);
    }
}


function saveRecipes(updatedRecipes) {
    try {
        const recipeData = JSON.stringify(updatedRecipes);

        // Update application data only after storage succeeds.
        localStorage.setItem(STORAGE_KEY, recipeData);

        recipes = updatedRecipes;

        return true;
    } catch (error) {
        formError.textContent =
            "Your recipe could not be saved. " +
            "Your entries are still here. Check browser storage and try again.";

        formError.focus();

        return false;
    }
}


/* ==================================================
   SHARED PAGE FUNCTIONS
================================================== */

function showStatus(message) {
    statusMessage.textContent = message;
}


function showSection(section, heading) {
    recipeListSection.hidden = true;
    recipeFormSection.hidden = true;
    recipeDetailsSection.hidden = true;

    section.hidden = false;

    pageHeading.textContent = heading;
    pageHeading.focus();
}


function createTextElement(tagName, text, className = "") {
    const element = document.createElement(tagName);

    // textContent displays recipe text without interpreting it as HTML.
    element.textContent = text;

    if (className !== "") {
        element.className = className;
    }

    return element;
}


function canViewRecipe(recipe) {
    return (
        recipe.visibility === "public" ||
        recipe.author === CURRENT_AUTHOR
    );
}


/* ==================================================
   RECIPE LIST AND SEARCH
================================================== */

function openRecipeList(onlyMyRecipes = false) {
    showingMyRecipes = onlyMyRecipes;

    searchInput.value = "";
    searchError.textContent = "";
    searchInput.removeAttribute("aria-invalid");

    showStatus("");

    if (showingMyRecipes) {
        showSection(recipeListSection, "My Recipes");
    } else {
        showSection(recipeListSection, "Search Recipes");
    }

    displayRecipes();
}


function displayRecipes(searchTerm = "") {
    recipeCards.replaceChildren();

    const normalizedSearch = searchTerm.toLowerCase();

    const matchingRecipes = recipes.filter(function (recipe) {
        const accessible = canViewRecipe(recipe);

        const belongsInCollection =
            !showingMyRecipes ||
            recipe.author === CURRENT_AUTHOR;

        const matchesName =
            recipe.title.toLowerCase().includes(normalizedSearch);

        return accessible && belongsInCollection && matchesName;
    });

    if (searchTerm !== "") {
        resultsHeading.textContent = 'Results for "' + searchTerm + '"';
    } else if (showingMyRecipes) {
        resultsHeading.textContent = "Your Collection";
    } else {
        resultsHeading.textContent = "Available Recipes";
    }

    recipeCount.textContent =
        matchingRecipes.length + " recipe(s) found.";

    if (matchingRecipes.length === 0) {
        const emptyMessage = createTextElement(
            "p",
            "No matching recipes were found.",
            "empty-message"
        );

        recipeCards.appendChild(emptyMessage);
        return;
    }

    matchingRecipes.forEach(function (recipe) {
        const card = createRecipeCard(recipe);
        recipeCards.appendChild(card);
    });
}


function createRecipeCard(recipe) {
    const card = document.createElement("article");
    card.className = "recipe-card";

    const title = createTextElement("h3", recipe.title);

    const visibility = createTextElement(
        "p",
        "Visibility: " + recipe.visibility,
        "recipe-label"
    );

    const information = createTextElement(
        "p",
        recipe.servings + " servings | Revision " + recipe.revision
    );

    const viewButton = createTextElement(
        "button",
        "View " + recipe.title
    );

    viewButton.type = "button";

    viewButton.addEventListener("click", function () {
        openRecipeDetails(recipe.id);
    });

    card.append(title, visibility, information, viewButton);

    // Only show Edit for recipes owned by the demo author.
    if (recipe.author === CURRENT_AUTHOR) {
        const editButton = createTextElement(
            "button",
            "Edit " + recipe.title,
            "secondary-button"
        );

        editButton.type = "button";

        editButton.addEventListener("click", function () {
            openRecipeForm(recipe.id);
        });

        card.appendChild(editButton);
    }

    return card;
}


function searchRecipes(event) {
    event.preventDefault();

    const searchTerm = searchInput.value.trim();

    if (searchTerm === "") {
        searchError.textContent = "Please enter a recipe name.";
        searchInput.setAttribute("aria-invalid", "true");
        searchInput.focus();
        return;
    }

    searchError.textContent = "";
    searchInput.removeAttribute("aria-invalid");

    displayRecipes(searchTerm);
    showStatus(recipeCount.textContent);
}


/* ==================================================
   OPEN THE ADD OR EDIT FORM
================================================== */

function clearFormErrors() {
    formError.textContent = "";

    const fields = [
        titleInput,
        servingsInput,
        ingredientsInput,
        instructionsInput
    ];

    fields.forEach(function (field) {
        field.removeAttribute("aria-invalid");
    });
}


function openRecipeForm(recipeId = null) {
    let recipeToEdit = null;

    if (recipeId !== null) {
        recipeToEdit = recipes.find(function (recipe) {
            return recipe.id === recipeId;
        });

        if (
            !recipeToEdit ||
            recipeToEdit.author !== CURRENT_AUTHOR
        ) {
            showStatus("You can only edit your own recipes.");
            return;
        }
    }

    editingRecipeId = recipeId;

    recipeForm.reset();
    clearFormErrors();
    showStatus("");

    if (recipeToEdit === null) {
        saveRecipeButton.textContent = "Save Recipe";

        revisionMessage.textContent =
            "Private recipes appear only in your own collection.";

        showSection(recipeFormSection, "Add a Recipe");
    } else {
        titleInput.value = recipeToEdit.title;
        servingsInput.value = recipeToEdit.servings;
        visibilityInput.value = recipeToEdit.visibility;
        ingredientsInput.value = recipeToEdit.ingredients;
        instructionsInput.value = recipeToEdit.instructions;

        saveRecipeButton.textContent = "Save Changes";

        if (recipeToEdit.visibility === "public") {
            revisionMessage.textContent =
                "Saving creates a new revision and preserves " +
                "the previous published revision.";
        } else {
            revisionMessage.textContent =
                "Saving updates your private recipe.";
        }

        showSection(recipeFormSection, "Edit a Recipe");
    }

    titleInput.focus();
}


/* ==================================================
   READ AND VALIDATE FORM INPUT
================================================== */

function getRecipeFormData() {
    return {
        title: titleInput.value.trim(),
        servings: Number(servingsInput.value),
        visibility: visibilityInput.value,
        ingredients: ingredientsInput.value.trim(),
        instructions: instructionsInput.value.trim()
    };
}


function validateRecipeForm(formData) {
    clearFormErrors();

    const errors = [];
    let firstInvalidField = null;

    function addError(field, message) {
        field.setAttribute("aria-invalid", "true");
        errors.push(message);

        if (firstInvalidField === null) {
            firstInvalidField = field;
        }
    }

    if (formData.title === "" || formData.title.length > 120) {
        addError(
            titleInput,
            "Enter a recipe name between 1 and 120 characters."
        );
    }

    if (
        !Number.isInteger(formData.servings) ||
        formData.servings < 1 ||
        formData.servings > 1000
    ) {
        addError(
            servingsInput,
            "Servings must be a whole number from 1 to 1000."
        );
    }

    if (formData.ingredients === "") {
        addError(ingredientsInput, "Enter the ingredients.");
    }

    if (formData.instructions === "") {
        addError(instructionsInput, "Enter the instructions.");
    }

    if (errors.length > 0) {
        formError.textContent = errors.join(" ");
        firstInvalidField.focus();
        return false;
    }

    return true;
}


/* ==================================================
   SAVE A NEW OR EDITED RECIPE
================================================== */

function submitRecipeForm(event) {
    event.preventDefault();

    const formData = getRecipeFormData();

    if (!validateRecipeForm(formData)) {
        return;
    }

    // Work on a copy so a failed save does not change existing data.
    const updatedRecipes = copyData(recipes);

    const isEditing = editingRecipeId !== null;

    if (isEditing) {
        const recipeToUpdate = updatedRecipes.find(function (recipe) {
            return recipe.id === editingRecipeId;
        });

        if (
            !recipeToUpdate ||
            recipeToUpdate.author !== CURRENT_AUTHOR
        ) {
            formError.textContent =
                "You can only edit your own recipes.";

            formError.focus();
            return;
        }

        // Preserve the recipe as it existed before this edit.
        if (recipeToUpdate.visibility === "public") {
            const previousRevision = {
                title: recipeToUpdate.title,
                servings: recipeToUpdate.servings,
                ingredients: recipeToUpdate.ingredients,
                instructions: recipeToUpdate.instructions,
                revision: recipeToUpdate.revision
            };

            recipeToUpdate.history.push(previousRevision);
        }

        recipeToUpdate.title = formData.title;
        recipeToUpdate.servings = formData.servings;
        recipeToUpdate.visibility = formData.visibility;
        recipeToUpdate.ingredients = formData.ingredients;
        recipeToUpdate.instructions = formData.instructions;

        recipeToUpdate.revision += 1;
    } else {
        const newRecipe = {
            id: "recipe-" + Date.now(),
            author: CURRENT_AUTHOR,
            title: formData.title,
            servings: formData.servings,
            visibility: formData.visibility,
            ingredients: formData.ingredients,
            instructions: formData.instructions,
            revision: 1,
            history: []
        };

        updatedRecipes.push(newRecipe);
    }

    if (!saveRecipes(updatedRecipes)) {
        return;
    }

    editingRecipeId = null;
    openRecipeList(true);

    if (isEditing) {
        showStatus("Your recipe changes were saved.");
    } else {
        showStatus("Your recipe was added to your collection.");
    }
}


function cancelRecipeForm() {
    editingRecipeId = null;

    openRecipeList(true);
    showStatus("Changes canceled. Nothing was saved.");
}


/* ==================================================
   DISPLAY RECIPE DETAILS
================================================== */

function openRecipeDetails(recipeId) {
    const selectedRecipe = recipes.find(function (recipe) {
        return recipe.id === recipeId;
    });

    if (!selectedRecipe || !canViewRecipe(selectedRecipe)) {
        showStatus("This recipe is not available.");
        return;
    }

    selectedRecipeId = recipeId;

    showStatus("");
    showSection(recipeDetailsSection, selectedRecipe.title);

    detailsSummary.textContent =
        selectedRecipe.servings + " servings | " +
        selectedRecipe.visibility + " | Revision " +
        selectedRecipe.revision;

    detailsIngredients.textContent = selectedRecipe.ingredients;
    detailsInstructions.textContent = selectedRecipe.instructions;

    editRecipeButton.hidden =
        selectedRecipe.author !== CURRENT_AUTHOR;

    displayRevisionHistory(selectedRecipe);
}


/* ==================================================
   DISPLAY PREVIOUS PUBLISHED REVISIONS
================================================== */

function displayRevisionHistory(recipe) {
    revisionHistory.replaceChildren();

    revisionHistorySection.hidden = recipe.history.length === 0;

    recipe.history.forEach(function (revision) {
        const revisionDetails = document.createElement("details");

        const summary = createTextElement(
            "summary",
            "Revision " + revision.revision + ": " + revision.title
        );

        const servings = createTextElement(
            "p",
            "Servings: " + revision.servings
        );

        const ingredientsHeading =
            createTextElement("h3", "Ingredients");

        const ingredients = createTextElement(
            "p",
            revision.ingredients,
            "multiline-text"
        );

        const instructionsHeading =
            createTextElement("h3", "Instructions");

        const instructions = createTextElement(
            "p",
            revision.instructions,
            "multiline-text"
        );

        revisionDetails.append(
            summary,
            servings,
            ingredientsHeading,
            ingredients,
            instructionsHeading,
            instructions
        );

        revisionHistory.appendChild(revisionDetails);
    });
}


/* ==================================================
   EVENT LISTENERS
================================================== */

document.getElementById("searchPageButton")
    .addEventListener("click", function () {
        openRecipeList(false);
    });


document.getElementById("myRecipesButton")
    .addEventListener("click", function () {
        openRecipeList(true);
    });


document.getElementById("addRecipeButton")
    .addEventListener("click", function () {
        openRecipeForm();
    });


document.getElementById("showAllButton")
    .addEventListener("click", function () {
        openRecipeList(showingMyRecipes);
    });


document.getElementById("cancelButton")
    .addEventListener("click", cancelRecipeForm);


document.getElementById("backButton")
    .addEventListener("click", function () {
        openRecipeList(showingMyRecipes);
    });


editRecipeButton.addEventListener("click", function () {
    openRecipeForm(selectedRecipeId);
});


searchForm.addEventListener("submit", searchRecipes);

recipeForm.addEventListener("submit", submitRecipeForm);


/* ==================================================
   INITIAL PAGE DISPLAY
================================================== */

displayRecipes();