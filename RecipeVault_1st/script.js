"use strict";

/* ==================================================
   SETTINGS AND SAMPLE DATA
================================================== */

// This is a demo identity, not a real login system.
let CURRENT_AUTHOR = 1;

const RECIPE_API = "api/";
const URL_PARAMS = new URLSearchParams(location.search);

let IS_ONLINE_MODE = false;
if (URL_PARAMS.get("sync") == 1) {
    IS_ONLINE_MODE = true;
}

const STORAGE_KEY = "recipevault-readable-v1";
const STORAGE_META_KEY = "recipevault-readable-meta-v1";

const sampleRecipes = [
    {
        id: 1,
        authorId: CURRENT_AUTHOR,
        title: "Lemon Chicken",
        servings: 4,
        visibility: "public",
        ingredients: [
            { name: "chicken breasts", count: 2, unit: null },
            { name: "lemon", count: 1, unit: null },
            { name: "olive oil", count: 1, unit: "tbsp" }
        ],
        instructions:
            "Heat the olive oil in a pan.\n" +
            "Cook the chicken thoroughly.\n" +
            "Add lemon juice before serving.",
        revision: 1,
        availRevisions: {
            pub: [1],
            priv: null
        },
        history: new Map()
    },

    {
        id: 2,
        authorId: 2,
        title: "Tomato Basil Pasta",
        servings: 2,
        visibility: "public",
        ingredients: [
            { name: "pasta", count: "200", unit: "g" },
            { name: "tomatoes", count: "1", unit: null },
            { name: "basil leaves", count: "6", unit: null }
        ],
        instructions:
            "Boil the pasta.\n" +
            "Cook the tomatoes in a separate pan.\n" +
            "Combine the pasta, tomatoes, and basil.",
        revision: 1,
        availRevisions: {
            pub: [1],
            priv: null
        },
        history: new Map()
    },

    {
        id: 3,
        authorId: CURRENT_AUTHOR,
        title: "Weekend Pancakes",
        servings: 4,
        visibility: "private",
        ingredients: [
            { name: "flour", count: "1", unit: "cup" },
            { name: "milk", count: "1", unit: "cup" },
            { name: "egg", count: "1", unit: null }
        ],
        instructions:
            "Mix the ingredients.\n" +
            "Pour small portions onto a warm skillet.\n" +
            "Cook both sides until done.",
        revision: 1,
        availRevisions: {
            pub: null,
            priv: [1]
        },
        history: new Map()
    },

    {
        id: 4,
        authorId: CURRENT_AUTHOR,
        title: "Lentil Stew",
        servings: 4,
        visibility: "private",
        ingredients: [
            { name: "lentils", count: "2", unit: "cup" },
            { name: "vegetable stock", count: "2", unit: "cup" },
            { name: "tomato paste", count: "1", unit: "tbsp" }
        ],
        instructions:
            "Brown tomato paste in a pot.\n" +
            "Add remaining ingredients.\n" +
            "Let simmer for 30 minutes.",
        revision: 1,
        availRevisions: {
            pub: null,
            priv: [1]
        },
        history: new Map()
    }
];

/* ==================================================
   MAPPINGS
================================================== */
// This allows accounting for different variations within the JSON unit field
// Here, we can map them to what is displayed.
const unitMapToDisplay = new Map([
  [null, ""],
  ["", ""],
  ["cup", "cups"],
  ["cups", "cups"],
  ["tsp", "teaspoons"],
  ["teaspoon", "teaspoons"],
  ["teaspoons", "teaspoons"],
  ["tbsp", "tablespoons"],
  ["tablespoon", "tablespoons"],
  ["tablespoons", "tablespoons"],
  ["g", "grams"],
  ["gram", "grams"],
  ["grams", "grams"],
]);

const unitDisplayList = new Set(unitMapToDisplay.values());

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

const advancedSearchButton = document.getElementById("advancedSearchButton");
const advancedSearchPanel = document.getElementById("advancedSearchPanel");
const advancedSearchForm = document.getElementById("advancedSearchForm");
const advancedIngredients = document.getElementById("advancedIngredients");
const advancedSearchError = document.getElementById("advancedSearchError");

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

// Marker of what recipes to fetch
let serverAvailRecipes = null;

// Work around Promises.
// This is set in the initialization function.
let recipes = null;

// This is the ID of the next recipe to be added.
let ingredientCounter = 1;

// This is used to mark when we need to check for authentication.
let needsCheckAuth = false;
let checkAuthTimer = null;

/* ==================================================
   STORAGE FUNCTIONS
================================================== */

/**
 * Needed to convert a Map to an Object
 * This runs when using JSON.stringify(obj, replacer)
 */
function jsonRecipeReplacer(k, v) {
    if (v instanceof Map) {
        // Convert Map to Object
        return Object.fromEntries(v);
    } else {
        return v;
    }
}

/**
 * Converts history property back to a Map.
 * This runs when using JSON.parse(obj, reviver)
 */
function jsonRecipeReviver(k, v, context) {
    if (k === "history" && typeof(v) === "object") {
        // We need to convert it to a Map.
        return new Map(Object.entries(v));
    } else {
        return v;
    }
}

function copyData(data) {
    return JSON.parse(JSON.stringify(data, jsonRecipeReplacer), jsonRecipeReviver);
}


function isValidStoredRecipe(recipe) {
    if (recipe === null || typeof recipe !== "object") {
        return false;
    }

    return (
        typeof recipe.id === "number" &&
        typeof recipe.authorId === "number" &&
        typeof recipe.title === "string" &&
        typeof recipe.instructions === "string" &&
        Number.isInteger(recipe.servings) &&
        recipe.servings >= 1 &&
        recipe.servings <= 1000 &&
        Number.isInteger(recipe.revision) &&
        recipe.revision >= 1 &&
        ["public", "private"].includes(recipe.visibility) &&
        (Array.isArray(recipe.availRevisions.pub) ||
         (recipe.availRevisions.pub === null)) &&
        (Array.isArray(recipe.availRevisions.priv) ||
         (recipe.availRevisions.priv === null)) &&
        recipe.history instanceof Map
    );
}

/**
 * Loads recipes. I am forced to use async because of fetch() being async.
 * It's either this or I have to essentially busy-wait.
 * At least I can contain it, since it is only used in initialization.
 */
async function loadRecipes() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData === null) {
            if (IS_ONLINE_MODE) {
                console.log("We are in server-sync mode, test by retrieving from server.");
                return await getSrvRecipeStore();
            } else {
                return copyData(sampleRecipes);
            }
        }

        const savedRecipes = JSON.parse(savedData, jsonRecipeReviver);

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
        const recipeData = JSON.stringify(updatedRecipes, jsonRecipeReplacer);

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
   SERVER SYNC FUNCTIONS
================================================== */

function setTimer(tFunc, tTimeout) {
    return {func: tFunc,
            timeout: tTimeout,
            timer: setTimeout(tFunc, tTimeout)};
}

function resetTimer(timerObj) {
    let tFunc = timerObj.func;
    let tTimeout = timerObj.timeout;
    clearTimeout(timerObj.timer);
    return {func: tFunc,
            timeout: tTimeout,
            timer: setTimeout(tFunc, tTimeout)};
}

/**
 * Fetches and checks authentication data. This makes sure we don't clobber another user's data.
 */
async function checkAuthData() {
    try {
        const response = await fetch("api/get-authdata");
        if (!response.ok) {
            throw new Error(`API get-authdata returned error ${response.status}`);
        }
        // Will resolve to a JavaScript Object
        const result = await response.json();
        const savedMetadataStr = localStorage.getItem(STORAGE_META_KEY);
        const savedMetadata = JSON.parse(savedMetadataStr);
        if (savedMetadataStr === null) {
            localStorage.setItem(STORAGE_META_KEY, JSON.stringify(result));
        } else if (result.sessionIsValid === false) {
            // Refresh to pull up login page
            console.log("Credentials expired");
            location.replace("login");
        } else if (result.email !== savedMetadata.email) {
            console.log(`Saved email ${savedMetadata.email} is not the same as current user email ${result.email}, clearing storage.`);
            localStorage.clear();
        }
    } catch (error) {
        console.log(error.message);
    }
}

/**
 * Simpler version of above function: Only checks for expired credentials.
 */
async function userIsAuthenticated() {
    try {
        const response = await fetch("api/get-authdata");
        if (!response.ok) {
            throw new Error(`API get-authdata returned error ${response.status}`);
        }
        // Will resolve to a JavaScript Object
        const result = await response.json();
        return result.sessionIsValid;
    } catch (error) {
        console.log(error.message);
    }
}

/**
 * Gets the list of recipes, ours and not ours, from the server.
 * Used to know which recipes to sync.
 */
async function getSrvAvailRecipes() {
    try {
        // Download new data
        const response = await fetch("api/get-available-recipes");
        if (response.status === 403) {
            console.log("getSrvAvailRecipes: Session expired");
        } else if (!response.ok) {
            throw new Error(`API get-available-recipes returned error ${response.status}`);
        }
        // Resolves to JavaScript Object
        /* The specification is:
         * {"myRecipes":
         *    null | [
         *      {
         *        "id": int,
         *        "latestRevision": int,
         *        "latestPublicRevision": int,
         *        "visibility": "public" | "private",
         *        "authorId": int,
         *        "isMine": bool
         *      }...
         *    ],
         *  "otherPublicRecipes":
         *    null | [
         *      {
         *        "id": int,
         *        "latestRevision": int,
         *        "latestPublicRevision": int,
         *        "visibility": "public",
         *        "authorId": int,
         *        "isMine": bool
         *      }...
         *    ]
         * }
         */
        const result = await response.json();
        return result;
    } catch (error) {
        console.log("getSrvAvailRecipes: " + error.message);
    }
}

/**
 * Retrieve a given recipe (optionally for a specified revision) from server.
 */
async function getSrvRecipe(recipeId, revision = null) {
    if (!Number.isInteger(recipeId)) {
        throw new Error(`getSrvRecipe: Parameter recipeId (value ${recipeId}) is not a number (type ${typeof recipeId})`);
    }
    if (revision !== null && !Number.isInteger(revision)) {
        throw new Error(`getSrvRecipe: Parameter revision (value ${revision}) must be null or number (type ${typeof revision}`);
    }
    let apiCallUrl = `api/get-recipe?id=${recipeId}`;
    if (revision !== null) {
        apiCallUrl += `&revid=${revision}`;
    }
    try {
        const response = await fetch(apiCallUrl);
        if (response.status === 403) {
            console.log("getSrvRecipe: Session expired");
            return;
        } else if (!response.ok) {
            throw new Error(`API get-recipe returned error ${response.status}`);
        }
        // Resolves to JSON
        const result = await response.json();
        return result;
    } catch (error) {
        console.log(`getSrvRecipe (recipeId: ${recipeId}, rev.: ${revision}): ` + error.message);
    }
}

/**
 * Gets available revisions for a given recipe.
 * This reformats the JSON to fit our object storage notation.
 */
async function getSrvRecipeRevisions(recipeId) {
    if (!Number.isInteger(recipeId)) {
        throw new Error(`getSrvRecipe: Parameter recipeId (value ${recipeId}) is not a number (type ${typeof recipeId})`);
    }

    let apiCallUrl = `api/get-recipe-revisions?id=${recipeId}`;
    try {
        const response = await fetch(apiCallUrl);
        if (response.status === 403) {
            console.log("getSrvRecipeRevisions: Session expired");
            return;
        } else if (!response.ok) {
            throw new Error(`API get-recipe-revisions returned error ${response.status}`);
        }
        const result = await response.json();
        return {pub: result.publicRevisions,
                priv: result.privateRevisions};
    } catch (error) {
        console.log(`getSrvRecipeRevisions (recipeId: ${recipeId}): ` + error.message);
    }
}

/**
 * Fill in the public revisions for this recipe.
 * TODO: Actually use this.
 */
function fillRecipeRevisionsFromSrv(recipe) {
    // Note: We only do this for the older public revisions
    recipe.availRevisions.myRecipes.forEach(async function (revId) {
        // Check if it is on the current revision
        if (revId !== recipe.revision) {
            // Get the revision
            const revData = await getSrvRecipe(recipe.id, revId);
            recipe.history.set(revId, revData);
        }
    });
}

/**
 * Loads the recipes from the server
 * Currently, this will load in **all** revisions as new.
 * TODO: Implement updating to a new revision, based on difference between
 * saved and available revisions.
 */
async function getSrvRecipeStore() {
    if (needsCheckAuth) {
        if (!await userIsAuthenticated()) {
            console.log("getSrvRecipeStore: Session expired");
            return;
        }
        resetTimer(checkAuthTimer);
    }
    serverAvailRecipes = await getSrvAvailRecipes();
//    console.log("getSrvAvailRecipes");
    CURRENT_AUTHOR = serverAvailRecipes.myRecipes.at(0).authorId;
//    let syncManager = new Int32Array(new SharedArrayBuffer(8));
    let serverRecipes = [];

    // Used for filling in the recipe data.
    let fillRecipe = async function (recDescObj, index, arr) {
        let latestRecipeData = await getSrvRecipe(recDescObj.id);
        let recipeRevisionData = await getSrvRecipeRevisions(recDescObj.id);
        // Fill in the availRevisions and history fields
        latestRecipeData.availRevisions = recipeRevisionData;
        // We fill in the "history" field as-needed
        latestRecipeData.history = new Map();
        return latestRecipeData;
    };


    // I am using this
//    console.log("getSrvRecipeStore");
//    console.log(`Avail Recipes: ${JSON.stringify(serverAvailRecipes)}`);
//    console.log(`CURRENT_AUTHOR = ${CURRENT_AUTHOR}`);
    let numRecipes = serverAvailRecipes.myRecipes.length + serverAvailRecipes.otherPublicRecipes.length;
    serverAvailRecipes.myRecipes.forEach(function (recDescObj, i, a) {
        if (recDescObj.authorId !== CURRENT_AUTHOR) {
            console.log(`getSrvRecipeStore: cur. author ID ${CURRENT_AUTHOR} does not match recipe ${recDescObj.id} (where it is ${recDescObj.authorId})`);
        }
        // This resolves to the filled-out recipe.
        serverRecipes.push(fillRecipe(recDescObj, i, a));
    });
    // Now do this for private recipes
    serverAvailRecipes.otherPublicRecipes.forEach(function (recDescObj, i, a) {
        // This resolves to the filled-out recipe.
        serverRecipes.push(fillRecipe(recDescObj, i, a));
    });
    return await Promise.all(serverRecipes);
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
        recipe.authorId === CURRENT_AUTHOR
    );
}


/* ==================================================
   RECIPE LIST AND SEARCH
================================================== */

function openRecipeList(onlyMyRecipes = false) {
    showingMyRecipes = onlyMyRecipes;

    resetAdvancedSearch();
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


function displayRecipes(searchTerm = "", ingredientTerms = []) {
    recipeCards.replaceChildren();

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matchingRecipes = recipes.filter(function (recipe) {
        const accessible = canViewRecipe(recipe);

        const belongsInCollection =
            !showingMyRecipes ||
            recipe.authorId === CURRENT_AUTHOR;

        const matchesName =
            recipe.title.toLowerCase().includes(normalizedSearch);

        // Search the ingredient list as well as the recipe name.
        const matchesIngredient =
            recipe.ingredients.some(function (ingredient) {
                return ingredient.name.toLowerCase().includes(normalizedSearch);
            });

        // Literal string comparison only: no HTML, SQL, eval, or user-built regex.
        const matchesSearch = ingredientTerms.length > 0
            ? ingredientTerms.every(function (term) {
                return recipe.ingredients.some(function (ingredient) {
                    return ingredient.name.toLowerCase().includes(
                        term.toLowerCase()
                    );
                });
            })
            : matchesName || matchesIngredient;

        return accessible && belongsInCollection && matchesSearch;
    });

    if (ingredientTerms.length > 0) {
        resultsHeading.textContent = "Recipes containing all: " + ingredientTerms.join(", ");
    } else if (searchTerm !== "") {
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
    if (recipe.authorId === CURRENT_AUTHOR) {
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
        searchError.textContent = "Please enter a recipe name or an ingredient.";
        searchInput.setAttribute("aria-invalid", "true");
        searchInput.focus();
        return;
    }

    searchError.textContent = "";
    searchInput.removeAttribute("aria-invalid");

    resetAdvancedSearch();
    displayRecipes(searchTerm);
    showStatus(recipeCount.textContent);
}


/* ==================================================
   ADVANCED INGREDIENT SEARCH
================================================== */

function parseIngredientSearch(value) {
    // Bounds are checked in JavaScript as well as HTML. Validation improves
    // input quality; safe DOM rendering is the actual XSS protection.
    if (typeof value !== "string" || value.length > 1000) {
        throw new Error("Enter no more than 1,000 characters.");
    }

    const terms = value.split(/[,\r\n]+/)
        .map(function (term) { return term.trim().replace(/\s+/g, " ").toLowerCase(); })
        .filter(function (term) { return term !== ""; });

    if (terms.length === 0) {
        throw new Error("Enter at least one ingredient.");
    }
    if (terms.length > 20) {
        throw new Error("Enter no more than 20 ingredients.");
    }
    if (terms.some(function (term) { return term.length > 60; })) {
        throw new Error("Each ingredient must be 60 characters or fewer.");
    }

    // Accept letters, numbers, spaces and common ingredient punctuation.
    // Apostrophes remain valid (e.g. baker's yeast); SQL keyword blacklists
    // are not a substitute for parameterized queries in a future backend.
    if (terms.some(function (term) {
        return !/^[\p{L}\p{M}\p{N} '\u2019().%/\-]+$/u.test(term) ||
            !/[\p{L}\p{N}]/u.test(term);
    })) {
        throw new Error("Use ingredient names with letters, numbers, spaces, or common punctuation (apostrophes, hyphens, parentheses, periods, % and /).");
    }

    return [...new Set(terms)];
}

function resetAdvancedSearch() {
    advancedIngredients.value = "";
    advancedIngredients.removeAttribute("aria-invalid");
    advancedSearchError.textContent = "";
    advancedSearchPanel.hidden = true;
    advancedSearchButton.setAttribute("aria-expanded", "false");
}

function searchByIngredients(event) {
    event.preventDefault();
    let terms;
    try {
        terms = parseIngredientSearch(advancedIngredients.value);
    } catch (error) {
        advancedSearchError.textContent = error.message;
        advancedIngredients.setAttribute("aria-invalid", "true");
        advancedIngredients.focus();
        return;
    }

    advancedSearchError.textContent = "";
    advancedIngredients.removeAttribute("aria-invalid");
    searchInput.value = "";
    searchError.textContent = "";
    searchInput.removeAttribute("aria-invalid");
    displayRecipes("", terms);
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
            recipeToEdit.authorId !== CURRENT_AUTHOR
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
        populateIngredientRows([
            {
                count: "1",
                unit: "cups",
                name: ""
            }
        ]);
        saveRecipeButton.textContent = "Save Recipe";

        revisionMessage.textContent =
            "Private recipes appear only in your own collection.";

        showSection(recipeFormSection, "Add a Recipe");
    } else {
        titleInput.value = recipeToEdit.title;
        servingsInput.value = recipeToEdit.servings;
        visibilityInput.value = recipeToEdit.visibility;
        populateIngredientRows(recipeToEdit.ingredients);
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

function populateIngredientRows(ingredients) {
    // Remove existing ingredient rows.
    ingredientsInput.replaceChildren();

    ingredientCounter = 0;
    ingredients.forEach(function (ingredient) {
        // Pass ingredient counter, then increment it.
        const row = addIngredientRow(ingredientCounter++);

        row.querySelector(".ingredientAmount").value =
            ingredient.count;

        row.querySelector(".ingredientUnit").value =
            unitMapToDisplay.get(ingredient.unit);

        row.querySelector(".ingredientName").value =
            ingredient.name;

        ingredientsInput.appendChild(row);
    });
}


/* ==================================================
   READ AND VALIDATE FORM INPUT
================================================== */

function getRecipeFormData() {
    const ingredientRows = document.querySelectorAll(".ingredient-row");
    const ingredientsArray = Array.from(ingredientRows).map(function (row) {
        return {
            count: row.querySelector(".ingredientAmount").value.trim(),
            unit: row.querySelector(".ingredientUnit").value.trim(),
            name: row.querySelector(".ingredientName").value.trim()
        }
    })

    return {
        title: titleInput.value.trim(),
        servings: Number(servingsInput.value),
        visibility: visibilityInput.value,
        ingredients: ingredientsArray,
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
            recipeToUpdate.authorId !== CURRENT_AUTHOR
        ) {
            formError.textContent =
                "You can only edit your own recipes.";

            formError.focus();
            return;
        }

        // Preserve the recipe as it existed before this edit.
        const previousRevision = {
            title: recipeToUpdate.title,
            servings: recipeToUpdate.servings,
            ingredients: recipeToUpdate.ingredients,
            instructions: recipeToUpdate.instructions,
            visibility: recipeToUpdate.visibility,
            revision: recipeToUpdate.revision
        };

        recipeToUpdate.history.set(recipeToUpdate.revision, previousRevision);

        recipeToUpdate.title = formData.title;
        recipeToUpdate.servings = formData.servings;
        recipeToUpdate.visibility = formData.visibility;
        recipeToUpdate.ingredients = formData.ingredients;
        recipeToUpdate.instructions = formData.instructions;

        recipeToUpdate.revision += 1;
        if (recipeToUpdate.visibility === 'public') {
            recipeToUpdate.availRevisions.pub.push(recipeToUpdate.revision);
        } else {
            recipeToUpdate.availRevisions.priv.push(recipeToUpdate.revision);
        }
    } else {
        const newRecipe = {
            // We need an integer ID here.
            id: Math.floor(Math.random() * 65535),
            authorId: CURRENT_AUTHOR,
            title: formData.title,
            servings: formData.servings,
            visibility: formData.visibility,
            ingredients: formData.ingredients,
            instructions: formData.instructions,
            revision: 1,
            availRevisions: {
                pub: (formData.visibility === "public")? [1] : null,
                priv: (formData.visibility === "private")? [1] : null
            },
            history: new Map()
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

/**
 * Adds a new ingredient row
 */
function addIngredientRow(ingredientId) {
    // Create ingredient row
    const div = document.createElement("div");
    div.className = "ingredient-row";
    // Autocast to string, input is integer
    div.id = "igr" + ingredientId;

    // Amount input
    const amount = document.createElement("input");
    amount.className = "ingredientAmount";
    amount.type = "number";
    amount.min = "1";
    amount.max = "1000";
    amount.step = "1";
    amount.value = "1";
    amount.setAttribute("aria-describedby", "formError");
    amount.required = true;

    // Unit select
    const select = document.createElement("select");
    select.className = "ingredientUnit";
    unitDisplayList.forEach(unit => {
        const option = document.createElement("option");
        option.value = unit;
        option.textContent = unit;
        select.appendChild(option);
    });

    // Ingredient name input
    const name = document.createElement("input");
    name.className = "ingredientName";
    name.type = "text";
    name.maxLength = 60;
    name.setAttribute("aria-describedby", "formError");
    name.required = true;

    // Append elements to div
    div.appendChild(amount);
    div.appendChild(select);
    div.appendChild(name);

    // To remove the item
    if (ingredientId > 0) {
        const removalButton = document.createElement("button");
        removalButton.className = "secondary-button";
        removalButton.type = "button";
        removalButton.innerHTML = "\u00D7";
        removalButton.setAttribute("onclick", `removeIngredient(${ingredientId})`);
        div.appendChild(removalButton);
    }

    // Append div to recipeIngredients
    return div;
}

/**
 * Removes a specific ingredient row (the top one can't be removed).
 */
function removeIngredient(ingredientId) {
    document.getElementById("igr" + ingredientId).remove();
}

/**
 * Adds a new ingredient row to the form (for the button)
 */
function addIngredient() {
    document.getElementById("recipeIngredients").appendChild(
        addIngredientRow(ingredientCounter++)
    );
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

    detailsIngredients.textContent = getIngredientString(selectedRecipe.ingredients);
    detailsInstructions.textContent = selectedRecipe.instructions;

    editRecipeButton.hidden =
        selectedRecipe.authorId !== CURRENT_AUTHOR;

    displayRevisionHistory(selectedRecipe);
}

function getIngredientString(ingredients) {
    const ingredientsString = ingredients.map(function (ingredient) {
        return ingredient.count + " " +
            // True if non-null
            ((!!ingredient.unit)? (unitMapToDisplay.get(ingredient.unit) + " ") : "") +
            ingredient.name;
    }).join("\n");
    return ingredientsString;
} 

/* ==================================================
   DISPLAY PREVIOUS PUBLISHED REVISIONS
================================================== */

function displayRevisionHistory(recipe) {
    revisionHistory.replaceChildren();

    revisionHistorySection.hidden = recipe.history.length === 0;

    // FIXME: Change this to ensure all revisions are present.
    // Do we need async here?
    recipe.history.forEach(function (revision, revId, revMap) {
        if (revision.visibility === "private") {
            // This only displays public revisions.
            return;
        }
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
            getIngredientString(revision.ingredients),
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


advancedSearchButton.addEventListener("click", function () {
    advancedSearchPanel.hidden = !advancedSearchPanel.hidden;
    advancedSearchButton.setAttribute("aria-expanded", String(!advancedSearchPanel.hidden));
    if (!advancedSearchPanel.hidden) {
        advancedIngredients.focus();
    }
});

advancedSearchForm.addEventListener("submit", searchByIngredients);
document.getElementById("clearAdvancedSearchButton").addEventListener("click", function () {
    openRecipeList(showingMyRecipes);
    advancedSearchButton.focus();
});

// Direct clicks also work in previews that disable native form submission.
document.getElementById("basicSearchButton").addEventListener("click", searchRecipes);
document.getElementById("searchIngredientsButton").addEventListener("click", searchByIngredients);
searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        searchRecipes(event);
    }
});
searchForm.addEventListener("submit", searchRecipes);

recipeForm.addEventListener("submit", submitRecipeForm);


/* ==================================================
   INITIAL PAGE DISPLAY
================================================== */

async function initializeProgram() {
    // Wait for authentication data before continuing.
    await checkAuthData();
    // Risk of causing a hang here, so this should be capped out.
    recipes = await loadRecipes().catch(loadRecipes);
    displayRecipes();
    checkAuthTimer = setTimer(() => {needsCheckAuth = true;}, 60000 * 30);
}

initializeProgram();
