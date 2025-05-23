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
exports.BitcoindRpc = void 0;
const BitcoindBlock_1 = require("./BitcoindBlock");
const BTCMerkleTree_1 = require("./BTCMerkleTree");
const RpcClient = require("@atomiqlabs/bitcoind-rpc");
const btc_signer_1 = require("@scure/btc-signer");
const buffer_1 = require("buffer");
const crypto_1 = require("crypto");
function bitcoinTxToBtcTx(btcTx) {
    return {
        locktime: btcTx.lockTime,
        version: btcTx.version,
        blockhash: null,
        confirmations: 0,
        txid: (0, crypto_1.createHash)("sha256").update((0, crypto_1.createHash)("sha256").update(btcTx.toBytes(true, false)).digest()).digest().reverse().toString("hex"),
        hex: buffer_1.Buffer.from(btcTx.toBytes(true, false)).toString("hex"),
        raw: buffer_1.Buffer.from(btcTx.toBytes(true, true)).toString("hex"),
        vsize: btcTx.isFinal ? btcTx.vsize : null,
        outs: Array.from({ length: btcTx.outputsLength }, (_, i) => i).map((index) => {
            const output = btcTx.getOutput(index);
            return {
                value: Number(output.amount),
                n: index,
                scriptPubKey: {
                    asm: btc_signer_1.Script.decode(output.script).map(val => typeof (val) === "object" ? buffer_1.Buffer.from(val).toString("hex") : val.toString()).join(" "),
                    hex: buffer_1.Buffer.from(output.script).toString("hex")
                }
            };
        }),
        ins: Array.from({ length: btcTx.inputsLength }, (_, i) => i).map(index => {
            const input = btcTx.getInput(index);
            return {
                txid: buffer_1.Buffer.from(input.txid).toString("hex"),
                vout: input.index,
                scriptSig: {
                    asm: btc_signer_1.Script.decode(input.finalScriptSig).map(val => typeof (val) === "object" ? buffer_1.Buffer.from(val).toString("hex") : val.toString()).join(" "),
                    hex: buffer_1.Buffer.from(input.finalScriptSig).toString("hex")
                },
                sequence: input.sequence,
                txinwitness: input.finalScriptWitness == null ? [] : input.finalScriptWitness.map(witness => buffer_1.Buffer.from(witness).toString("hex"))
            };
        })
    };
}
class BitcoindRpc {
    constructor(protocol, user, pass, host, port, timeout = 10 * 1000) {
        this.rpc = new RpcClient({
            protocol,
            user,
            pass,
            host,
            port: port.toString()
        });
        this.rpc.httpOptions = new Proxy({ signal: null }, {
            get() {
                return AbortSignal.timeout(timeout);
            },
        });
    }
    getTipHeight() {
        return __awaiter(this, void 0, void 0, function* () {
            const retrievedInfo = yield new Promise((resolve, reject) => {
                this.rpc.getBlockchainInfo((err, info) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(info.result);
                });
            });
            return retrievedInfo.blocks;
        });
    }
    getBlockHeader(blockhash) {
        return __awaiter(this, void 0, void 0, function* () {
            const retrievedHeader = yield new Promise((resolve, reject) => {
                this.rpc.getBlockHeader(blockhash, true, (err, info) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(info.result);
                });
            });
            return new BitcoindBlock_1.BitcoindBlock(retrievedHeader);
        });
    }
    isInMainChain(blockhash) {
        return __awaiter(this, void 0, void 0, function* () {
            const retrievedHeader = yield new Promise((resolve, reject) => {
                this.rpc.getBlockHeader(blockhash, true, (err, info) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(info.result);
                });
            });
            return retrievedHeader.confirmations > 0;
        });
    }
    getMerkleProof(txId, blockhash) {
        return __awaiter(this, void 0, void 0, function* () {
            return BTCMerkleTree_1.BTCMerkleTree.getTransactionMerkle(txId, blockhash, this.rpc);
        });
    }
    getTransaction(txId) {
        return __awaiter(this, void 0, void 0, function* () {
            const retrievedTx = yield new Promise((resolve, reject) => {
                this.rpc.getRawTransaction(txId, 1, (err, info) => {
                    if (err) {
                        if (err.code === -5) {
                            resolve(null);
                            return;
                        }
                        reject(err);
                        return;
                    }
                    resolve(info.result);
                });
            });
            if (retrievedTx == null)
                return null;
            //Strip witness data
            const btcTx = btc_signer_1.Transaction.fromRaw(buffer_1.Buffer.from(retrievedTx.hex, "hex"), {
                allowLegacyWitnessUtxo: true,
                allowUnknownInputs: true,
                allowUnknownOutputs: true,
                disableScriptCheck: true
            });
            const resultHex = buffer_1.Buffer.from(btcTx.toBytes(true, false)).toString("hex");
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
            };
        });
    }
    getBlockhash(height) {
        return new Promise((resolve, reject) => {
            this.rpc.getBlockHash(height, (err, info) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });
    }
    getBlockWithTransactions(blockhash) {
        return __awaiter(this, void 0, void 0, function* () {
            const block = yield new Promise((resolve, reject) => {
                this.rpc.getBlock(blockhash, 2, (err, info) => {
                    if (err) {
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
                        const btcTx = btc_signer_1.Transaction.fromRaw(buffer_1.Buffer.from(tx.hex, "hex"), {
                            allowLegacyWitnessUtxo: true,
                            allowUnknownInputs: true,
                            allowUnknownOutputs: true,
                            disableScriptCheck: true
                        });
                        resultHex = buffer_1.Buffer.from(btcTx.toBytes(true, false)).toString("hex");
                    }
                    catch (e) {
                        console.warn("Error parsing transaction " + tx.txid, e);
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
        });
    }
    getSyncInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const blockchainInfo = yield new Promise((resolve, reject) => {
                this.rpc.getBlockchainInfo((err, info) => {
                    if (err) {
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
            };
        });
    }
    sendRawPackage(rawTxs) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield new Promise((resolve, reject) => {
                this.rpc.submitPackage(rawTxs, (err, info) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(info.result);
                });
            });
            if (result.package_msg !== "success")
                throw new Error(result.package_msg + ": " + Object.keys(result["tx-results"]).map(wtxid => result["tx-results"][wtxid].txid + "=\"" + result["tx-results"][wtxid].error + "\"").join(", "));
            return Object.keys(result["tx-results"]).map(wtxid => result["tx-results"][wtxid].txid);
        });
    }
    sendRawTransaction(rawTx) {
        return new Promise((resolve, reject) => {
            this.rpc.sendRawTransaction(rawTx, (err, info) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(info.result);
            });
        });
    }
    parseTransaction(rawTx) {
        const btcTx = btc_signer_1.Transaction.fromRaw(buffer_1.Buffer.from(rawTx, "hex"), {
            allowLegacyWitnessUtxo: true,
            allowUnknownInputs: true,
            allowUnknownOutputs: true,
            disableScriptCheck: true
        });
        return Promise.resolve(bitcoinTxToBtcTx(btcTx));
    }
    isSpent(utxo) {
        const [txId, vout] = utxo.split(":");
        return new Promise((resolve, reject) => {
            this.rpc.getTxOut(txId, parseInt(vout), true, (err, info) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(info.result == null);
            });
        });
    }
    getFeeRate(btcTx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (btcTx.confirmations > 0)
                return null;
            let totalIn = 0;
            const prevTxs = [];
            yield Promise.all(btcTx.ins.map((txIn) => __awaiter(this, void 0, void 0, function* () {
                const prevTx = yield this.getTransaction(txIn.txid);
                totalIn += prevTx.outs[txIn.vout].value;
                prevTxs.push(prevTx);
            })));
            const txFee = totalIn - btcTx.outs.reduce((previousValue, currentValue) => previousValue + currentValue.value, 0);
            return {
                fee: txFee,
                vsize: btcTx.vsize,
                getEffectiveFeeRate: (feeData) => __awaiter(this, void 0, void 0, function* () {
                    feeData !== null && feeData !== void 0 ? feeData : (feeData = { adjustedVsize: btcTx.vsize, adjustedFee: txFee });
                    const inputFees = [];
                    for (let prevTx of prevTxs) {
                        const res = yield this.getFeeRate(prevTx);
                        if (res != null)
                            inputFees.push(res);
                    }
                    inputFees.sort((a, b) => (a.fee / a.vsize) - (b.fee / b.vsize));
                    const toAdjust = [];
                    for (let inputFee of inputFees) {
                        if (inputFee.fee / inputFee.vsize < feeData.adjustedFee / feeData.adjustedVsize) {
                            feeData.adjustedFee += inputFee.fee;
                            feeData.adjustedVsize += inputFee.vsize;
                            toAdjust.push(inputFee);
                        }
                        else {
                            const obj = { adjustedVsize: inputFee.vsize, adjustedFee: inputFee.fee };
                            yield inputFee.getEffectiveFeeRate(obj);
                            if (obj.adjustedFee / obj.adjustedVsize < feeData.adjustedFee / feeData.adjustedVsize) {
                                feeData.adjustedFee += obj.adjustedFee;
                                feeData.adjustedVsize += obj.adjustedVsize;
                            }
                        }
                    }
                    for (let inputFee of toAdjust) {
                        yield inputFee.getEffectiveFeeRate(feeData);
                    }
                    return Object.assign(Object.assign({}, feeData), { feeRate: feeData.adjustedFee / feeData.adjustedVsize });
                })
            };
        });
    }
    getEffectiveFeeRate(btcTx) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield (yield this.getFeeRate(btcTx)).getEffectiveFeeRate();
            return {
                fee: res.adjustedFee,
                vsize: res.adjustedVsize,
                feeRate: res.feeRate
            };
        });
    }
}
exports.BitcoindRpc = BitcoindRpc;
