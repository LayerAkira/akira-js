import { LayerAkiraHttpAPI, LayerAkiraWSSAPI } from "./api";
import { Address } from "./types";
import { ERC20Token, ERCToDecimalsMap, TokenAddressMap } from "./request_types";
import { LayerAkiraContract } from "./api/contract/LayerAkiraContract";
import { Abi, RpcProvider } from "starknet";

/**
 * Interface representing the configuration for the LayerAkira SDK.
 */
export interface SDKConfiguration {
  apiBaseUrl: string;
  wssPath: string;
  tokenMapping: TokenAddressMap; // maps ERC20Token alias to it address in chain
  exchangeAddress: Address;
  exchangeAbi: Abi;
  baseFeeToken: ERC20Token;

  jwt?: string;
  tradingAccount?: Address; // if jwt token provided then associated signer and tradingAccount must be specified
  signer?: Address;
  logger?: (arg: string) => void;
}

/**
 * The LayerAkira SDK main class.
 * @category Main Classes
 */
export class LayerAkiraSDK {
  public akiraHttp: LayerAkiraHttpAPI;
  public akiraWss: LayerAkiraWSSAPI;
  public akiraContract: LayerAkiraContract;

  /**
   * Create a new instance of LayerAkiraSDK.
   * @param config
   * @param ercToDecimals
   * @param rpcUrlProvider
   */
  constructor(
    config: SDKConfiguration,
    ercToDecimals: ERCToDecimalsMap,
    rpcUrlProvider: string,
  ) {
    this.akiraHttp = new LayerAkiraHttpAPI(
      config,
      ercToDecimals,
      config.baseFeeToken,
      config.logger,
    );
    this.akiraWss = new LayerAkiraWSSAPI(
      config.wssPath,
      this.akiraHttp,
      true,
      config.logger,
    );
    this.akiraContract = new LayerAkiraContract(
      config.exchangeAddress,
      config.exchangeAbi,
      new RpcProvider({ nodeUrl: rpcUrlProvider }),
    );
  }
}
