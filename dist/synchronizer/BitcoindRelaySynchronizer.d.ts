import { BtcRelay, BtcStoredHeader, RelaySynchronizer } from "@atomiqlabs/base";
import { BitcoindBlock } from "../rpc/BitcoindBlock";
import { BitcoindRpc } from "../rpc/BitcoindRpc";
export declare class BtcRelaySynchronizer<V extends BtcStoredHeader<any>, T> implements RelaySynchronizer<V, T, BitcoindBlock> {
    btcRelay: BtcRelay<V, T, BitcoindBlock>;
    bitcoinRpc: BitcoindRpc;
    constructor(btcRelay: BtcRelay<V, T, BitcoindBlock>, bitcoinRpc: BitcoindRpc);
    syncToLatestTxs(signer: string): Promise<{
        txs: T[];
        targetCommitedHeader: V;
        computedHeaderMap: {
            [blockheight: number]: V;
        };
        blockHeaderMap: {
            [blockheight: number]: BitcoindBlock;
        };
        btcRelayTipCommitedHeader: V;
        btcRelayTipBlockHeader: BitcoindBlock;
        latestBlockHeader: BitcoindBlock;
        startForkId: number;
    }>;
}
