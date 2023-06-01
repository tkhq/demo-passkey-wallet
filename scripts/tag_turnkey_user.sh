#!/bin/bash

# Usage: tag_turnkey_user <ORG_ID> <TAG_LABEL> <USER_ID>

/opt/homebrew/bin/turnkey request --host coordinator.tkhq.xyz --path /public/v1/submit/create_users --body '{
    "timestampMs": "'"$(gdate +%s%3N)"'",
    "type": "ACTIVITY_TYPE_CREATE_USER_TAG",
    "organizationId": "'"$1"'",
    "parameters": {
      "userTagName": "'"$2"'",
      "userIds": ["'"$3"'"]
    }
}' --key=piggy