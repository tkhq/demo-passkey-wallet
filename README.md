# Piggybank

This repo contains a sample backend application, written in Go, to onboard
users into a fictional "piggybank" business. The crypto keys are user-owned,
and operations are user-directed.

## Running locally

### Database

Install `go` and Postgres:
```
$ brew install go@1.19
$ brew install postgresql@14
```

Start the DB:
```
# Customize the DB port and name with your own local DB name/port
$ pg_ctl -D /opt/homebrew/var/postgres -o "-p 5555" start

# You can check that the DB works by running:
$ psql -p 5555 -d piggybank
```

### Backend

Build and start the Go backend:

```sh
$ make build

# Copy the template env file and populate values
$ cp .env.template .env

# Launch via heroku
$ heroku local -e .env

# Launch via `air` (bonus: auto-reloads!)
$ air

# ...or manually!
$ ./bin/piggybank
```

Piggybank's backend should now be running on [localhost:12345](http://localhost:12345/).

### Frontend
```
$ cd frontend

$ npm run dev
```

The frontend should start on port 3000.

## Deployment

### Deploying the backend to Heroku

You will need credentials to perform this step. Slack Arnaud for details. Once you have creds:
```sh
$ heroku login
$ heroku git:remote -a tkhq-piggybank
$ git push heroku main
```

### Deploying the frontend to Vercel

This should happen automatically by pushing to `main`.

## Production recipes

### Configuring on Heroku

Locally you can use a `.env` file to change configuration. If you want to set/change/remove configuration env vars on Heroku, use the Heroku CLI:
```sh
$ heroku login
$ heroku config:set TURNKEY_API_HOST=coordinator.tkhq.xyz
$ heroku config:set TURNKEY_ORGANIZATION_ID=<organization-id>
$ heroku config:set TURNKEY_API_PRIVATE_KEY=<private-key>
# more commands at <https://devcenter.heroku.com/articles/config-vars>
```

## Inspecting Heroku DB

```sh
# See <https://devcenter.heroku.com/articles/managing-heroku-postgres-using-cli>
$ heroku login
$ heroku pg:psql
tkhq-piggybank::DATABASE=> show tables;
# ...etc...
```