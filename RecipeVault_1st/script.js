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

// This is used for converting units in JSON that is sent to server.
const unitMapToJson = new Map([
  ["", null],
  ["cup", "cup"],
  ["cups", "cup"],
  ["teaspoon", "tsp"],
  ["teaspoons", "tsp"],
  ["tablespoon", "tbsp"],
  ["tablespoons", "tbsp"],
  ["gram", "g"],
  ["grams", "g"],
]);

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
const recipeSort = document.getElementById("recipeSort");
const visibilityFilter = document.getElementById("visibilityFilter");
const servingsFilter = document.getElementById("servingsFilter");

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
let originalServings = 1;

let showingMyRecipes = false;

// Remember the submitted search when sorting or filtering its results.
let activeSearchTerm = "";
let activeIngredientTerms = [];

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
        // We also need to convert the key to an integer.
        return new Map(Object.entries(v).map((inval) => [Number(inval[0]), inval[1]]));
    } else {
        return v;
    }
}

function copyData(data) {
    return JSON.parse(JSON.stringify(data, jsonRecipeReplacer), jsonRecipeReviver);
}

/**
 * Validates data for recipe submission format.
 */
function validateRecipeSubmissionData(recipeData, hasId = false) {
    let is_valid = true;
    // The immediate descendants of the object
    let layer_1_is_valid = (hasId === true? Number.isInteger(recipeData.id) : true) &&
                           typeof recipeData.title === "string" &&
                           typeof recipeData.instructions === "string" &&
                           Array.isArray(recipeData.ingredients) &&
                           Number.isInteger(recipeData.servings) &&
                           recipeData.servings >= 1 &&
                           recipeData.servings <= 1000 &&
                           ["public", "private"].includes(recipeData.visibility);
    let layer_2_is_valid = true;
    if (layer_1_is_valid) {
        // The next layer down (just the ingredients list)
        recipeData.ingredients.forEach(function (ingrItem, ind, arr) {
            layer_2_is_valid = (layer_2_is_valid &&
                                typeof ingrItem.name === "string" &&
                                Number.isInteger(ingrItem.count) &&
                                (typeof ingrItem.unit === "string" ||
                                 ingrItem.unit === null));
        });
        if (!layer_2_is_valid) {
            is_valid = false;
        }
    } else {
        is_valid = false;
    }
    return is_valid;
}

/**
 * Validates stored format of recipe.
 */
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

        if (IS_ONLINE_MODE) {
            let didRevisionUpdate = await srvCheckForNewRecipeRevisions(savedRecipes);
            let needsToSave = false;
            if (didRevisionUpdate) {
                // We downloaded new revisions.
                needsToSave = true;
                console.log("Found later revisions of recipes, scheduling data save...");
            }
            let missingRecipeItems = await srvGetMissingRecipeIds(savedRecipes);
            if (missingRecipeItems.size > 0) {
                // There are missing recipes in the set
                let newRecipeData = await srvGetMissingRecipes(savedRecipes);
                console.log("Saving newly fetched recipes...");
                console.log(newRecipeData);
                saveRecipes(newRecipeData);
                return newRecipeData;
            } else {
                if (needsToSave) {
                    console.log("Saving updated recipe revisions...");
                    saveRecipes(savedRecipes);
                }
                return savedRecipes;
            }
        } else {
            return savedRecipes;
        }
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
        const response = await fetch("api/get-authdata/");
        if (!response.ok) {
            throw new Error(`API get-authdata returned error ${response.status}`);
        }
        // Will resolve to a JavaScript Object
        const result = await response.json();
        const savedMetadataStr = localStorage.getItem(STORAGE_META_KEY);
        const savedMetadata = JSON.parse(savedMetadataStr);
        if (Number.isInteger(result.uid)) {
            // Needed to check CURRENT_AUTHOR if not fully reloading sources.
            CURRENT_AUTHOR = result.uid;
        }
        if (savedMetadataStr === null) {
            localStorage.setItem(STORAGE_META_KEY, JSON.stringify(result));
        } else if (result.sessionIsValid === false) {
            // Refresh to pull up login page
            console.log("Credentials expired");
            location.replace("login");
        } else if (!savedMetadata.uid && result.email !== savedMetadata.email) {
            // If savedMetadata.uid is not saved, we use email to check for user change.
            console.log(`Saved email ${savedMetadata.email} is not the same as current user email ${result.email}, clearing storage.`);
            localStorage.clear();
        } else if (!savedMetadata.uid) {
            // We should write in the new UID field for our reference
            localStorage.setItem(STORAGE_META_KEY, JSON.stringify(result));
        } else if (result.uid !== savedMetadata.uid) {
            // UID should be present from this commit onwards in api/get-authdata.
            // We use it to check for user changes, to allow for email changes.
            console.log(`Saved email ${savedMetadata.uid} is not the same as current user email ${result.uid}, clearing storage.`);
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
        const response = await fetch("api/get-authdata/");
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
        const response = await fetch("api/get-available-recipes/");
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
        console.error("getSrvAvailRecipes: " + error.message);
    }
}

/**
 * Retrieve a given recipe (optionally for a specified revision) from server.
 * Room for improvement: Add a function to fetch multiple at a time.
 */
async function getSrvRecipe(recipeId, revision = null) {
    if (!Number.isInteger(recipeId)) {
        throw new Error(`getSrvRecipe: Parameter recipeId (value ${recipeId}) is not a number (type ${typeof recipeId})`);
    }
    if (revision !== null && !Number.isInteger(revision)) {
        throw new Error(`getSrvRecipe: Parameter revision (value ${revision}) must be null or number (type ${typeof revision}`);
    }
    let apiCallUrl = `api/get-recipe/?id=${recipeId}`;
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
        console.error(`getSrvRecipe (recipeId: ${recipeId}, rev.: ${revision}): ` + error.message);
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

    let apiCallUrl = `api/get-recipe-revisions/?id=${recipeId}`;
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
        console.error(`getSrvRecipeRevisions (recipeId: ${recipeId}): ` + error.message);
    }
}

/**
 * Submits a new recipe to the server.
 * It will send back its JSON representation of the recipe.
 */
async function srvCreateNewRecipe(recipeData) {
    let is_valid = validateRecipeSubmissionData(recipeData);
    // Send data to server
    if (!is_valid) {
        console.error("Recipe data failed validation");
        return;
    }
    const CNR_API_ENDPOINT = "api/create-new-recipe/";
    const cnrHeaders = new Headers();
    cnrHeaders.append("Content-Type", "application/json; charset=utf-8");
    const CNR_FETCH_OPTIONS = {
        method: "POST",
        headers: cnrHeaders,
        body: JSON.stringify(recipeData),
    };
    const response = await fetch(CNR_API_ENDPOINT, CNR_FETCH_OPTIONS);
    if (!response.ok) {
        let errBody = null;
        if (response.body) {
            errBody = await response.text();
        }
        throw new Error(`API create-new-recipe returned error ${response.status}, body: ${errBody}`);
    }
    const responseData = await response.json();
    return responseData;
}

/**
 * Submits a new revision of an existing recipe to the server.
 * It will send back its JSON representation of the new recipe revision.
 */
async function srvUpdateRecipe(recipeData) {
    let is_valid = validateRecipeSubmissionData(recipeData, true);
    // Send data to server
    if (!is_valid) {
        console.error("Recipe data failed validation");
        return;
    }
    const CNR_API_ENDPOINT = "api/update-recipe/";
    const cnrHeaders = new Headers();
    cnrHeaders.append("Content-Type", "application/json; charset=utf-8");
    const CNR_FETCH_OPTIONS = {
        method: "POST",
        headers: cnrHeaders,
        body: JSON.stringify(recipeData),
    };
    const response = await fetch(CNR_API_ENDPOINT, CNR_FETCH_OPTIONS);
    if (!response.ok) {
        let errBody = null;
        if (response.body) {
            errBody = await response.text();
        }
        throw new Error(`API update-recipe returned error ${response.status}, body: ${errBody}`);
    }
    const responseData = await response.json();
    return responseData;
}

/**
 * Fill in the public revisions for this recipe.
 */
async function fillRecipeRevisionsFromSrv(recipe) {
    let waitList = [];
    // Note: We only do this for the older public revisions
    let fillRevision = async function (revId) {
        // Get the revision
        const revData = await getSrvRecipe(recipe.id, revId);
        recipe.history.set(revId, revData);
    };
    if (recipe.availRevisions.pub) {
        recipe.availRevisions.pub.forEach(function (revId) {
            // Check if it is on the current revision, or if we filled it in already.
            if (revId !== recipe.revision && !recipe.history.has(revId)) {
                waitList.push(fillRevision(revId));
            }
        });
    }
    if (waitList.length > 0) {
        // Wait for all to finish
        await Promise.all(waitList);
        return true;
    } else {
        return false;
    }
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
    let outval = await Promise.all(serverRecipes);
    // Sort stored recipes by Recipe ID, for consistency with srvGetMissingRecipes()
    return outval.sort((a, b) => {return a.id - b.id;});
}

/**
 * Gets IDs of missing recipes. Fetches available recipes from server if needed.
 */
async function srvGetMissingRecipeIds(savedRecipes) {
    if (serverAvailRecipes === null) {
        serverAvailRecipes = await getSrvAvailRecipes();
    }
    // We convert to a set to enable easy comparisons.
    let serverAvailSet = new Set();
    let idReader = function (recDescObj, i, a) {
        serverAvailSet.add(recDescObj.id);
    };
    if (serverAvailRecipes.myRecipes) {
        serverAvailRecipes.myRecipes.forEach(idReader);
    }
    if (serverAvailRecipes.otherPublicRecipes) {
        serverAvailRecipes.otherPublicRecipes.forEach(idReader);
    }
//    Set(serverAvailRecipes.myRecipes.concat(serverAvailRecipes.otherPublicRecipes));
    let localSavedSet = new Set();
    savedRecipes.forEach(function (recDescObj, i, a) {
        // We are collecting the locally saved recipes.
        localSavedSet.add(recDescObj.id);
    });
    return serverAvailSet.difference(localSavedSet);
}

/**
 * A new function to be implemented:
 * It will check through serverAvailRecipes, check against the recipes list.
 * Compare revisions available. If server revision is newer, we will store the new revision (like updating a recipe, but with predetermined revision IDs), and save the old revision to history.
 * We also store the new version of availRevisions.
 *
 * Idea: Maybe we split submitRecipeForm into 2 functions, with one that stores the new revision, and a wrapper function handling form data.
 */
async function srvGetMissingRecipes(savedRecipes) {
    let fillRecipe = async function (recDescObj, index, arr) {
        let latestRecipeData = await getSrvRecipe(recDescObj.id);
        let recipeRevisionData = await getSrvRecipeRevisions(recDescObj.id);
        // Fill in the availRevisions and history fields
        latestRecipeData.availRevisions = recipeRevisionData;
        // We fill in the "history" field as-needed
        latestRecipeData.history = new Map();
        savedRecipes.push(latestRecipeData);
    };
    // Tracks progress of downloading recipes.
    let dlTracker = [];
    const recipesToFetch = await srvGetMissingRecipeIds(savedRecipes);
    recipesToFetch.forEach(function (recDescObj, k, s) {
        // We need to download the items for these given objects.
        console.log(`srvGetMissingRecipes: Downloading recipe ${recId}`);
        dlTracker.push(fillRecipe(recDescObj, k, s));
    });
    // Don't return until we are finished.
    if (dlTracker.length > 0) {
        await Promise.all(dlTracker);
        // Sort recipe list ascending by recipe ID
        savedRecipes.sort((a, b) => {return a.id - b.id;});
    }
    return savedRecipes;
}

/**
 * Updates a currently-stored recipe to the latest revision on the server.
 */
async function srvUpdateRecipeRevision(recipe) {
    const previousRevision = {
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        visibility: recipe.visibility,
        revision: recipe.revision
    };

    recipe.history.set(recipe.revision, previousRevision);

    const dataReturned = await getSrvRecipe(recipe.id);
    // Now fill in the new recipe.

    // Now we move it to the newly set recipe that got returned.
    recipe.title = dataReturned.title;
    recipe.servings = dataReturned.servings;
    recipe.visibility = dataReturned.visibility;
    recipe.ingredients = dataReturned.ingredients;
    recipe.instructions = dataReturned.instructions;
    recipe.revision = dataReturned.revision;
    // We need to refetch this data because making a revision public
    // causes previous revisions to go public.
    recipe.availRevisions = await getSrvRecipeRevisions(dataReturned.id);

}

/**
 * Checks for revision updates for the recipes
 */
async function srvCheckForNewRecipeRevisions(recipeSet) {
    if (serverAvailRecipes === null) {
        serverAvailRecipes = await getSrvAvailRecipes();
    }
    // Tracks downloads of new recipe revision updates.
    let dlTracker = [];
    let updateRecipe = async function (recipe) {
        await srvUpdateRecipeRevision(recipe);
    };
    // This should pull currently stored versions
    let recipeStoredRevisions = new Map(recipeSet.map((item) => [item.id, item.revision]));
    // Used to conveniently index the recipes.
    let recipeMapping = new Map(recipeSet.map((item) => [item.id, item]));
    // Stores revisions available on the server.
    let serverLatestRevisions = new Map();
    const fillServerRevisionMapping = function (recDescObj, i, a) {
        serverLatestRevisions.set(recDescObj.id, recDescObj.latestRevision);
    };
    if (serverAvailRecipes.myRecipes) {
        serverAvailRecipes.myRecipes.forEach(fillServerRevisionMapping);
    }
    if (serverAvailRecipes.otherPublicRecipes) {
        serverAvailRecipes.otherPublicRecipes.forEach(fillServerRevisionMapping);
    }
    recipeStoredRevisions.forEach(function (latestStoredRevId, recipeId, m) {
        if (serverLatestRevisions.get(recipeId) > latestStoredRevId) {
            // We need to pull a new revision
            dlTracker.push(updateRecipe(recipeMapping.get(recipeId)));
        }
    });
    if (dlTracker.length > 0) {
        await Promise.all(dlTracker);
        return true;
    } else {
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


function resetRecipeFilters() {
    recipeSort.value = "default";
    visibilityFilter.value = "all";
    servingsFilter.value = "all";
}

function refreshRecipeFilters() {
    // Controls can be used before the initial server request finishes.
    if (!Array.isArray(recipes)) {
        return;
    }
    displayRecipes(activeSearchTerm, activeIngredientTerms);
    showStatus(recipeCount.textContent);
}

function displayRecipes(searchTerm = "", ingredientTerms = []) {
    activeSearchTerm = searchTerm;
    activeIngredientTerms = [...ingredientTerms];
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

        const matchesVisibility = visibilityFilter.value === "all" ||
            recipe.visibility === visibilityFilter.value;

        let matchesServings = true;
        switch (servingsFilter.value) {
            case "1-2":
                matchesServings = recipe.servings >= 1 && recipe.servings <= 2;
                break;
            case "3-4":
                matchesServings = recipe.servings >= 3 && recipe.servings <= 4;
                break;
            case "5-plus":
                matchesServings = recipe.servings >= 5;
                break;
        }

        return accessible && belongsInCollection && matchesSearch &&
            matchesVisibility && matchesServings;
    });

    // Sort the filtered copy, leaving the stored recipe order unchanged.
    const compareNames = function (a, b) {
        return a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true });
    };
    switch (recipeSort.value) {
        case "title-asc":
            matchingRecipes.sort(compareNames);
            break;
        case "title-desc":
            matchingRecipes.sort(function (a, b) { return compareNames(b, a); });
            break;
        case "servings-asc":
            matchingRecipes.sort(function (a, b) {
                return a.servings - b.servings || compareNames(a, b);
            });
            break;
        case "servings-desc":
            matchingRecipes.sort(function (a, b) {
                return b.servings - a.servings || compareNames(a, b);
            });
            break;
    }

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
            "No matching recipes were found. Try changing your search or resetting the filters.",
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
            count: Number(row.querySelector(".ingredientAmount").value.trim()),
            unit: unitMapToJson.get(row.querySelector(".ingredientUnit").value.trim()),
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

async function submitRecipeForm(event) {
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

        // TODO: Push new revision to server here.
        if (IS_ONLINE_MODE) {
            // Push the data to server and wait for it to arrive.
            const dataReturned = await srvUpdateRecipe({
                id: recipeToUpdate.id,
                title: formData.title,
                servings: formData.servings,
                // Note for future improvement: This controls whether this
                // specific revision is published. We can possibly keep a given
                // revision private for a recipe which is already public by
                // marking that revision as private.
                visibility: formData.visibility,
                ingredients: formData.ingredients,
                instructions: formData.instructions,
            });
            // Now we move it to the newly set recipe that got returned.
            recipeToUpdate.title = dataReturned.title;
            recipeToUpdate.servings = dataReturned.servings;
            recipeToUpdate.visibility = dataReturned.visibility;
            recipeToUpdate.ingredients = dataReturned.ingredients;
            recipeToUpdate.instructions = dataReturned.instructions;
            recipeToUpdate.revision = dataReturned.revision;
            // We need to refetch this data because making a revision public
            // causes previous revisions to go public.
            recipeToUpdate.availRevisions = await getSrvRecipeRevisions(dataReturned.id);
        } else {
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
        }
    } else {
        let newRecipe = null;
        if (IS_ONLINE_MODE) {
            newRecipe = await srvCreateNewRecipe({
                title: formData.title,
                servings: formData.servings,
                visibility: formData.visibility,
                ingredients: formData.ingredients,
                instructions: formData.instructions,
            });
            // The server adds in the id, authorId, revision properties.
            // We need to add in availRevisions, and history.
            // This assumes server returns valid data.
            // Should we fetch from the server on a fresh recipe?
            newRecipe.availRevisions = {
                pub: (formData.visibility === "public")? [newRecipe.revision] : null,
                priv: (formData.visibility === "private")? [newRecipe.revision] : null
            };
            newRecipe.history = new Map();
        } else {
            newRecipe = {
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
        }
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
    originalServings = selectedRecipe.servings;

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

function setServing(button) {
    const selectedRecipe = recipes.find(function (recipe) {
        return recipe.id === selectedRecipeId;
    });

    if (!selectedRecipe) return;

    const multiplier = Number(button.dataset.multiplier);
    const adjustedServings = selectedRecipe.servings * multiplier;

    detailsSummary.textContent =
        adjustedServings + " servings | " +
        selectedRecipe.visibility + " | Revision " +
        selectedRecipe.revision;

    const adjustedIngredients = selectedRecipe.ingredients.map(
        function (ingredient) {
            return {
                ...ingredient,
                count: ingredient.count * multiplier
            };
        }
    );

    detailsIngredients.textContent =
        getIngredientString(adjustedIngredients);

    document.querySelectorAll("#servingControls button")
        .forEach(function (btn) {
            btn.classList.toggle(
                "secondary-button",
                btn !== button
            );
        });
}

/* ==================================================
   DISPLAY PREVIOUS PUBLISHED REVISIONS
================================================== */

/**
 * Fills in the revision history for a recipe.
 */
async function displayRevisionHistory(recipe) {
    revisionHistory.replaceChildren();

    revisionHistorySection.hidden = recipe.history.length === 0;

    // This should ensure all revisions are present.
    // It backfills older revisions.
    let filledNewRevisions = await fillRecipeRevisionsFromSrv(recipe);
    if (filledNewRevisions) {
        // We should save the new JSON if it already exists.
        if (localStorage.getItem(STORAGE_KEY) !== null) {
            // We already have locally-saved data.
            console.log(`New revisions downloaded for recipe ${recipe.id}, saving data`);
            saveRecipes(recipes);
        }
    }
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
        resetRecipeFilters();
        openRecipeList(showingMyRecipes);
    });

[recipeSort, visibilityFilter, servingsFilter].forEach(function (control) {
    control.addEventListener("change", refreshRecipeFilters);
});

document.getElementById("resetFiltersButton").addEventListener("click", function () {
    resetRecipeFilters();
    refreshRecipeFilters();
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
