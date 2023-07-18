package turnkey

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
	"github.com/tkhq/demo-passkey-wallet/internal/types"
	"github.com/tkhq/go-sdk"
	"github.com/tkhq/go-sdk/pkg/api/client"
	"github.com/tkhq/go-sdk/pkg/api/client/activities"
	"github.com/tkhq/go-sdk/pkg/api/client/organizations"
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

	TurnkeyApiHost string
}

// Creates a Turnkey SDK client from a Turnkey API key
func Init(turnkeyApiHost, turnkeyApiPrivateKey, organizationID string) error {
	apiKey, err := apikey.FromTurnkeyPrivateKey(turnkeyApiPrivateKey)
	if err != nil {
		return err
	}

	publicApiClient := client.NewHTTPClientWithConfig(nil, &client.TransportConfig{
		Host: turnkeyApiHost,
	})

	Client = &TurnkeyApiClient{
		APIKey:         apiKey,
		Client:         publicApiClient,
		OrganizationID: organizationID,
		TurnkeyApiHost: turnkeyApiHost,
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

// Method to forward signed requests to Turnkey.
// TODO: should be part of the Go SDK!
func (c *TurnkeyApiClient) ForwardSignedRequest(url, requestBody, stamp string, isWebauthnStamp bool) (int, []byte, error) {
	bodyBytes := []byte(requestBody)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return 0, []byte{}, errors.Wrap(err, "cannot create HTTP request")
	}
	if isWebauthnStamp {
		req.Header.Set("X-Stamp-WebAuthn", stamp)
	} else {
		req.Header.Set("X-Stamp", stamp)
	}
	client := http.Client{
		Timeout: 5 * time.Second,
	}

	res, err := client.Do(req)
	if err != nil {
		return 0, []byte{}, errors.Wrap(err, "error while forwarding signed request")
	}

	defer res.Body.Close()
	responseBody, err := io.ReadAll(res.Body)
	if err != nil {
		return 0, []byte{}, errors.Wrapf(err, "error while reading response body (status: %d)", res.StatusCode)
	}
	fmt.Printf("successfully forwarded request %s. Response: %s (%d)\n", url, responseBody, res.StatusCode)
	return res.StatusCode, responseBody, nil
}

// TODO: update the go SDK to make sure this request type is in!
// As-is this function is way too brittle and complex.
func (c *TurnkeyApiClient) CreateUserSubOrganization(userEmail string, attestation types.Attestation, challenge string) (string, error) {
	fmt.Printf("Creating sub-org for user %s...\n", userEmail)

	url := "https://" + c.TurnkeyApiHost + "/public/v1/submit/create_sub_organization"
	subOrganizationName := fmt.Sprintf("PiggyOrg for %s", strings.ReplaceAll(userEmail, "@", "-at-"))

	body := strings.TrimSpace(fmt.Sprintf(`{
				"type": "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V2",
				"timestampMs": "%d",
				"organizationId": %q,
				"parameters": {
					"subOrganizationName": %q,
					"rootUsers": [
						{
							"userName": "Piggybank User",
							"userEmail": %q,
							"apiKeys": [],
							"authenticators": [{
								"authenticatorName": "End-User Passkey",
								"challenge": %q,
								"attestation": {
									"credentialId": %q,
									"clientDataJson": %q,
									"attestationObject": %q,
									"transports": ["AUTHENTICATOR_TRANSPORT_HYBRID"]
								}
							}]
						},
						{
							"userName": "Onboarding Helper",
							"apiKeys": [{
								"apiKeyName": "Piggybank Systems",
								"publicKey": %q
							}],
							"authenticators": []
						}
					],
					"rootQuorumThreshold": 1
				}
		}`,
		time.Now().UnixMilli(),
		c.OrganizationID,
		subOrganizationName,
		userEmail,
		challenge,
		attestation.CredentialId,
		attestation.ClientDataJson,
		attestation.AttestationObject,
		c.APIKey.PublicKey,
	))

	stamp, err := apikey.Stamp([]byte(body), c.APIKey)
	if err != nil {
		return "", errors.Wrap(err, "failed to generate API stamp")
	}

	statusCode, responseBody, err := c.ForwardSignedRequest(url, body, stamp, false)
	if err != nil {
		return "", errors.Wrap(err, "failed to forward create-sub-org request")
	}

	if statusCode != 200 {
		return "", fmt.Errorf("unsuccessful sub-org create request (status: %d)", statusCode)
	}
	var activityResponse models.V1ActivityResponse
	err = json.Unmarshal([]byte(responseBody), &activityResponse)
	if err != nil {
		return "", errors.Wrap(err, "error while decoding activity response")
	}

	activityId := activityResponse.Activity.ID
	_, err = c.WaitForResult(c.OrganizationID, *activityId)

	if err != nil {
		return "", errors.Wrap(err, "error while waiting for activity result")
	}
	fmt.Printf("activity %s completed\n", *activityId)

	// Yiiiikes. TODO: remove this.
	activityBytes, err := c.GetRawActivityJson(c.OrganizationID, *activityId)
	if err != nil {
		return "", errors.Wrap(err, "cannot get raw activity bytes")
	}
	subOrganizationValue := gjson.Get(string(activityBytes), "activity.result.createSubOrganizationResult.subOrganizationId")

	return subOrganizationValue.String(), nil
}

func (c *TurnkeyApiClient) GetSubOrganization(subOrganizationId string) ([]byte, error) {
	p := organizations.NewPublicAPIServiceGetOrganizationParams().WithBody(&models.V1GetOrganizationRequest{
		OrganizationID: &subOrganizationId,
	})

	response, err := c.Client.Organizations.PublicAPIServiceGetOrganization(p, c.GetAuthenticator())
	if err != nil {
		return []byte{}, err
	}

	data, err := response.Payload.OrganizationData.MarshalBinary()
	if err != nil {
		return []byte{}, errors.Wrap(err, "cannot marshal sub-org data")
	}
	return data, nil
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

	result, err := c.WaitForResult(c.OrganizationID, *activityResponse.Payload.Activity.ID)
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

	result, err := c.WaitForResult(c.OrganizationID, *activityResponse.Activity.ID)
	if err != nil {
		return "", err
	}

	return result.CreateUsersResult.UserIds[0], nil
}

// Utility to wait for an activity result
func (c *TurnkeyApiClient) WaitForResult(organizationId, activityId string) (*models.V1Result, error) {
	// Sleep a sec, to give this activity the best chance of success before we poll for a result.
	time.Sleep(1 * time.Second)

	params := activities.NewPublicAPIServiceGetActivityParams().WithBody(&models.V1GetActivityRequest{
		ActivityID:     func() *string { return &activityId }(),
		OrganizationID: &organizationId,
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

// TODO: this method only has to be there because the SDK isn't up-to-date and the result types don't have "createSubOrganizationResult"
// Delete once update is done!
func (c *TurnkeyApiClient) GetRawActivityJson(organizationId, activityId string) ([]byte, error) {
	url := "https://" + c.TurnkeyApiHost + "/public/v1/query/get_activity"

	body := strings.TrimSpace(fmt.Sprintf(`{
			"activityId": %q,
			"organizationId": %q
		}`,
		activityId,
		organizationId,
	))
	stamp, err := apikey.Stamp([]byte(body), c.APIKey)
	if err != nil {
		return []byte{}, errors.Wrap(err, "failed to generate API stamp")
	}

	statusCode, responseBody, err := c.ForwardSignedRequest(url, body, stamp, false)
	if err != nil {
		return []byte{}, errors.Wrap(err, "failed to forward get activity request")
	}

	if statusCode != 200 {
		return []byte{}, fmt.Errorf("unsuccessful sub-org create request (status: %d)", statusCode)
	}
	return responseBody, nil
}

func (c *TurnkeyApiClient) GetAuthenticator() *sdk.Authenticator {
	return &sdk.Authenticator{Key: c.APIKey}
}
