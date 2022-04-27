'use strict'

var _ = require('../util/_')
import { BN } from '../crypto/bn'
var BufferReader = require('../encoding/bufferreader')
import { BufferWriter } from '../encoding/bufferwriter'
import { Hash } from '../crypto/hash'
var $ = require('../util/preconditions')

var GENESIS_BITS = 0x1d00ffff

export interface blockheader {
  hash?: any,
  version: any,
  prevHash: string | Buffer,
  merkleRoot: string | Buffer,
  time: any,
  bits: any,
  nonce: any
}

/**
 * Instantiate a BlockHeader from a Buffer, JSON object, or Object with
 * the properties of the BlockHeader
 *
 * @param {*} - A Buffer, JSON string, or Object
 * @returns {BlockHeader} - An instance of block header
 * @constructor
 */
export class BlockHeader {
  public version
  public prevHash
  public merkleRoot
  public time
  public bits
  public nonce
  public _id

  /**
  * @param {Object} - A JSON string
  * @returns {Object} - An object representing block header data
  * @private
  */
  static _fromObject(data: blockheader): blockheader {
    $.checkArgument(data, 'data is required')
    var prevHash: Buffer
    var merkleRoot: Buffer
    if (_.isString(data.prevHash)) {
      prevHash = Buffer.from(<string>data.prevHash, 'hex').reverse()
    } else {
      prevHash = <Buffer>data.prevHash
    }
    if (_.isString(data.merkleRoot)) {
      merkleRoot = Buffer.from(<string>data.merkleRoot, 'hex').reverse()
    } else {
      merkleRoot = <Buffer>data.merkleRoot
    }
    var info: blockheader = {
      hash: data.hash,
      version: data.version,
      prevHash: prevHash,
      merkleRoot: merkleRoot,
      time: data.time,
      bits: data.bits,
      nonce: data.nonce
    }
    return info
  }

  /**
   * @param {*} - A Buffer, JSON string or Object
   * @returns {Object} - An object representing block header data
   * @throws {TypeError} - If the argument was not recognized
   * @private
   */
  static _from(arg: Buffer | blockheader): blockheader {
    if (Buffer.isBuffer(arg)) {
      return BlockHeader._fromBufferReader(BufferReader(arg))
    } else if (_.isObject(arg)) {
      return BlockHeader._fromObject(arg)
    } else {
      throw new TypeError('Unrecognized argument for BlockHeader')
    }
  }

  constructor(arg: Buffer | blockheader) {
    var info: blockheader = BlockHeader._from(arg)

    this.version = info.version
    this.prevHash = info.prevHash
    this.merkleRoot = info.merkleRoot
    this.time = info.time
    this.bits = info.bits
    this.nonce = info.nonce

    if (info.hash) {
      $.checkState(
        this.hash === info.hash,
        'Argument object hash property does not match block hash.'
      )
    }

    return this
  }

  /**
   * @param {Object} - A plain JavaScript object
   * @returns {BlockHeader} - An instance of block header
   */
  static fromObject(obj): BlockHeader {
    var info = BlockHeader._fromObject(obj)
    return new BlockHeader(info)
  }

  /**
   * @param {Binary} - Raw block binary data or buffer
   * @returns {BlockHeader} - An instance of block header
   */
  static fromRawBlock(data): BlockHeader {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data, 'binary')
    }
    var br = BufferReader(data)
    br.pos = BlockHeader.Constants.START_OF_HEADER
    var info = BlockHeader._fromBufferReader(br)
    return new BlockHeader(info)
  }

  /**
   * @param {Buffer} - A buffer of the block header
   * @returns {BlockHeader} - An instance of block header
   */
  static fromBuffer(buf: Buffer): BlockHeader {
    var info = BlockHeader._fromBufferReader(BufferReader(buf))
    return new BlockHeader(info)
  }

  /**
   * @param {string} - A hex encoded buffer of the block header
   * @returns {BlockHeader} - An instance of block header
   */
  static fromString(str: string): BlockHeader {
    var buf = Buffer.from(str, 'hex')
    return BlockHeader.fromBuffer(buf)
  }

  /**
   * @param {BufferReader} - A BufferReader of the block header
   * @returns {Object} - An object representing block header data
   * @private
   */
  static _fromBufferReader(br): blockheader {
    var info: blockheader = {
      version: br.readInt32LE(),
      prevHash: br.read(32),
      merkleRoot: br.read(32),
      time: br.readUInt32LE(),
      bits: br.readUInt32LE(),
      nonce: br.readUInt32LE()
    }
    return info
  }

  /**
   * @param {BufferReader} - A BufferReader of the block header
   * @returns {BlockHeader} - An instance of block header
   */
  static fromBufferReader(br): BlockHeader {
    var info = BlockHeader._fromBufferReader(br)
    return new BlockHeader(info)
  }

  /**
   * @returns {Object} - A plain object of the BlockHeader
   */
  toJSON(): blockheader {
    return {
      hash: this.hash,
      version: this.version,
      prevHash: Buffer.from(this.prevHash).reverse().toString('hex'),
      merkleRoot: Buffer.from(this.merkleRoot).reverse().toString('hex'),
      time: this.time,
      bits: this.bits,
      nonce: this.nonce
    }
  }

  /**
   * @returns {Buffer} - A Buffer of the BlockHeader
   */
  toBuffer(): Buffer {
    return this.toBufferWriter().concat()
  }

  /**
   * @returns {string} - A hex encoded string of the BlockHeader
   */
  toString(): string {
    return this.toBuffer().toString('hex')
  }

  /**
   * @param {BufferWriter} - An existing instance BufferWriter
   * @returns {BufferWriter} - An instance of BufferWriter representation of the BlockHeader
   */
  toBufferWriter(bw?: BufferWriter) {
    if (!bw) {
      bw = new BufferWriter()
    }
    bw.writeInt32LE(this.version)
    bw.write(this.prevHash)
    bw.write(this.merkleRoot)
    bw.writeUInt32LE(this.time)
    bw.writeUInt32LE(this.bits)
    bw.writeUInt32LE(this.nonce)
    return bw
  }

  /**
   * Returns the target difficulty for this block
   * @param {Number} bits
   * @returns {BN} An instance of BN with the decoded difficulty bits
   */
  getTargetDifficulty(bits?:number): BN {
    if (!bits) bits = this.bits

    var target = new BN(bits & 0xffffff)
    var mov = 8 * ((bits >>> 24) - 3)
    while (mov-- > 0) {
      target = target.mul(new BN(2))
    }
    return target
  }

  /**
   * @link https://en.bitcoin.it/wiki/Difficulty
   * @return {Number}
   */
  getDifficulty(): number {
    var difficulty1TargetBN = this.getTargetDifficulty(GENESIS_BITS).mul(new BN(Math.pow(10, 8)))
    var currentTargetBN = this.getTargetDifficulty()

    var difficultyString = difficulty1TargetBN.div(currentTargetBN).toString(10)
    var decimalPos = difficultyString.length - 8
    difficultyString = difficultyString.slice(0, decimalPos) + '.' + difficultyString.slice(decimalPos)

    return parseFloat(difficultyString)
  }

  /**
   * @returns {Buffer} - The little endian hash buffer of the header
   */
  _getHash(): Buffer {
    var buf = this.toBuffer()
    return Hash.sha256sha256(buf)
  }

  get hash() {
    if (!this._id) {
      this._id = BufferReader(this._getHash()).readReverse().toString('hex')
    }
    return this._id
  }

  get id() {
    return this.hash()
  }

  /**
   * @returns {Boolean} - If timestamp is not too far in the future
   */
  validTimestamp(): boolean {
    var currentTime = Math.round(new Date().getTime() / 1000)
    if (this.time > currentTime + BlockHeader.Constants.MAX_TIME_OFFSET) {
      return false
    }
    return true
  }

  /**
   * @returns {Boolean} - If the proof-of-work hash satisfies the target difficulty
   */
  validProofOfWork(): boolean {
    var pow = new BN(this.id, 'hex')
    var target = this.getTargetDifficulty()

    if (pow.cmp(target) > 0) {
      return false
    }
    return true
  }

  /**
   * @returns {string} - A string formatted for the console
   */
  inspect() {
    return '<BlockHeader ' + this.id + '>'
  }

  static Constants = {
    START_OF_HEADER: 8, // Start buffer position in raw block data
    MAX_TIME_OFFSET: 2 * 60 * 60, // The max a timestamp can be in the future
    LARGEST_HASH: new BN('10000000000000000000000000000000000000000000000000000000000000000', 'hex')
  }

}
