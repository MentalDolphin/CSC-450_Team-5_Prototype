-- Set up auth user
-- Note: Please fill in the password (where it says FILL_ME_PLEASE), and use it for authentication in private/do-login-dbconn.php
create user serverauth@localhost identified by 'FILL_ME_PLEASE';

grant select, update, insert, delete on RecipeVault.AuthTable to serverauth@localhost;
grant execute on procedure RecipeVault.add_user to serverauth@localhost;
grant execute on procedure RecipeVault.check_pass to serverauth@localhost;
grant execute on function RecipeVault.lookup_user to serverauth@localhost;

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
-- Allows using the functions and procedures
grant execute on function RecipeVault.recipe_new_revision to serverrecipe@localhost;
grant execute on function RecipeVault.recipe_latest_revision to serverrecipe@localhost;
grant execute on function RecipeVault.ingredient_id to serverrecipe@localhost;
grant execute on function RecipeVault.lookup_user to serverrecipe@localhost;
grant execute on procedure RecipeVault.build_recipe_json to serverrecipe@localhost;
