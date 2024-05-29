import { Address } from "../../types";
import { Abi, Contract, RpcProvider } from "starknet";
import { NetworkIssueCode } from "../http/types";
import { Result } from "../../response_types";
import { WithdrawalEvent } from "./types";
import {
  getSignDataHash,
  getWithdrawSignData,
  StarknetDomain,
} from "../signing/snip12";

/**
 * Retrieves the ABI of a contract at a specified address.
 * @param contractAddress The address of the contract.
 * @param provider The RPC provider to use for querying the contract.
 * @returns A promise that resolves to a Result object containing the ABI of the contract or an error code and exception if the retrieval fails.
 */
export async function getContractAbi(
  contractAddress: Address,
  provider: RpcProvider,
): Promise<Result<Abi>> {
  try {
    const { abi: testAbi } = await provider.getClassAt(contractAddress);
    return { result: testAbi };
  } catch (e: any) {
    return { code: NetworkIssueCode, exception: e } as Result<Abi>;
  }
}

/**
 * Calls a method on the contract with provided arguments.
 * @param contract contract to interact with
 * @param method The name of the method to call.
 * @param args The arguments to pass to the method.
 * @returns A promise that resolves to the result of the contract method call.
 */
export async function callContractMethod(
  contract: Contract,
  method: string,
  ...args: any[]
): Promise<Result<any>> {
  try {
    const result = await (contract as any)[method](...args);
    return { result };
  } catch (e: any) {
    return { code: NetworkIssueCode, exception: e } as Result<any>;
  }
}

/**
 * Converts a bigint value to a hexadecimal string representation with leading zeros.
 * @param value The bigint value to convert.
 * @param length The desired length of the hexadecimal string (default is 64 characters).
 * @returns A hexadecimal string representation of the bigint value.
 */
export function bigintToHex(value: bigint, length: number = 64): string {
  // Convert bigint to hex and remove the '0x' prefix
  const hexString = value.toString(16);
  // Pad the hex string with leading zeros to the specified length
  return "0x" + hexString.padStart(length, "0");
}

export function hexToAscii(evenHexString: string) {
  let asciiString = "";
  let startIndex = 0;
  while (startIndex < evenHexString.length && evenHexString[startIndex] === "0")
    startIndex += 2;
  for (let i = startIndex; i < evenHexString.length; i += 2) {
    const hexPair = evenHexString.slice(i, i + 2);
    const asciiChar = String.fromCharCode(parseInt(hexPair, 16));
    asciiString += asciiChar;
  }
  return asciiString;
}

/**
 * Generates the withdrawal hash for a given withdrawal event and Starknet domain.
 * @param w The withdrawal event for which to generate the hash.
 * @param domain The Starknet domain.
 * @returns The hash of the withdrawal event data.
 */
export function getWithdrawHashByEvent(
  w: WithdrawalEvent,
  domain: StarknetDomain,
): string {
  return getSignDataHash(getWithdrawSignData(w, domain), w.maker);
}
