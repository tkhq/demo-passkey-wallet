# Piggybank

This repo contains a sample backend application, written in Go, to onboard
users into a fictional "piggybank" business. The crypto keys are user-owned,
and operations are user-directed.

## Running locally

Install `go` and Postgres:
```
$ brew install go@1.19
$ brew install postgresql@14
```

Run


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

Piggybank should now be running on [localhost:12345](http://localhost:12345/).

## Deploying to Heroku

You will need credentials to perform this step. Slack Arnaud for details. Once you have creds:
```sh
$ heroku login
$ heroku git:remote -a tkhq-piggybank
$ git push heroku main
```
