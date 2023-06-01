# Piggybank

This repo contains a sample backend application, written in Go, to onboard
users into a fictional "piggybank" business. The crypto keys are user-owned,
and operations are user-directed.

## Running locally

```sh
$ make build

# via heroku
$ heroku local

# via `air` (auto-reload)
$ air

# ...or manually!
PORT=12345 ./bin/piggybank
```

Piggybank should now be running on [localhost:12345](http://localhost:12345/).

## Deploying to Heroku

```sh
$ heroku create
$ git push heroku main
$ heroku open
```
