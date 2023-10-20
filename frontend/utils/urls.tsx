
const BACKEND_API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL!;

export function registerUrl(): string {
    return BACKEND_API_BASE_URL +  "/api/register";
}

export function authenticateUrl(): string {
    return BACKEND_API_BASE_URL +  "/api/authenticate";
}

export function registrationStatusUrl(email: string): string {
    return BACKEND_API_BASE_URL + "/api/registration/" + email;
}

export function whoamiUrl(): string {
    return BACKEND_API_BASE_URL + "/api/whoami";
}

export function logoutUrl(): string {
    return BACKEND_API_BASE_URL + "/api/logout";
}

export function getSubOrganizationUrl(): string {
    return BACKEND_API_BASE_URL + "/api/suborganization";
}

export function getWalletUrl(): string {
    return BACKEND_API_BASE_URL + "/api/wallet";
}

export function getWalletHistoryUrl(): string {
    return BACKEND_API_BASE_URL + "/api/wallet/history"
}

export function dropUrl(): string {
    return BACKEND_API_BASE_URL + "/api/wallet/drop"
}

export function constructTxUrl(): string {
    return BACKEND_API_BASE_URL + "/api/wallet/construct-tx"
}

export function sendTxUrl(): string {
    return BACKEND_API_BASE_URL + "/api/wallet/send-tx"
}

export function initEmailRecoveryUrl(): string {
    return BACKEND_API_BASE_URL + "/api/init-recovery"
}


