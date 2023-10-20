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
	"github.com/tkhq/go-sdk/pkg/api/client/who_am_i"

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

// Custom type to hold results from a sub-org creation result
type CreateSubOrganizationResult struct {
	SubOrganizationId string
	WalletId          string
	// Note: we _could_ create more than 1 address per sub-org
	// But we don't want to right now.
	EthereumAddress string
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
	p := who_am_i.NewPublicAPIServiceGetWhoamiParams().WithBody(&models.V1GetWhoamiRequest{
		OrganizationID: &c.OrganizationID,
	})
	resp, err := c.Client.WhoAmi.PublicAPIServiceGetWhoami(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}
	return *resp.Payload.UserID, nil
}

// Method to forward signed requests to Turnkey.
// TODO: should be part of the Go SDK!
func (c *TurnkeyApiClient) ForwardSignedRequest(url string, requestBody string, stamp types.TurnkeyStamp) (int, []byte, error) {
	bodyBytes := []byte(requestBody)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return 0, []byte{}, errors.Wrap(err, "cannot create HTTP request")
	}
	req.Header.Set(stamp.StampHeaderName, stamp.StampHeaderValue)
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

// This function creates a new sub-organization for a given user email.
// Turnkey's CREATE_SUB_ORGANIZATION activity supports creating a sub-org and private key(s) at once, atomically.
// We use this to our advantage here!
func (c *TurnkeyApiClient) CreateUserSubOrganization(userEmail string, attestation types.Attestation, challenge string) (*CreateSubOrganizationResult, error) {
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

	credentialId := attestation.CredentialId
	clientDataJson := attestation.ClientDataJson
	attestationObject := attestation.AttestationObject
	timestamp := util.RequestTimestamp()
	ethereumWalletName := fmt.Sprintf("Ethereum Wallet - %s", *timestamp)
	ethereumDerivationPath := "m/44'/60'/0'/0/0"

	p := organizations.NewPublicAPIServiceCreateSubOrganizationParams().WithBody(&models.V1CreateSubOrganizationRequest{
		OrganizationID: &c.OrganizationID,
		Parameters: &models.V1CreateSubOrganizationIntentV4{
			SubOrganizationName: &subOrganizationName,
			RootQuorumThreshold: &rootQuorumThreshold,
			Wallet: &models.V1WalletParams{
				Accounts: []*models.V1WalletAccountParams{
					{
						AddressFormat: models.Immutablecommonv1AddressFormatADDRESSFORMATETHEREUM.Pointer(),
						Curve:         models.Immutablecommonv1CurveCURVESECP256K1.Pointer(),
						Path:          &ethereumDerivationPath,
						PathFormat:    models.V1PathFormatPATHFORMATBIP32.Pointer(),
					},
				},
				WalletName: &ethereumWalletName,
			},
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
			},
		},
		TimestampMs: timestamp,
		// TODO: this should be automatically filled based on Param type.
		Type: (*string)(models.V1ActivityTypeACTIVITYTYPECREATESUBORGANIZATIONV4.Pointer()),
	})

	response, err := c.Client.Organizations.PublicAPIServiceCreateSubOrganization(p, c.GetAuthenticator())
	if err != nil {
		return nil, errors.Wrap(err, "error while creating CREATE_SUB_ORGANIZATION activity")
	}
	if response == nil || response.Payload == nil || response.Payload.Activity == nil || response.Payload.Activity.ID == nil {
		return nil, fmt.Errorf("unable to get activity ID from activity response: %v", response)
	}

	result, err := c.WaitForResult(c.OrganizationID, *response.Payload.Activity.ID)
	if err != nil {
		return nil, errors.Wrap(err, "error while waiting for activity result")
	}
	fmt.Printf("activity %s completed\n", *response.Payload.Activity.ID)

	if result == nil || result.CreateSubOrganizationResultV4 == nil || result.CreateSubOrganizationResultV4.SubOrganizationID == nil {
		return nil, fmt.Errorf("expected a non-empty CreateSubOrganizationResultV4. Got: %+v", result)
	}

	if result.CreateSubOrganizationResultV4.Wallet == nil {
		return nil, fmt.Errorf("expected a wallet in CreateSubOrganizationResultV4. Got none: %+v", result)
	}
	if len(result.CreateSubOrganizationResultV4.Wallet.Addresses) != 1 {
		return nil, fmt.Errorf("expected one address in the sub-org creation result. Got: %d", len(result.CreateSubOrganizationResultV4.Wallet.Addresses))
	}

	return &CreateSubOrganizationResult{
		SubOrganizationId: *result.CreateSubOrganizationResultV4.SubOrganizationID,
		WalletId:          *result.CreateSubOrganizationResultV4.Wallet.WalletID,
		EthereumAddress:   result.CreateSubOrganizationResultV4.Wallet.Addresses[0],
	}, nil
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

// Takes an unsigned ETH payload and tries to sign it.
// On success, the signed transaction is returned. On failure, an error is returned.
func (c *TurnkeyApiClient) SignTransaction(organizationId string, signWith string, unsignedTransaction string) (string, error) {
	timestamp := util.RequestTimestamp()

	p := private_keys.NewPublicAPIServiceSignTransactionParams().WithBody(&models.V1SignTransactionRequest{
		OrganizationID: &organizationId,
		Parameters: &models.V1SignTransactionIntentV2{
			SignWith:            &signWith,
			Type:                models.V1TransactionTypeTRANSACTIONTYPEETHEREUM.Pointer(),
			UnsignedTransaction: &unsignedTransaction,
		},
		TimestampMs: timestamp,
		Type:        (*string)(models.V1ActivityTypeACTIVITYTYPESIGNTRANSACTION.Pointer()),
	})

	activityResponse, err := c.Client.PrivateKeys.PublicAPIServiceSignTransaction(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}

	result, err := c.WaitForResult(organizationId, *activityResponse.Payload.Activity.ID)
	if err != nil {
		return "", err
	}

	return *result.SignTransactionResult.SignedTransaction, nil
}

// Gets the Ethereum address for a private key ID created on Turnkey
// This is only used to pull one address: the warchest private key address
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

// Starts recovery for a given sub-organization
// The backend API key can do this because parent organizations are allowed to initiate recovery for their sub-orgs.
// Any (API) user which has the ability to perform ACTIVITY_TYPE_INIT_USER_EMAIL_RECOVERY in the parent can thus target the sub-organizations as well.
func (c *TurnkeyApiClient) InitRecovery(subOrganizationId, email, targetPublicKey string) (string, error) {
	p := organizations.NewPublicAPIServiceInitUserEmailRecoveryParams().WithBody(&models.V1InitUserEmailRecoveryRequest{
		OrganizationID: &subOrganizationId,
		Parameters: &models.V1InitUserEmailRecoveryIntent{
			Email:           &email,
			TargetPublicKey: &targetPublicKey,
		},
		TimestampMs: util.RequestTimestamp(),
		Type:        (*string)(models.V1ActivityTypeACTIVITYTYPEINITUSEREMAILRECOVERY.Pointer()),
	})

	activityResponse, err := c.Client.Organizations.PublicAPIServiceInitUserEmailRecovery(p, c.GetAuthenticator())
	if err != nil {
		return "", err
	}

	result, err := c.WaitForResult(subOrganizationId, *activityResponse.Payload.Activity.ID)
	if err != nil {
		return "", err
	}

	return *result.InitUserEmailRecoveryResult.UserID, nil
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
