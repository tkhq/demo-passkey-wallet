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

type SignedTurnkeyRequest struct {
	Url   string
	Body  string
	Stamp string
}
