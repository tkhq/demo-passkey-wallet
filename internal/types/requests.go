package types

type RegistrationRequest struct {
	Email       string
	Attestation Attestation
	Challenge   string
}

type Attestation struct {
	CredentialId      string
	ClientDataJson    string
	AttestationObject string
	Transports        []string
}

type AuthenticationRequest struct {
	SignedWhoamiRequest SignedTurnkeyRequest
}

type ConstructTxParams struct {
	Destination string `json:"destination" binding:"required"`
	Amount      string `json:"amount" binding:"required"`
}

type SendTxParams struct {
	SignedSendTx SignedTurnkeyRequest `json:"signedSendTx" binding:"required"`
}

type SignedTurnkeyRequest struct {
	Url   string
	Body  string
	Stamp string
}
