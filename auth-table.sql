-- Ensure RecipeVault database is set up and selected if not already.
create database if not exists RecipeVault;
use database RecipeVault;

-- This holds user authentication data.

create table AuthTable (
  UserId int AUTO_INCREMENT,
  EmailAddr varchar(128) not null unique comment 'User email',
  PassHash blob(128) not null comment 'User password hash',
  Salt blob(16) not null comment 'Salt for password hash',
  HashVer tinyint default 1 not null comment 'Specifies hash version in event of future modifications',
  primary key (UserId)
);

-- This is procedure for setting up an email

select random_bytes(16) into @salt;
insert into AuthTable(EmailAddr, PassHash, Salt) values
  ('johndoe@example.com', kdf('Password01', @salt), @salt)
;


-- Password check procedure
delimiter //
create procedure check_pass(in email_addr varchar(128),
                            in password varchar(128),
                            out user_id int) begin
  declare salt type of AuthTable.Salt;
  select Salt
    into salt
    from AuthTable
    where EmailAddr = email_addr;
  select UserId
    into user_id
    from AuthTable
    where EmailAddr = email_addr and
          PassHash = kdf(password, salt);
end //
delimiter ;

-- Add user procedure
delimiter //
create procedure add_user(in email_addr varchar(128),
                          in password varchar(128)) begin
  declare salt type of AuthTable.Salt;
  select random_bytes(16) into salt;
  insert into AuthTable(EmailAddr, PassHash, Salt) values
    (email_addr, kdf(password, salt), salt);
end //
delimiter ;

-- Set up auth user
-- Note: Please fill in the password (where it says FILL_ME_PLEASE), and use it for authentication in private/do-login-dbconn.php
create user serverauth@localhost identified by 'FILL_ME_PLEASE';

grant select, update, insert, delete on RecipeVault.AuthTable to serverauth@localhost;
