# Demo Passkey Wallet

This repo contains a sample application with a frontend and backend component to onboard users through passkeys. Passkey signatures are used for registration and authentication. The backend component forwards these signatures to [Turnkey](https://turnkey.io).

Under the hood each user registering their passkey results in a new Turnkey sub-organizationn. The crypto keys are user-owned, and operations are user-directed. The frontend, backend, or Turnkey itself do not have the ability to move funds or take action on these sub-organizations.

These sub-organizations roll up to a single parent organization. The parent organization has **read-access** to all sub-organizations, but no ability to perform activities (e.g. signatures, user creation, etc). Learn more about Turnkey Activities [in our documentation](https://turnkey.readme.io/reference/key-concepts-1#activities).

## Tech Stack

* The frontend is a simple NextJS app deployed with Vercel. The frontend uses the [Turnkey JS SDK](https://github.com/tkhq/sdk) to power passkey interactions.
* The backend is a gin webapp serving JSON endpoints, deployed with Heroku. It uses the [Turnkey Golang SDK](https://github.com/tkhq/go-sdk) to interact with the Turnkey API.

Read on for more technical details.

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
$ psql -p 5555 -d demo-passkey-wallet
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
$ ./bin/demo-passkey-wallet
```

The backend should now be running on [localhost:12345](http://localhost:12345/).

### Frontend
```
$ cd frontend

# Create your own .env.local file
$ cp .env.example .env.local

$ npm run dev
```

The frontend should start on port 3000.

## Deployment

### Deploying the backend to Heroku

You will need credentials to perform this step. Slack Arnaud for details. Once you have creds:
```sh
$ heroku login
$ heroku git:remote -a tkhq-demo-passkey-wallet
$ git push heroku main
```

### Deploying the frontend to Vercel

This should happen automatically by pushing to `main`. Ask Arnaud if you need help.

## Production recipes

### Configuring on Heroku

Locally you can use a `.env` file to change configuration. If you want to set/change/remove configuration env vars on Heroku, use the Heroku CLI:
```sh
$ heroku login
$ heroku config:set TURNKEY_API_HOST=coordinator-beta.turnkey.io
$ heroku config:set TURNKEY_ORGANIZATION_ID=<organization-id>
$ heroku config:set TURNKEY_API_PRIVATE_KEY=<private-key>
# more commands at <https://devcenter.heroku.com/articles/config-vars>
```

## Inspecting Heroku DB

```sh
# See <https://devcenter.heroku.com/articles/managing-heroku-postgres-using-cli>
$ heroku login
$ heroku pg:psql
tkhq-demo-passkey-wallet::DATABASE=> show tables;
# ...etc...
```

# Legal Disclaimer

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL TURNKEY BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.