import { LayerAkiraHttpAPI, LayerAkiraWSSAPI } from "@/api";
import { Address } from "@/types.ts";
import { TokenAddressMap } from "@/request_types.ts";

interface SDKConfiguration {
  apiBaseUrl: string;
  wssPath: string;
  tokenMapping: TokenAddressMap; // maps ERC20Token alias to it address in chain
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

  /**
   * Create a new instance of LayerAkiraSDK.
   * @param config
   */
  constructor(config: SDKConfiguration) {
    this.akiraHttp = new LayerAkiraHttpAPI(
      config,
      config.tokenMapping,
      config.logger,
    );
    this.akiraWss = new LayerAkiraWSSAPI(
      config.wssPath,
      this.akiraHttp,
      true,
      config.logger,
    );
  }
}
