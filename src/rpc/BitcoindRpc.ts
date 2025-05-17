import {BitcoindBlock, BitcoindBlockType} from "./BitcoindBlock";
import {BTCMerkleTree} from "./BTCMerkleTree";
import {BitcoinRpc, BtcBlockWithTxs, BtcSyncInfo, BtcTx} from "@atomiqlabs/base";
import * as RpcClient from "@atomiqlabs/bitcoind-rpc";
import {Script, Transaction} from "@scure/btc-signer";
import {Buffer} from "buffer";
import {createHash} from "crypto";

export type BitcoindVout = {
    value: number,
    n: number,
    scriptPubKey: {
        asm: string,
        hex: string,
        reqSigs: number,
        type: string,
        addresses: string[]
    }
};

export type BitcoindVin = {
    txid: string,
    vout: number,
    scriptSig: {
        asm: string,
        hex: string
    },
    sequence: number,
    txinwitness: string[]
};

export type BitcoindTransaction = {
    hex: string,
    txid: string,
    hash: string,
    size: number,
    vsize: number,
    weight: number,
    version: number,
    locktime: number,
    vin: BitcoindVin[],
    vout: BitcoindVout[],
    blockhash: string,
    confirmations: number,
    blocktime: number,
    time: number
};

type BitcoindRawBlock = {
    hash: string,
    confirmations: number,
    size: number,
    strippedsize: number,
    weight: number,
    height: number,
    version: number,
    versionHex: string,
    merkleroot: string,
    tx: BitcoindTransaction[],
    time: number,
    mediantime: number,
    nonce: number,
    bits: string,
    difficulty: number,
    nTx: number,
    previousblockhash: string,
    nextblockhash: string
}

type BitcoindBlockchainInfo = {
    chain : string,
    blocks : number,
    headers : number,
    bestblockhash : string,
    difficulty : number,
    time : number,
    mediantime : number,
    verificationprogress : number,
    initialblockdownload : boolean,
    chainwork : string,
    size_on_disk : number,
    pruned : boolean,
    pruneheight : number,
    automatic_pruning : boolean,
    prune_target_size : number,
    warnings : string
}

function bitcoinTxToBtcTx(btcTx: Transaction): BtcTx {
    return {
        locktime: btcTx.lockTime,
        version: btcTx.version,
        blockhash: null,
        confirmations: 0,
        txid: createHash("sha256").update(
            createHash("sha256").update(
                btcTx.toBytes(true, false)
            ).digest()
        ).digest().reverse().toString("hex"),
        hex: Buffer.from(btcTx.toBytes(true, false)).toString("hex"),
        raw: Buffer.from(btcTx.toBytes(true, true)).toString("hex"),
        vsize: btcTx.isFinal ? btcTx.vsize : null,

        outs: Array.from({length: btcTx.outputsLength}, (_, i) => i).map((index) => {
            const output = btcTx.getOutput(index);
            return {
                value: Number(output.amount),
                n: index,
                scriptPubKey: {
                    asm: Script.decode(output.script).map(val => typeof(val)==="object" ? Buffer.from(val).toString("hex") : val.toString()).join(" "),
                    hex: Buffer.from(output.script).toString("hex")
                }
            }
        }),
        ins: Array.from({length: btcTx.inputsLength}, (_, i) => i).map(index => {
            const input = btcTx.getInput(index);
            return {
                txid: Buffer.from(input.txid).toString("hex"),
                vout: input.index,
                scriptSig: {
                    asm: Script.decode(input.finalScriptSig).map(val => typeof(val)==="object" ? Buffer.from(val).toString("hex") : val.toString()).join(" "),
                    hex: Buffer.from(input.finalScriptSig).toString("hex")
                },
                sequence: input.sequence,
                txinwitness: input.finalScriptWitness==null ? [] : input.finalScriptWitness.map(witness => Buffer.from(witness).toString("hex"))
            }
        })
    }
}

type FeeRateResponse = {
    fee: number,
    vsize: number,
    getEffectiveFeeRate: (feeData?: {adjustedVsize: number, adjustedFee: number}) => Promise<{adjustedVsize: number, adjustedFee: number, feeRate: number}>
}

export class BitcoindRpc implements BitcoinRpc<BitcoindBlock> {

    rpc: any;

    constructor(
        protocol: string,
        user: string,
        pass: string,
        host: string,
        port: number,
        timeout: number = 10*1000
    ) {
        this.rpc = new RpcClient({
            protocol,
            user,
            pass,
            host,
            port: port.toString()
        });
        this.rpc.httpOptions = new Proxy(
            { signal: null },
            {
                get() {
                    return AbortSignal.timeout(timeout);
                },
            }
        );
    }

    async getTipHeight(): Promise<number> {

        const retrievedInfo = await new Promise<BitcoindBlockchainInfo>((resolve, reject) => {
            this.rpc.getBlockchainInfo((err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });

        return retrievedInfo.blocks;

    }

    async getBlockHeader(blockhash: string): Promise<BitcoindBlock> {
        const retrievedHeader = await new Promise<BitcoindBlockType>((resolve, reject) => {
            this.rpc.getBlockHeader(blockhash, true, (err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });
        return new BitcoindBlock(retrievedHeader);
    }

    async isInMainChain(blockhash: string): Promise<boolean> {
        const retrievedHeader = await new Promise<BitcoindBlockType>((resolve, reject) => {
            this.rpc.getBlockHeader(blockhash, true, (err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });
        return retrievedHeader.confirmations>0;
    }

    async getMerkleProof(txId: string, blockhash: string): Promise<{
        reversedTxId: Buffer,
        pos: number,
        merkle: Buffer[],
        blockheight: number
    }> {
        return BTCMerkleTree.getTransactionMerkle(txId, blockhash, this.rpc);
    }

    async getTransaction(txId: string): Promise<BtcTx> {

        const retrievedTx = await new Promise<BitcoindTransaction>((resolve, reject) => {
            this.rpc.getRawTransaction(txId, 1, (err, info) => {
                if(err) {
                    if(err.code===-5) {
                        resolve(null);
                        return;
                    }
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });

        if(retrievedTx==null) return null;

        //Strip witness data
        const btcTx = Transaction.fromRaw(Buffer.from(retrievedTx.hex, "hex"), {
            allowLegacyWitnessUtxo: true,
            allowUnknownInputs: true,
            allowUnknownOutputs: true,
            disableScriptCheck: true
        });
        const resultHex = Buffer.from(btcTx.toBytes(true, false)).toString("hex");

        retrievedTx.vout.forEach(e => {
            e.value = parseInt(e.value.toFixed(8).replace(new RegExp("\\.", 'g'), ""));
        });

        return {
            locktime: retrievedTx.locktime,
            version: retrievedTx.version,
            blockhash: retrievedTx.blockhash,
            confirmations: retrievedTx.confirmations,
            vsize: retrievedTx.vsize,
            txid: retrievedTx.txid,
            hex: resultHex,
            raw: retrievedTx.hex,
            outs: retrievedTx.vout,
            ins: retrievedTx.vin
        }

    }

    getBlockhash(height: number): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.rpc.getBlockHash(height, (err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });
    }

    async getBlockWithTransactions(blockhash: string): Promise<BtcBlockWithTxs> {

        const block = await new Promise<BitcoindRawBlock>((resolve, reject) => {
            this.rpc.getBlock(blockhash, 2, (err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });

        block.tx.forEach(tx => {
            tx.vout.forEach(vout => {
                vout.value = parseInt(vout.value.toFixed(8).replace(new RegExp("\\.", 'g'), ""));
            });
        });

        return {
            hash: block.hash,
            height: block.height,
            tx: block.tx.map(tx => {
                let resultHex = tx.hex;
                try {
                    const btcTx = Transaction.fromRaw(Buffer.from(tx.hex, "hex"), {
                        allowLegacyWitnessUtxo: true,
                        allowUnknownInputs: true,
                        allowUnknownOutputs: true,
                        disableScriptCheck: true
                    });
                    resultHex = Buffer.from(btcTx.toBytes(true, false)).toString("hex");
                } catch (e) {
                    console.warn("Error parsing transaction "+tx.txid, e);
                }

                return {
                    locktime: tx.locktime,
                    version: tx.version,
                    blockhash: tx.blockhash,
                    confirmations: tx.confirmations,
                    vsize: tx.vsize,
                    txid: tx.txid,
                    hex: resultHex,
                    raw: tx.hex,
                    outs: tx.vout,
                    ins: tx.vin
                };
            })
        };

    }

    async getSyncInfo(): Promise<BtcSyncInfo> {
        const blockchainInfo = await new Promise<BitcoindBlockchainInfo>((resolve, reject) => {
            this.rpc.getBlockchainInfo((err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });

        return {
            ibd: blockchainInfo.initialblockdownload,
            verificationProgress: blockchainInfo.verificationprogress,
            headers: blockchainInfo.headers,
            blocks: blockchainInfo.blocks,
            _: blockchainInfo
        } as any;
    }

    async sendRawPackage(rawTxs: string[]): Promise<string[]> {
        const result = await new Promise<{package_msg: string, tx_results: {[wtxid: string]: {txid: string}}}>((resolve, reject) => {
            this.rpc.submitPackage(rawTxs, (err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });
        if(result.package_msg!=="success") throw new Error(
            result.package_msg+": "+Object.keys(result["tx-results"]).map(wtxid => result["tx-results"][wtxid].txid+"=\""+result["tx-results"][wtxid].error+"\"").join(", ")
        );
        return Object.keys(result["tx-results"]).map(wtxid => result["tx-results"][wtxid].txid);
    }

    sendRawTransaction(rawTx: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.rpc.sendRawTransaction(rawTx, (err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });
    }

    parseTransaction(rawTx: string): Promise<BtcTx> {
        const btcTx = Transaction.fromRaw(Buffer.from(rawTx, "hex"), {
            allowLegacyWitnessUtxo: true,
            allowUnknownInputs: true,
            allowUnknownOutputs: true,
            disableScriptCheck: true
        });
        return Promise.resolve(bitcoinTxToBtcTx(btcTx));
    }

    isSpent(utxo: string): Promise<boolean> {
        const [txId, vout] = utxo.split(":");
        return new Promise<boolean>((resolve, reject) => {
            this.rpc.getTxOut(txId, parseInt(vout), true, (err, info) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve(info.result==null);
            });
        });
    }

    private async getFeeRate(btcTx: BtcTx): Promise<FeeRateResponse> {
        if(btcTx.confirmations>0) return null;

        let totalIn = 0;
        const prevTxs: BtcTx[] = [];
        await Promise.all(btcTx.ins.map(async(txIn) => {
            const prevTx = await this.getTransaction(txIn.txid);
            totalIn += prevTx.outs[txIn.vout].value;
            prevTxs.push(prevTx);
        }));

        const txFee = totalIn - btcTx.outs.reduce((previousValue,currentValue) => previousValue+currentValue.value, 0);

        return {
            fee: txFee,
            vsize: btcTx.vsize,
            getEffectiveFeeRate: async (feeData?: {adjustedVsize: number, adjustedFee: number}) => {
                feeData ??= {adjustedVsize: btcTx.vsize, adjustedFee: txFee};
                const inputFees: FeeRateResponse[] = [];
                for(let prevTx of prevTxs) {
                    const res = await this.getFeeRate(prevTx);
                    if(res!=null) inputFees.push(res);
                }
                inputFees.sort((a, b) => (a.fee/a.vsize) - (b.fee/b.vsize));
                const toAdjust: FeeRateResponse[] = [];
                for(let inputFee of inputFees) {
                    if(inputFee.fee/inputFee.vsize < feeData.adjustedFee/feeData.adjustedVsize) {
                        feeData.adjustedFee += inputFee.fee;
                        feeData.adjustedVsize += inputFee.vsize;

                        toAdjust.push(inputFee);
                    } else {
                        const obj = {adjustedVsize: inputFee.vsize, adjustedFee: inputFee.fee};
                        await inputFee.getEffectiveFeeRate(obj);
                        if(obj.adjustedFee/obj.adjustedVsize < feeData.adjustedFee/feeData.adjustedVsize) {
                            feeData.adjustedFee += obj.adjustedFee;
                            feeData.adjustedVsize += obj.adjustedVsize;
                        }
                    }
                }
                for(let inputFee of toAdjust) {
                    await inputFee.getEffectiveFeeRate(feeData);
                }
                return {
                    ...feeData,
                    feeRate: feeData.adjustedFee/feeData.adjustedVsize
                };
            }
        };
    }

    async getEffectiveFeeRate(btcTx: BtcTx) {
        const res = await (await this.getFeeRate(btcTx)).getEffectiveFeeRate();
        return {
            fee: res.adjustedFee,
            vsize: res.adjustedVsize,
            feeRate: res.feeRate
        }
    }
}