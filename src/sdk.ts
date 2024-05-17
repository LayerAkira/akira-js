import {LayerAkiraHttpAPI} from "@/api";
import {TokenAddressMap} from "@/api/types.ts";
import {Address} from "@/general_types.ts";

interface SDKConfiguration {
    apiBaseUrl: string;
    tokenMapping: TokenAddressMap // maps ERC20Token alias to it address in chain
    jwt?: string;
    tradingAccount?: Address
    logger?: (arg: string) => void
}

/**
 * The LayerAkira SDK main class.
 * @category Main Classes
 */
export class LayerAkiraSDK {
    public akiraHttp: LayerAkiraHttpAPI

    /**
     * Create a new instance of LayerAkiraSDK.
     * @param config
     */
    constructor(config: SDKConfiguration) {
        this.akiraHttp = new LayerAkiraHttpAPI(config, config.tokenMapping, config.logger,);
    }
}