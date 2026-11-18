/**
 * Host half of the usage & balance bundle.
 *
 * The readout is entirely a Client surface: rendering, the token-usage
 * projection read, and the account balance Remote all live in `client.js`.
 * This row exists so the bundle has one Loader entry to enable or disable.
 */
export function apply() {}
