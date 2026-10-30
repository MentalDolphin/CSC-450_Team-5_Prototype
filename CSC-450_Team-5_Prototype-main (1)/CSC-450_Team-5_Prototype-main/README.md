# CSC-450_Team-5_Prototype
The draft of the group project application. It is preliminarily called RecipeVault.

## Setup
To run this application, it requires a server stack featuring PHP and MariaDB 11.3 or later. The recommended setup is to use Apache Web Server, PHP, and MariaDB on Debian/Ubuntu (mariadb is installed via default-mysql-server package).

You can set up a virtual machine with Debian 13, SSH into it, and run the server-setup.sh script as root (such as by running `sudo ./server-setup.sh`). That will install prerequisites to run this application.

Before importing the database, a password needs to be specified for the "serverauth" user in auth-table.sql and RecipeVault\_1st/private/do-login-dbconn. Where it says "FILL\_ME\_PLEASE" in those 2 files, put in the password you desire to set for that user. Then, you can upload **auth-table.sql** into PHPMyAdmin to set up the database. Then, you can copy the contents of RecipeVault\_1st into ~/public\_html (if using user directories) and access it at a URL such as http://10.1.2.3/~johndoe (if the user was named johndoe, and the IP address was 10.1.2.3). You could also upload the contents into /var/www/html and delete the included test page.
