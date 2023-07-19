package turnkey

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/pkg/errors"
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

func (c *TurnkeyApiClient) CreateUserSubOrganization(userEmail string, attestation types.Attestation, challenge string) (string, error) {
	fmt.Printf("Creating sub-org for user %s...\n", userEmail)
	sanitizedEmail := strings.ReplaceAll(userEmail, "@", "-at-")
	sanitizedEmail = strings.ReplaceAll(sanitizedEmail, "+", "-plus-")
	subOrganizationName := fmt.Sprintf("SubOrg for %s", sanitizedEmail)
	// Trim name if too long. TODO: this should be exposed in our public docs / SDK.
	if len(subOrganizationName) >= 255 {
		subOrganizationName = subOrganizationName[:255]
	}

	// TODO: this should accept normal ints!
	rootQuorumThreshold := int32(1)
	// TODO: this should be automatically filled based on Param type.
	activityType := "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V2"

	credentialId := attestation.CredentialId
	clientDataJson := attestation.ClientDataJson
	attestationObject := attestation.AttestationObject
	apiPublicKey := c.APIKey.TkPublicKey

	p := organizations.NewPublicAPIServiceCreateSubOrganizationParams().WithBody(&models.V1CreateSubOrganizationRequest{
		OrganizationID: &c.OrganizationID,
		Parameters: &models.V1CreateSubOrganizationIntentV2{
			RootQuorumThreshold: &rootQuorumThreshold,
			RootUsers: []*models.V1RootUserParams{
				{
					// TODO: why is this a pointer instead of a string? This is a required string.
					UserName: func() *string { s := "Wallet User"; return &s }(),
					// TODO: and why is that a straight up string?! This _should_ be optional / a pointer
					UserEmail: userEmail,
					APIKeys:   []*models.V1APIKeyParams{},
					Authenticators: []*models.V1AuthenticatorParamsV2{
						{
							Challenge: &challenge,
							Attestation: &models.V1Attestation{
								AttestationObject: &attestationObject,
								ClientDataJSON:    &clientDataJson,
								CredentialID:      &credentialId,
								Transports: []models.Immutablewebauthnv1AuthenticatorTransport{
									models.Immutablewebauthnv1AuthenticatorTransportAUTHENTICATORTRANSPORTHYBRID,
								},
							},
							AuthenticatorName: func() *string { s := "End-User Passkey"; return &s }(),
						},
					},
				},
				{
					UserName:  func() *string { s := "Onboarding Helper"; return &s }(),
					UserEmail: "",
					APIKeys: []*models.V1APIKeyParams{
						{
							APIKeyName: func() *string { s := "Wallet Backend"; return &s }(),
							PublicKey:  &apiPublicKey,
						},
					},
					Authenticators: []*models.V1AuthenticatorParamsV2{},
				},
			},
			SubOrganizationName: &subOrganizationName,
		},
		TimestampMs: util.RequestTimestamp(),
		Type:        &activityType,
	})

	response, err := c.Client.Organizations.PublicAPIServiceCreateSubOrganization(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}
	if response == nil || response.Payload == nil || response.Payload.Activity == nil || response.Payload.Activity.ID == nil {
		return "", fmt.Errorf("unable to get activity ID from activity response: %v", response)
	}

	result, err := c.WaitForResult(c.OrganizationID, *response.Payload.Activity.ID)
	if err != nil {
		return "", errors.Wrap(err, "error while waiting for activity result")
	}
	fmt.Printf("activity %s completed\n", *response.Payload.Activity.ID)

	if result == nil || result.CreateSubOrganizationResult == nil || result.CreateSubOrganizationResult.SubOrganizationID == nil {
		return "", fmt.Errorf("expected a non-empty CreateSubOrganizationResult. Got: %+v", result)
	}
	subOrganizationId := result.CreateSubOrganizationResult.SubOrganizationID

	return *subOrganizationId, nil
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

// Creates a new Private Key with an Ethereum address, and returns the Private Key ID.
func (c *TurnkeyApiClient) CreateEthereumKey(subOrganizationId string) (string, error) {
	timestamp := util.RequestTimestamp()
	name := fmt.Sprintf("Ethereum Key - %s", *timestamp)

	p := private_keys.NewPublicAPIServiceCreatePrivateKeysParams().WithBody(&models.V1CreatePrivateKeysRequest{
		OrganizationID: &subOrganizationId,
		Parameters: &models.V1CreatePrivateKeysIntent{
			PrivateKeys: []*models.V1PrivateKeyParams{{
				AddressFormats: []models.Immutableactivityv1AddressFormat{
					models.Immutableactivityv1AddressFormatADDRESSFORMATETHEREUM,
				},
				Curve:          models.Immutableactivityv1CurveCURVESECP256K1.Pointer(),
				PrivateKeyName: &name,
				PrivateKeyTags: []string{},
			}},
		},
		TimestampMs: timestamp,
		Type:        (*string)(models.V1ActivityTypeACTIVITYTYPECREATEPRIVATEKEYS.Pointer()),
	})

	activityResponse, err := c.Client.PrivateKeys.PublicAPIServiceCreatePrivateKeys(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}

	result, err := c.WaitForResult(subOrganizationId, *activityResponse.Payload.Activity.ID)
	if err != nil {
		return "", err
	}

	return result.CreatePrivateKeysResult.PrivateKeyIds[0], nil
}

// Gets the Ethereum address for a private key ID created on Turnkey
func (c *TurnkeyApiClient) GetEthereumAddress(organizationId, privateKeyId string) (string, error) {
	p := private_keys.NewPublicAPIServiceGetPrivateKeyParams().WithBody(&models.V1GetPrivateKeyRequest{
		OrganizationID: &organizationId,
		PrivateKeyID:   &privateKeyId,
	})

	resp, err := c.Client.PrivateKeys.PublicAPIServiceGetPrivateKey(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}

	return resp.Payload.PrivateKey.Addresses[0].Address, nil
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

func (c *TurnkeyApiClient) GetAuthenticator() *sdk.Authenticator {
	return &sdk.Authenticator{Key: c.APIKey}
}
