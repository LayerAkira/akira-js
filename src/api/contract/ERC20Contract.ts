import { Address } from "../../types";
import { Abi, CallData, CallOptions, Contract, RpcProvider } from "starknet";
import { BigNumberish } from "ethers";
import { Result } from "../../response_types";
import { callContractMethod } from "./utils";

/**
 * Represents an ERC20 token contract on the Starknet.
 */
export class ERC20Contract {
  public address: Address;
  public readonly contract: Contract;

  constructor(erc20Address: Address, abi: Abi, provider: RpcProvider) {
    this.address = erc20Address;
    this.contract = new Contract(abi, erc20Address, provider);
  }

  public async balanceOf(
    account: BigNumberish,
    callOptions?: CallOptions,
  ): Promise<Result<bigint>> {
    return await callContractMethod(
      this.contract,
      "balanceOf",
      CallData.compile([account]),
      callOptions ?? { blockIdentifier: "pending" },
    );
  }

  public async allowance(
    owner: BigNumberish,
    spender: BigNumberish,
    callOptions?: CallOptions,
  ): Promise<Result<bigint>> {
    return await callContractMethod(
      this.contract,
      "allowance",
      CallData.compile([owner, spender]),
      callOptions ?? {
        blockIdentifier: "pending",
      },
    );
  }
}
