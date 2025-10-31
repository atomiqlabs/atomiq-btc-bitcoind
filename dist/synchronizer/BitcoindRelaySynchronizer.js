"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BtcRelaySynchronizer = void 0;
class BtcRelaySynchronizer {
    constructor(btcRelay, bitcoinRpc) {
        this.btcRelay = btcRelay;
        this.bitcoinRpc = bitcoinRpc;
    }
    syncToLatestTxs(signer) {
        return __awaiter(this, void 0, void 0, function* () {
            const tipData = yield this.btcRelay.getTipData();
            const { resultStoredHeader, resultBitcoinHeader } = yield this.btcRelay.retrieveLatestKnownBlockLog();
            let cacheData = {
                forkId: 0,
                lastStoredHeader: resultStoredHeader
            };
            let startForkId = 0;
            if (resultStoredHeader.getBlockheight() < tipData.blockheight) {
                cacheData.forkId = -1; //Indicate that we will be submitting blocks to fork
            }
            let spvTipBlockHeader = resultBitcoinHeader;
            console.log("[BtcRelaySynchronizer]: Retrieved stored header with commitment: ", cacheData.lastStoredHeader);
            console.log("[BtcRelaySynchronizer]: SPV tip commit hash: ", tipData.commitHash);
            console.log("[BtcRelaySynchronizer]: SPV tip header: ", spvTipBlockHeader);
            const txsList = [];
            const blockHeaderMap = {
                [spvTipBlockHeader.height]: spvTipBlockHeader
            };
            const computedHeaderMap = {};
            let forkFee;
            let mainFee;
            const saveHeaders = (headerCache, final) => __awaiter(this, void 0, void 0, function* () {
                console.log("[BtcRelaySynchronizer]: Header cache: ", headerCache.map(e => e.hash));
                if (cacheData.forkId === -1) {
                    if (mainFee == null)
                        mainFee = yield this.btcRelay.getMainFeeRate(signer);
                    if (final &&
                        this.btcRelay.maxShortForkHeadersPerTx != null &&
                        this.btcRelay.maxShortForkHeadersPerTx >= headerCache.length &&
                        this.btcRelay.saveShortForkHeaders != null) {
                        cacheData = yield this.btcRelay.saveShortForkHeaders(signer, headerCache, cacheData.lastStoredHeader, tipData.chainWork, mainFee);
                    }
                    else {
                        cacheData = yield this.btcRelay.saveNewForkHeaders(signer, headerCache, cacheData.lastStoredHeader, tipData.chainWork, mainFee);
                    }
                }
                else if (cacheData.forkId === 0) {
                    if (mainFee == null)
                        mainFee = yield this.btcRelay.getMainFeeRate(signer);
                    cacheData = yield this.btcRelay.saveMainHeaders(signer, headerCache, cacheData.lastStoredHeader, mainFee);
                }
                else {
                    if (forkFee == null)
                        forkFee = yield this.btcRelay.getForkFeeRate(signer, cacheData.forkId);
                    cacheData = yield this.btcRelay.saveForkHeaders(signer, headerCache, cacheData.lastStoredHeader, cacheData.forkId, tipData.chainWork, forkFee);
                }
                if (cacheData.forkId !== -1 && cacheData.forkId !== 0)
                    startForkId = cacheData.forkId;
                if (cacheData.tx != null)
                    txsList.push(cacheData.tx);
                if (cacheData.computedCommitedHeaders != null)
                    for (let storedHeader of cacheData.computedCommitedHeaders) {
                        computedHeaderMap[storedHeader.getBlockheight()] = storedHeader;
                    }
            });
            let headerCache = [];
            while (spvTipBlockHeader.nextblockhash != null) {
                const startTime = Date.now();
                const retrievedHeader = yield this.bitcoinRpc.getBlockHeader(spvTipBlockHeader.nextblockhash);
                if (retrievedHeader == null)
                    throw new Error(`Blockheader ${spvTipBlockHeader.nextblockhash} not found`);
                console.log("[BtcRelaySynchronizer]: Syncing blockheight (in " + (Date.now() - startTime) + "ms): ", retrievedHeader.height);
                blockHeaderMap[retrievedHeader.height] = retrievedHeader;
                headerCache.push(retrievedHeader);
                if (cacheData.forkId === 0 ?
                    headerCache.length >= this.btcRelay.maxHeadersPerTx :
                    headerCache.length >= this.btcRelay.maxForkHeadersPerTx) {
                    yield saveHeaders(headerCache, false);
                    headerCache = [];
                }
                spvTipBlockHeader = retrievedHeader;
                // if(retrievedHeader.nextblockhash!=null) {
                //     await new Promise((resolve) => setTimeout(resolve, 1000));
                // }
            }
            if (headerCache.length > 0) {
                yield saveHeaders(headerCache, true);
            }
            return {
                txs: txsList,
                targetCommitedHeader: cacheData.lastStoredHeader,
                blockHeaderMap,
                computedHeaderMap,
                btcRelayTipBlockHeader: resultBitcoinHeader,
                btcRelayTipCommitedHeader: resultStoredHeader,
                latestBlockHeader: spvTipBlockHeader,
                startForkId
            };
        });
    }
}
exports.BtcRelaySynchronizer = BtcRelaySynchronizer;
