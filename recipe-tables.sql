-- Ensure RecipeVault database is set up and selected if not already.
create database if not exists RecipeVault;
use RecipeVault;

-- This depends on AuthTable being set up.

-- This is for the recipe as a whole.
create table Recipes (
  RecipeId int AUTO_INCREMENT,
  UserId int not null comment 'User that owns this recipe',
  RecipeName varchar(32) not null,
  IsPublic boolean not null default false,
  LatestPublishedRevisionId int,
  LatestRevisionId int,
  constraint r_at_uid
    foreign key (UserId) references AuthTable(UserID),
  primary key (RecipeId)
);

-- This is for a specific revision of a recipe.
create table RecipeData (
  RecipeId int,
  RecipeRevisionId int,
  NumServings tinyint not null,
  Instructions varchar(2048) not null,
  JsonBlob varchar(8192) check(JSON_VALID(JsonBlob)),
  constraint rd_r_id
    foreign key (RecipeId) references Recipes(RecipeId),
  primary key (RecipeId, RecipeRevisionId)
);

-- Marks an individual ingredient.
-- Still deciding whether the ingredient name should be unique or not.
create table Ingredients (
  IngredientId int AUTO_INCREMENT,
  IngredientName varchar(128) unique,
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

  constraint ri_rd_id
    foreign key (RecipeId,
                 RecipeRevisionId) references RecipeData(RecipeId,
                                                         RecipeRevisionId),
  constraint ri_i_id
    foreign key (IngredientId) references Ingredients(IngredientId),
  primary key (RecipeId, RecipeRevisionId, IngredientId)
);

-- Procedures and functions

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
                     -- Gets a JSON type for full array.
                     'ingredients', JSON_QUERY(ingredients_blob, '$'),
                     'instructions', Instructions
                     )
    into json_blob
    from Recipes natural join RecipeData
    where RecipeId = recipe_id and RecipeRevisionId = recipe_revision_id;
  set json_blob = JSON_COMPACT(json_blob);
  update RecipeData
    set JsonBlob = json_blob
    where RecipeId = recipe_id and RecipeRevisionId = recipe_revision_id;
end //
delimiter ;

-- Recipe revision ID selector
delimiter //
create function recipe_latest_revision(recipe_id int) returns int not deterministic begin
  declare outval int;
  select max(RecipeRevisionId)
    into outval
    from RecipeData
    where RecipeId = recipe_id;
  if outval is null then
    return 0;
  else
    return outval;
  end if;
end //
delimiter ;

delimiter //
create function recipe_new_revision(recipe_id int) returns int not deterministic begin
  declare outval int;
  select max(RecipeRevisionId)
    into outval
    from RecipeData
    where RecipeId = recipe_id;
  if outval is null then
    return 1;
  else
    set outval = outval + 1;
    return outval;
  end if;
end //
delimiter ;

delimiter //
create function ingredient_id(ingredient_name varchar(128)) returns int not deterministic begin
  declare outval int;
  select IngredientId
    into outval
    from Ingredients
    where IngredientName = ingredient_name;
  return outval;
end //
delimiter ;
