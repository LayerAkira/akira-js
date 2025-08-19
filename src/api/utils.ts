/**
 * Converts a stringified decimal value to a BigInt with a specified number of decimals.
 *
 * @param {string} value - The stringified decimal value to convert.
 * @param {number} decimals - The number of decimals representing 1 unit (e.g., 6 for 1_000_000).
 * @returns {BigInt} The BigInt representation of the value.
 */
export function formattedDecimalToBigInt(
  value: string,
  decimals: number,
): bigint {
  // Split the value into integer and fractional parts
  const [integerPart, fractionalPart = ""] = value.split(".");

  // Pad the fractional part with trailing zeros to match the decimals
  const paddedFractionalPart = fractionalPart.padEnd(decimals, "0");

  // Combine the integer and fractional parts and convert to BigInt
  const combined = `${integerPart}${paddedFractionalPart.slice(0, decimals)}`;
  return BigInt(combined);
}

/**
 * Converts a BigInt to a decimal string with a specified number of decimals and digits after the dot.
 *
 * @param {BigInt} x - The raw BigInt value to convert.
 * @param {number} decimals - The number of decimals representing 1 unit (e.g., 6 for 1_000_000).
 * @param {number} digitsAfterDot - The number of digits to include after the decimal point.
 * @returns {string} The decimal string representation of the value.
 */
export function bigIntToFormattedDecimal(
  x: bigint,
  decimals: number,
  digitsAfterDot?: number,
): string {
  digitsAfterDot = digitsAfterDot ?? decimals;
  const divisor = 10n ** BigInt(decimals);
  const integerPart = x / divisor;
  const fractionalPart = x % divisor;

  // Extract the necessary digits after the decimal point
  let fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, "0")
    .slice(0, digitsAfterDot);
  // Remove trailing zeros from the fractional part
  fractionalStr = fractionalStr.replace(/0+$/, "");
  // Combine the integer part and the formatted fractional part
  return fractionalStr
    ? `${integerPart.toString()}.${fractionalStr}`
    : integerPart.toString();
}

export function parseTableLvl(
  arr: any,
  baseDecimals: number,
  quoteDecimals: number,
) {
  if (arr.length > 0)
    return [
      formattedDecimalToBigInt(arr[0], quoteDecimals),
      formattedDecimalToBigInt(arr[1], baseDecimals),
      arr[2],
    ];
  return arr;
}
