Commands:
- 'make run' ==> launch the prod application
- 'make dev_restart' ==> launch the dev application with Vite as dataframe on localhost:5173 for the time being
- 'make clean' ==> clean all unnecessary files
- 'make dev clean' ==> clean all unnecessary files on the dev side

Create a new window: 
- copy the commented template found at the end of index.html
- paste inside main container, just before "< / main >"/!\ important
- select PREFIX -> ctrl + d -> replace all by your window name (ex: chat, settings etc)
- copy the commented try/catch template found at the end of main.ts
- paste it after the other similar blocks
- select PREFIX -> ctrl + d -> replace all by your window name (exactly same as for html)
- set spawner in 'openTriggerId: "spawner"' to the id of the button that should make your window appear

To remove the persistant database of login/users:
- docker volume rm

To check the database:
- docker exec -it backend sh
- sqlite3 data/db
- sqlite> .tables
- sqlite> SELECT * FROM users;
- sqlite> .exit

See ELK logs: 
- access Kibana at http://localhost:5601
- Go to Management > Kibana > Data View
- Click “Create data view”
- Fill the form:
    Name: Backend Logs
    Index pattern: backend-logs*
    Timestamp field: select @timestamp
    If it doesn’t show up: make sure some logs have reached Elasticsearch first via Logstash (use /api/test-log to trigger if needed).
- Click “Save data view”
- Go to the sidebar > click Discover
- Select the Backend Logs data view (top left dropdown)
- You now have access to logs stream in real time, they can be searched and filtered via the searchbar
