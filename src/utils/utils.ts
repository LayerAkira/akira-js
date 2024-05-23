/**
 * Generates a random salt value.
 * @returns The generated random salt.
 */
export function generateRandomSalt(): bigint {
  const maxBits = 251;
  const maxValue = 2n ** BigInt(maxBits) - 1n; // Calculate the maximum value that fits into 255 bits
  const currentTime = BigInt(Date.now()); // Get the current timestamp in milliseconds
  const randomValue =
    (currentTime << 64n) |
    BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)); // Combine timestamp with random value
  return randomValue % maxValue; // Ensure the result fits within the specified number of bits
}
