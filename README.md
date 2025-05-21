Commands:
- 'make run' ==> launch the prod application
- 'make dev_restart' ==> launch the dev application with Vite as dataframe on localhost:5173 for the time being
- 'make clean' ==> clean all unnecessary files
- 'make dev clean' ==> clean all unnecessary files on the dev side

To remove the persistant database of login/users:
- docker volume rm

To check the database:
- docker exec -it backend sh
- sqlite3 data/db
- sqlite> .tables
- sqlite> SELECT * FROM users;
- sqlite> .exit