import { Address } from "@/types.ts";
import { ERC20Token, Withdraw } from "@/request_types.ts";
import { generateRandomSalt } from "@/utils/utils.ts";

export class WithdrawConstructor {
  public readonly trader: Address;
  public readonly exchangeFeeRecipient: Address;

  private readonly gasSteps: number;
  private readonly nativeGasFeeToken: Address;

  /**
   * Creates an instance of WithdrawConstructor.
   * @param trader The address of the trader.
   * @param exchangeFeeRecipient The address of the exchange fee recipient.
   * @param gasSteps The number of gas steps.
   * @param nativeGasFeeToken The address of the native gas fee token.
   */
  constructor(
    trader: Address,
    exchangeFeeRecipient: Address,
    gasSteps: number,
    nativeGasFeeToken: Address,
  ) {
    this.trader = trader;
    this.exchangeFeeRecipient = exchangeFeeRecipient;
    this.gasSteps = gasSteps;
    this.nativeGasFeeToken = nativeGasFeeToken;
  }

  /**
   * Constructs a withdrawal request.
   * @param token The token to withdraw.
   * @param amount The amount to withdraw.
   * @param gasPriceInChainToken The gas price in the chain token.
   * @param gasFeeToken The token used to pay the gas fee (optional, defaults to nativeGasFeeToken).
   * @param conversionRate The conversion rate for the gas fee (optional, defaults to [1n, 1n]).
   * @param receiver The address of the receiver (optional, defaults to the trader's address).
   * @returns The constructed withdraw request.
   * Note that if withdrawal token is the same token in which user would pay for the gas
   * Actual receiving amount would be amount - fee for the gas
   */
  public buildWithdraw(
    token: ERC20Token,
    amount: bigint,
    gasPriceInChainToken: bigint,
    gasFeeToken?: ERC20Token,
    conversionRate?: [bigint, bigint],
    receiver?: Address,
  ): Withdraw {
    return {
      amount: amount,
      maker: this.trader,
      receiver: receiver ?? this.trader,
      salt: generateRandomSalt(),
      token: token,
      gas_fee: {
        gas_per_action: this.gasSteps,
        fee_token: gasFeeToken ?? this.nativeGasFeeToken,
        max_gas_price: gasPriceInChainToken,
        conversion_rate: conversionRate ?? [1n, 1n],
      },
    };
  }
}
