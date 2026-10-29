-- Ensure RecipeVault database is set up and selected if not already.
create database if not exists RecipeVault;
use database RecipeVault;

-- This depends on AuthTable being set up.

-- This is for the recipe as a whole.
create table Recipes (
  RecipeId int AUTO_INCREMENT,
  UserId int not null comment 'User that owns this recipe',
  RecipeName varchar(32) not null,
  IsPublic boolean not null default false,
  LatestPublishedRevisionId int,
  LatestRevisionId int,
  foreign key (UserId) references AuthTable(UserID),
  primary key (RecipeId)
);

-- This is for a specific revision of a recipe.
create table RecipeData (
  RecipeId int,
  RecipeRevisionId int,
  NumServings tinyint not null,
  Instructions varchar(2048) not null,
  JsonBlob varchar(8192),
  foreign key (RecipeId) references Recipes(RecipeId),
  primary key (RecipeId, RecipeRevisionId)
);

-- Marks an individual ingredient.
-- Still deciding whether the ingredient name should be unique or not.
create table Ingredients (
  IngredientId int AUTO_INCREMENT,
  IngredientName varchar(128),
  primary key (IngredientId)
);

-- Mapping table for recipe revision -> ingredient
create table RecipeIngredients (
  RecipeId int,
  RecipeRevisionId int,
  IngredientId int,
  -- This is either in pieces of the ingredient, or in the noted unit of measure.
  IngredientCount decimal(10, 3) unsigned not null comment 'The amount of the ingredient used',
  -- Is null if it simply counts the number of pieces of something.
  -- Otherwise, it would be something like "teaspoon", "grams", "milliliters".
  IngredientUnit varchar(16) comment 'The unit of measure for this ingredient',

  foreign key (RecipeId) references RecipeData(RecipeId),
  foreign key (RecipeRevisionId) references RecipeData(RecipeRevisionId),
  foreign key (IngredientId) references Ingredients(IngredientId),
  primary key (RecipeId, RecipeRevisionId, IngredientId)
);

-- Build JSON
delimiter //
create procedure build_recipe_json(in recipe_id int, in recipe_revision_id int) begin
  declare ingredients_blob varchar(1024);
  declare json_blob varchar(8192);
  select JSON_ARRAYAGG(JSON_OBJECT('name', IngredientName,
                                   'count', IngredientCount,
                                   'unit', IngredientUnit))
    into ingredients_blob
    from RecipeIngredients natural join Ingredients
    where RecipeId = recipe_id and RecipeRevisionId = recipe_revision_id;
  select JSON_OBJECT('id', RecipeId,
                     'revision', RecipeRevisionId,
                     'authorId', UserId,
                     'title', RecipeName,
                     'servings', NumServings,
                     -- if(condition, trueval, falseval)
                     'visibility', if(IsPublic is true, 'public', 'private'),
                     'ingredients', ingredients_blob,
                     'instructions', Instructions
                     )
    into json_blob
    from Recipe natural join RecipeData
    where RecipeId = recipe_id and RecipeRevisionId = recipe_revision_id;
  update RecipeData
    set JsonBlob = json_blob
    where RecipeId = recipe_id and RecipeRevisionId = recipe_revision_id;
end
delimiter ;

-- Set up lookup user
-- Note: Please fill in the password (where it says FILL_ME_PLEASE), and use it for authentication in private/do-recipe-dbconn.php
create user if not exists serverrecipe@localhost identified by 'FILL_ME_PLEASE';

-- Allow viewing non-sensitive data about users present
grant select (UserId, EmailAddr) on RecipeVault.AuthTable to serverrecipe@localhost;
-- Recipes, RecipeData, Ingredients, RecipeIngredients
grant select, update, insert, delete on RecipeVault.Recipes to serverrecipe@localhost;
grant select, update, insert, delete on RecipeVault.RecipeData to serverrecipe@localhost;
grant select, update, insert, delete on RecipeVault.Ingredients to serverrecipe@localhost;
grant select, update, insert, delete on RecipeVault.RecipeIngredients to serverrecipe@localhost;
