import { LayerAkiraHttpAPI, LayerAkiraWSSAPI } from "./api";
import { Address } from "./types";
import { ERC20Token, ERCToDecimalsMap, TokenAddressMap } from "./request_types";
import { LayerAkiraContract } from "./api/contract/LayerAkiraContract";
import { RpcProvider } from "starknet";
import { LayerAkiraUIQuoter } from "./api/http/UIQuoter";

/**
 * Interface representing the configuration for the LayerAkira SDK.
 */
export interface SDKConfiguration {
  apiBaseUrl: string;
  wssPath: string;
  tokenMapping: TokenAddressMap; // maps ERC20Token alias to it address in chain
  coreAddress: Address;
  executorAddress: Address;
  routerAddress: Address;
  baseFeeToken: ERC20Token;

  jwt?: string;
  tradingAccount?: Address; // if jwt token provided then associated signer and tradingAccount must be specified
  signer?: Address;
  logger?: (arg: string) => void;
  timeoutMillis?: number;
  apiUIQuoter?: string;
}

/**
 * The LayerAkira SDK main class.
 * @category Main Classes
 */
export class LayerAkiraSDK {
  public akiraHttp: LayerAkiraHttpAPI;
  public akiraWss: LayerAkiraWSSAPI;
  public akiraContract: LayerAkiraContract;
  public akiraQuoter: LayerAkiraUIQuoter;
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
      config.timeoutMillis,
    );
    this.akiraWss = new LayerAkiraWSSAPI(
      config.wssPath,
      this.akiraHttp,
      true,
      config.logger,
    );
    this.akiraContract = new LayerAkiraContract(
      config.coreAddress,
      config.executorAddress,
      config.routerAddress,
      new RpcProvider({ nodeUrl: rpcUrlProvider }),
    );
    this.akiraQuoter = new LayerAkiraUIQuoter(
      config.apiUIQuoter!,
      ercToDecimals,
      config.baseFeeToken,
      config.logger,
      config.timeoutMillis,
    );
  }
}
