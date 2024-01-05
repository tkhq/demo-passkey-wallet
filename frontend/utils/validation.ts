/**
 *
 * Validates an authenticator label according to Turnkey's validation rules:
 * - labels must be strictly less than 256 characters
 * - labels must be composed of letters, numbers, or the following symbols: ' ', '_', '.', '-', ',', '-', '+', '@'
 * @param label Authenticator name
 * Returns an error message, or `true`
 */
export const validateAuthenticatorLabel = (label: string) => {
  if (label.length == 0) {
    return "Authenticator label cannot be empty";
  }

  if (label.length >= 256) {
    return "Authenticator label must be less than 256 characters long";
  }

  if (!/^([A-Za-z0-9\s_+@\.-]+)$/.test(label)) {
    return "Authenticator label must be composed of letters, numbers, or the following symbols: spaces, _, ., -, +, @";
  }
  return true;
};
