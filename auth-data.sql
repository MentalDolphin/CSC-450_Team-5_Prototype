-- This is how to set up an email

select random_bytes(16) into @salt;
insert into AuthTable(EmailAddr, PassHash, Salt) values
  ('johndoe@example.com', kdf('Password01', @salt), @salt)
;

-- Add second test user
call add_user('janedoe@example.com', 'Password02');
