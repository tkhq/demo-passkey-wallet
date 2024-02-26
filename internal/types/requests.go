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
	SubOrganizationId   string // optional; for email auth
}

type ConstructTxParams struct {
	Destination string `json:"destination" binding:"required"`
	Amount      string `json:"amount" binding:"required"`
}

type SendTxParams struct {
	SignedSendTx SignedTurnkeyRequest `json:"signedSendTx" binding:"required"`
}

type BroadcastTxParams struct {
	SignedSendTx string `json:"signedSendTx" binding:"required"`
}

type SignedTurnkeyRequest struct {
	Url   string
	Body  string
	Stamp TurnkeyStamp `json:"stamp" binding:"required"`
}

type TurnkeyStamp struct {
	StampHeaderName  string
	StampHeaderValue string
}

type ExportRequest struct {
	SignedExportRequest SignedTurnkeyRequest `json:"signedExportRequest" binding:"required"`
}

type RecoveryParams struct {
	Email           string `json:"email" binding:"required"`
	TargetPublicKey string `json:"targetPublicKey" binding:"required"`
}

type RecoverRequest struct {
	SignedRecoverRequest SignedTurnkeyRequest `json:"signedRecoverRequest" binding:"required"`
}

type WhoamiRequest struct {
	SignedWhoamiRequest SignedTurnkeyRequest `json:"signedWhoamiRequest" binding:"required"`
}

type EmailAuthParams struct {
	Email           string `json:"email" binding:"required"`
	TargetPublicKey string `json:"targetPublicKey" binding:"required"`
}
