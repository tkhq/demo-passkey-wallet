
const PIGGYBANK_API_BASE_URL = process.env.NEXT_PUBLIC_PIGGYBANK_API_BASE_URL!;

export function registerUrl(): string {
    return PIGGYBANK_API_BASE_URL +  "/api/register";
}

export function authenticateUrl(): string {
    return PIGGYBANK_API_BASE_URL +  "/api/authenticate";
}

export function registrationStatusUrl(email: string): string {
    return PIGGYBANK_API_BASE_URL + "/api/registration/" + email;
}

export function whoamiUrl(): string {
    return PIGGYBANK_API_BASE_URL + "/api/whoami";
}

export function logoutUrl(): string {
    return PIGGYBANK_API_BASE_URL + "/api/logout";
}

export function getSubOrganizationUrl(): string {
    return PIGGYBANK_API_BASE_URL + "/api/suborganization";
}
