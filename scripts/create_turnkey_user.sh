#!/bin/bash

# Usage: create_turnkey_user <ORG_ID> <USER_NAME> <API_PUBKEY>

/opt/homebrew/bin/turnkey request --host coordinator.tkhq.xyz --path /public/v1/submit/create_users --body '{
    "timestampMs": "'"$(gdate +%s%3N)"'",
    "type": "ACTIVITY_TYPE_CREATE_USERS",
    "organizationId": "'"$1"'",
    "parameters": {
      "users": [
        {
          "userName": "'"$2"'",
          "userEmail": "'"$2"'@piggybank.com",
          "accessType": "ACCESS_TYPE_API",
          "userTags": [],
          "apiKeys": [{"publicKey": "'"$3"'", "apiKeyName": "'"$2"'-api-key"}],
          "authenticators": []
        }
      ]
    }
}' --key=piggy