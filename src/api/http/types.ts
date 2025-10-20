/**
 * Represent sign data that user needs to sign in order to authenticate on exchange and receive JWT token
 */
export type SignData = bigint;

/**
 * Represent sign data that user needs to sign in order to submit fast cancellations
 */
export type FastCancelSignData = { msg: string; expiration_ts: number };

/**
 * Represent code for the network troubleshoot for Result<T>
 */
export const NetworkIssueCode = 10000001; //

/**
 * Represent code for the internal troubleshoot for Result<T>
 */
export const ExceptionIssueCode = 10000002; //
