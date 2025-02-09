"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitcoindBlock = void 0;
class BitcoindBlock {
    constructor(obj) {
        this.hash = obj.hash;
        this.confirmations = obj.confirmations;
        this.height = obj.height;
        this.version = obj.version;
        this.versionHex = obj.versionHex;
        this.merkleroot = obj.merkleroot;
        this.time = obj.time;
        this.mediantime = obj.mediantime;
        this.nonce = obj.nonce;
        this.bits = obj.bits;
        this.difficulty = obj.difficulty;
        this.chainwork = obj.chainwork;
        this.nTx = obj.nTx;
        this.previousblockhash = obj.previousblockhash;
        this.nextblockhash = obj.nextblockhash;
    }
    getHeight() {
        return this.height;
    }
    getHash() {
        return this.hash;
    }
    getMerkleRoot() {
        return this.merkleroot;
    }
    getNbits() {
        return Buffer.from(this.bits, "hex").readUint32BE();
    }
    getNonce() {
        return this.nonce;
    }
    getPrevBlockhash() {
        return this.previousblockhash;
    }
    getTimestamp() {
        return this.time;
    }
    getVersion() {
        return this.version;
    }
    getChainWork() {
        return Buffer.from(this.chainwork.padStart(64, "0"), "hex");
    }
}
exports.BitcoindBlock = BitcoindBlock;
