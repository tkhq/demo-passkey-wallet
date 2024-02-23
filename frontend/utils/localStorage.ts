export const TURNKEY_EMBEDDED_KEY_TTL_IN_MILLIS = 1000 * 60 * 60 * 1; // 1 hour in milliseconds
export const TURNKEY_BUNDLE_KEY = "AUTH_BUNDLE";

/**
 * Set an item in localStorage with an expiration time
 * @param {string} key
 * @param {string} value
 * @param {number} ttl expiration time in milliseconds
 */
export const setItemWithExpiry = function (key: string, value: string, ttl: number) {
  const now = new Date();
  const item = {
    value: value,
    expiry: now.getTime() + ttl,
  };
  window.localStorage.setItem(key, JSON.stringify(item));
};

/**
 * Get an item from localStorage. If it has expired, remove
 * the item from localStorage and return null.
 * @param {string} key
 */
export const getItemWithExpiry = (key: string) => {
  const itemStr = window.localStorage.getItem(key);

  if (!itemStr) {
    return null;
  }

  const item = JSON.parse(itemStr);

  if (!item.hasOwnProperty("expiry") || !item.hasOwnProperty("value")) {
    window.localStorage.removeItem(key);
    return null;
  }

  const now = new Date();
  if (now.getTime() > item.expiry) {
    window.localStorage.removeItem(key);
    return null;
  }
  return item.value;
};
