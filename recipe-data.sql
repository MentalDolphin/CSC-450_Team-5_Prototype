-- Reset tables without dropping them
-- To reset tables, run: `truncate table TableName;` (requires drop privileges)

-- Acquire lock to avoid inconsistent table state
lock tables
  RecipeIngredients write,
  Ingredients write,
  RecipeData write,
  Recipes write;

-- I have to drop foreign-key constraints first.
alter table RecipeIngredients drop constraint ri_rd_id,
                              drop constraint ri_i_id;
alter table RecipeData drop constraint rd_r_id;
alter table Recipes drop constraint r_at_uid;

-- Clears data
truncate table RecipeIngredients;
truncate table Ingredients;
truncate table RecipeData;
truncate table Recipes;

-- Add back the foreign-key constraints
alter table RecipeIngredients
  add constraint ri_rd_id
    foreign key (RecipeId,
                 RecipeRevisionId) references RecipeData(RecipeId,
                                                         RecipeRevisionId),
  add constraint ri_i_id
    foreign key (IngredientId) references Ingredients(IngredientId);
alter table RecipeData
  add constraint rd_r_id
    foreign key (RecipeId) references Recipes(RecipeId);
alter table Recipes
  add constraint r_at_uid
    foreign key (UserId) references AuthTable(UserID);

unlock tables;

-- This is the test values. This format can be used to set up a server-side representation.
-- I am doing a single transaction to avoid inconsistent state.
start transaction;
insert into Recipes(UserId, RecipeName, IsPublic) values
  -- This assumes the test user is initialized at 1, can be modified to look it up directly.
  (lookup_user('johndoe@example.com'), 'Lemon Chicken', true);

-- Note: This returns the AUTO_INCREMENT value of the first row inserted above.
select last_insert_id() into @lcRecipeId;
select recipe_new_revision(@lcRecipeId) into @lcRecipeRevId;

insert into RecipeData(RecipeId, RecipeRevisionId, NumServings, Instructions) values
  (@lcRecipeId, @lcRecipeRevId, 4,
   'Heat the olive oil in a pan.\n'
   'Cook the chicken thoroughly.\n'
   'Add lemon juice before serving.');

-- This will ignore those that fail due to duplicates.
-- I am using the plural form of the name here.
insert ignore into Ingredients(IngredientName) values
  ('chicken breasts'),
  ('lemons'),
  ('olive oil');

insert into RecipeIngredients(RecipeId, RecipeRevisionId, IngredientId,
                              IngredientCount, IngredientUnit) values
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('chicken breasts'),
   2, null),
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('lemons'),
   1, null),
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('olive oil'),
   1, 'tbsp');

-- Build cached JSON data for this revision
call build_recipe_json(@lcRecipeId, @lcRecipeRevId);

-- Mark the latest revision
update Recipes
  set LatestPublishedRevisionId = @lcRecipeRevId
  where RecipeId = @lcRecipeId;
update Recipes
  set LatestRevisionId = @lcRecipeRevId
  where RecipeId = @lcRecipeId;

commit;

-- This is test recipe 2 (public recipe owned by second user).
start transaction;

insert into Recipes(UserId, RecipeName, IsPublic) values
  -- This assumes the test user is initialized at 1, can be modified to look it up directly.
  (lookup_user('janedoe@example.com'), 'Tomato Basil Pasta', true);

-- Note: This returns the AUTO_INCREMENT value of the first row inserted above.
select last_insert_id() into @lcRecipeId;
select recipe_new_revision(@lcRecipeId) into @lcRecipeRevId;

insert into RecipeData(RecipeId, RecipeRevisionId, NumServings, Instructions) values
  (@lcRecipeId, @lcRecipeRevId, 2,
   'Boil the pasta.\n'
   'Cook the tomatoes in a separate pan.\n'
   'Combine the pasta, tomatoes, and basil.');

-- This will ignore those that fail due to duplicates.
-- I am using the plural form of the name here.
insert ignore into Ingredients(IngredientName) values
  ('pasta'),
  ('tomatoes'),
  ('basil leaves');

insert into RecipeIngredients(RecipeId, RecipeRevisionId, IngredientId,
                              IngredientCount, IngredientUnit) values
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('pasta'),
   200, 'g'),
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('tomatoes'),
   2, null),
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('basil leaves'),
   6, null);

-- Build cached JSON data for this revision
call build_recipe_json(@lcRecipeId, @lcRecipeRevId);

-- Mark the latest revision
update Recipes
  set LatestPublishedRevisionId = @lcRecipeRevId
  where RecipeId = @lcRecipeId;
update Recipes
  set LatestRevisionId = @lcRecipeRevId
  where RecipeId = @lcRecipeId;

commit;

-- This is test recipe 3 (private recipe owned by test user 1)
start transaction;
insert into Recipes(UserId, RecipeName, IsPublic) values
  -- This assumes the test user is initialized at 1, can be modified to look it up directly.
  (lookup_user('johndoe@example.com'), 'Weekend Pancakes', false);

-- Note: This returns the AUTO_INCREMENT value of the first row inserted above.
select last_insert_id() into @lcRecipeId;
select recipe_new_revision(@lcRecipeId) into @lcRecipeRevId;

insert into RecipeData(RecipeId, RecipeRevisionId, NumServings, Instructions) values
  (@lcRecipeId, @lcRecipeRevId, 4,
   'Mix the ingredients.\n'
   'Pour small portions onto a warm skillet.\n'
   'Cook both sides until done.');

-- This will ignore those that fail due to duplicates.
-- I am using the plural form of the name here.
insert ignore into Ingredients(IngredientName) values
  ('flour'),
  ('milk'),
  ('eggs');

insert into RecipeIngredients(RecipeId, RecipeRevisionId, IngredientId,
                              IngredientCount, IngredientUnit) values
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('flour'),
   1, 'cup'),
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('milk'),
   1, 'cup'),
  (@lcRecipeId, @lcRecipeRevId,
   ingredient_id('eggs'),
   1, null);

-- Build cached JSON data for this revision
call build_recipe_json(@lcRecipeId, @lcRecipeRevId);

-- Mark the latest revision
-- No public revision marker because it is private
update Recipes
  set LatestRevisionId = @lcRecipeRevId
  where RecipeId = @lcRecipeId;

commit;
