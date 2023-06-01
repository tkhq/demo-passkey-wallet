package turnkey

import (
	"fmt"
	"os/exec"
	"time"

	"github.com/pkg/errors"
	"github.com/tkhq/go-sdk"
	"github.com/tkhq/go-sdk/pkg/api/client"
	"github.com/tkhq/go-sdk/pkg/api/client/activities"
	"github.com/tkhq/go-sdk/pkg/api/client/policies"
	"github.com/tkhq/go-sdk/pkg/api/client/private_keys"
	"github.com/tkhq/go-sdk/pkg/api/client/users"

	"github.com/tkhq/go-sdk/pkg/api/models"
	"github.com/tkhq/go-sdk/pkg/apikey"
	"github.com/tkhq/go-sdk/pkg/util"
)

var Client *TurnkeyApiClient

type TurnkeyApiClient struct {
	// APIKey is the structure
	APIKey *apikey.Key

	// Client is a raw TurnkeyPublicAPI client
	Client *client.TurnkeyPublicAPI

	// Organization is the default organization to be used for tests.
	OrganizationID string
}

// Creates a Turnkey SDK client from a Turnkey API key
func Init(turnkeyApiHost, turnkeyApiPrivateKey, organizationID string) error {
	apiKey, err := apikey.FromTurnkeyPrivateKey(turnkeyApiPrivateKey)
	if err != nil {
		return err
	}

	stagingConfig := &client.TransportConfig{
		Host: turnkeyApiHost,
	}

	publicApiClient := client.NewHTTPClientWithConfig(nil, stagingConfig)

	Client = &TurnkeyApiClient{
		APIKey:         apiKey,
		Client:         publicApiClient,
		OrganizationID: organizationID,
	}
	return nil
}

func (c *TurnkeyApiClient) Whoami() (string, error) {
	p := users.NewPublicAPIServiceGetWhoamiParams().WithBody(&models.V1GetWhoamiRequest{
		OrganizationID: &c.OrganizationID,
	})
	resp, err := c.Client.Users.PublicAPIServiceGetWhoami(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}
	return *resp.Payload.UserID, nil
}

// Creates a policy such that a user has permission to sign with a given private key
// This returns a Turnkey policy ID
func (c *TurnkeyApiClient) BindUserToPrivateKey(turnkeyUserId, privateKeyId string) (string, error) {
	policyName := fmt.Sprintf("Binds user %s to private key %s", turnkeyUserId[0:4], privateKeyId[0:4])

	p := policies.NewPublicAPIServiceCreatePolicyParams().WithBody(&models.V1CreatePolicyRequest{
		OrganizationID: &c.OrganizationID,
		Parameters: &models.V1CreatePolicyIntentV2{
			Effect:     models.NewImmutableactivityv1Effect(models.Immutableactivityv1EffectEFFECTALLOW),
			PolicyName: &policyName,
			Notes:      "some note",
			Selectors: []*models.V1SelectorV2{
				{
					Subject:  "activity.type",
					Operator: "OPERATOR_EQUAL",
					Targets:  []string{"ACTIVITY_TYPE_SIGN_RAW_PAYLOAD"},
				},
				{
					Subject:  "user.id",
					Operator: "OPERATOR_EQUAL",
					Targets:  []string{turnkeyUserId},
				},
				{
					Subject:  "activity.private_key.id",
					Operator: "OPERATOR_EQUAL",
					Targets:  []string{privateKeyId},
				},
			},
		},
		TimestampMs: util.RequestTimestamp(),
		// TODO: fixme! ACTIVITY_TYPE_CREATE_POLICY_V2 should be in our SDK
		// This is probably a matter of updating our proto and regenerate the SDK?
		Type: func() *string { a := "ACTIVITY_TYPE_CREATE_POLICY_V2"; return &a }(),
	})

	activityResponse, err := c.Client.Policies.PublicAPIServiceCreatePolicy(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}

	result, err := c.WaitForResult(*activityResponse.Payload.Activity.ID)
	if err != nil {
		return "", err
	}

	return *result.CreatePolicyResult.PolicyID, nil
}

// Creates a Private Key
func (c *TurnkeyApiClient) CreatePrivateKey(name string) (string, error) {
	p := private_keys.NewPublicAPIServiceCreatePrivateKeysParams().WithBody(&models.V1CreatePrivateKeysRequest{
		OrganizationID: &c.OrganizationID,
		Parameters: &models.V1CreatePrivateKeysIntent{
			PrivateKeys: []*models.V1PrivateKeyParams{{
				AddressFormats: []models.Immutableactivityv1AddressFormat{
					models.Immutableactivityv1AddressFormatADDRESSFORMATETHEREUM,
				},
				Curve:          models.Immutableactivityv1CurveCURVESECP256K1.Pointer(),
				PrivateKeyName: func() *string { return &name }(),
				PrivateKeyTags: []string{},
			}},
		},
		TimestampMs: util.RequestTimestamp(),
		Type:        (*string)(models.V1ActivityTypeACTIVITYTYPECREATEPRIVATEKEYS.Pointer()),
	})

	activityResponse, err := c.Client.PrivateKeys.PublicAPIServiceCreatePrivateKeys(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}

	result, err := c.WaitForResult(*activityResponse.Payload.Activity.ID)
	if err != nil {
		return "", err
	}

	return result.CreatePrivateKeysResult.PrivateKeyIds[0], nil
}

// Gets the Ethereum address for a private key ID created on Turnkey
func (c *TurnkeyApiClient) GetEthereumAddress(privateKeyId string) (string, error) {
	p := private_keys.NewPublicAPIServiceGetPrivateKeyParams().WithBody(&models.V1GetPrivateKeyRequest{
		OrganizationID: &c.OrganizationID,
		PrivateKeyID:   &privateKeyId,
	})

	resp, err := c.Client.PrivateKeys.PublicAPIServiceGetPrivateKey(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}

	return resp.Payload.PrivateKey.Addresses[0].Address, nil
}

// TODO: convert these bash scripts into proper SDK calls
// CreateUsers and CreateUserTags are unfortunately missing from it
// - CreateUsers is available in our public API, but requires us to regenerate the SDK with the latest protos
// - CreateUserTag isn't available officially. We're cheating a bit.
func (c *TurnkeyApiClient) CreateApiUser(name, publicApiKey string) (string, error) {
	output, err := exec.Command("/bin/bash", "scripts/create_turnkey_user.sh", c.OrganizationID, name, publicApiKey).Output()
	if err != nil {
		return "", err
	}

	var activityResponse models.V1ActivityResponse
	err = activityResponse.UnmarshalBinary(output)
	if err != nil {
		return "", errors.Wrap(err, "unable to parse activity response")
	}
	if activityResponse.Activity == nil {
		return "", errors.Wrapf(err, "nil activity?", output)

	}

	result, err := c.WaitForResult(*activityResponse.Activity.ID)
	if err != nil {
		return "", err
	}

	return result.CreateUsersResult.UserIds[0], nil
}

// Utility to wait for an activity result
func (c *TurnkeyApiClient) WaitForResult(activityId string) (*models.V1Result, error) {
	// Sleep a sec, to give this activity the best chance of success before we poll for a result.
	time.Sleep(1 * time.Second)

	params := activities.NewPublicAPIServiceGetActivityParams().WithBody(&models.V1GetActivityRequest{
		ActivityID:     func() *string { return &activityId }(),
		OrganizationID: &c.OrganizationID,
	})
	resp, err := c.Client.Activities.PublicAPIServiceGetActivity(params, c.GetAuthenticator())
	if err != nil {
		return nil, err
	}

	// TODO: it's possible that this activity comes back pending the first time but succeeds
	// afterwards. We should really have some kind of retry policy here
	if *resp.Payload.Activity.Status != models.V1ActivityStatusACTIVITYSTATUSCOMPLETED {
		return nil, fmt.Errorf("activity %+v has not completed! Status: %+v", activityId, resp.Payload.Activity.Status)
	}

	return resp.Payload.Activity.Result, nil
}

func (c *TurnkeyApiClient) GetAuthenticator() *sdk.Authenticator {
	return &sdk.Authenticator{Key: c.APIKey}
}
