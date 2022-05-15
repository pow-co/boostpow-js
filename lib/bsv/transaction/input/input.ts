'use strict'

var _ = require('../../util/_')
var $ = require('../../util/preconditions')
var errors = require('../../errors')
import {BufferWriter} from '../../encoding/bufferwriter'
import {BufferReader} from '../../encoding/bufferreader'
var buffer = require('buffer')
var JSUtil = require('../../util/javas')
import {Script} from '../../script'
import * as Sighash from './sighash'
import {Output} from '../output'

var MAXINT = 0xffffffff // Math.pow(2, 32) - 1;
var DEFAULT_RBF_SEQNUMBER = MAXINT - 2
var DEFAULT_SEQNUMBER = MAXINT
var DEFAULT_LOCKTIME_SEQNUMBER = MAXINT - 1

export interface input {
  prevTxId: string,
  outputIndex: number,
  sequenceNumber?: number,
  script: Script | string,
  output?: Output,
  scriptString?: string
}

export class Input {
  output: Output | undefined
  sequenceNumber: number
  prevTxId: Buffer
  outputIndex: number

  constructor(params: input) {
    this._fromObject(params)
  }

  static MAXINT = MAXINT
  static DEFAULT_SEQNUMBER = DEFAULT_SEQNUMBER
  static DEFAULT_LOCKTIME_SEQNUMBER = DEFAULT_LOCKTIME_SEQNUMBER
  static DEFAULT_RBF_SEQNUMBER = DEFAULT_RBF_SEQNUMBER
  // txid + output index + sequence number
  static BASE_SIZE = 32 + 4 + 4

  get script() {
    if (this.isNull()) {
      return null
    }
    if (!this._script) {
      this._script = new Script(this._scriptBuffer)
      this._script._isInput = true
    }
    return this._script
  }

  static fromObject(obj: input): Input {
    $.checkArgument(_.isObject(obj))
    var input = new Input()
    return input._fromObject(obj)
  }

  _fromObject(params: input) {
    var prevTxId
    if (_.isString(params.prevTxId) && JSUtil.isHexa(params.prevTxId)) {
      prevTxId = buffer.Buffer.from(params.prevTxId, 'hex')
    } else {
      prevTxId = params.prevTxId
    }
    this.output = params.output
      ? (params.output instanceof Output ? params.output : new Output(params.output)) : undefined
    this.prevTxId = prevTxId || params.txidbuf
    this.outputIndex = _.isUndefined(params.outputIndex) ? params.txoutnum : params.outputIndex
    this.sequenceNumber = _.isUndefined(params.sequenceNumber)
      ? (_.isUndefined(params.seqnum) ? DEFAULT_SEQNUMBER : params.seqnum) : params.sequenceNumber
    if (_.isUndefined(params.script) && _.isUndefined(params.scriptBuffer)) {
      throw new errors.Transaction.Input.MissingScript()
    }
    this.setScript(params.scriptBuffer || params.script)
    return this
  }

  toJSON(): input {
    var obj = {
      prevTxId: this.prevTxId.toString('hex'),
      outputIndex: this.outputIndex,
      sequenceNumber: this.sequenceNumber,
      script: this._scriptBuffer.toString('hex')
    }
    // add human readable form if input contains valid script
    if (this.script) {
      obj.scriptString = this.script.toString()
    }
    if (this.output) {
      obj.output = this.output.toObject()
    }
    return obj
  }

  toObject(): input {
    return this.toJSON()
  }

  static fromBufferReader(br: BufferReader) {
    var input = new Input()
    input.prevTxId = br.readReverse(32)
    input.outputIndex = br.readUInt32LE()
    input._scriptBuffer = br.readVarLengthBuffer()
    input.sequenceNumber = br.readUInt32LE()
    // TODO: return different classes according to which input it is
    // e.g: CoinbaseInput, PublicKeyHashInput, MultiSigScriptHashInput, etc.
    return input
  }

  toBufferWriter(writer): BufferWriter {
    if (!writer) {
      writer = new BufferWriter()
    }
    writer.writeReverse(this.prevTxId)
    writer.writeUInt32LE(this.outputIndex)
    var script = this._scriptBuffer
    writer.writeVarintNum(script.length)
    writer.write(script)
    writer.writeUInt32LE(this.sequenceNumber)
    return writer
  }

  setScript(script): Input {
    this._script = null
    if (script instanceof Script) {
      this._script = script
      this._script._isInput = true
      this._scriptBuffer = script.toBuffer()
    } else if (script === null) {
      this._script = Script.empty()
      this._script._isInput = true
      this._scriptBuffer = this._script.toBuffer()
    } else if (JSUtil.isHexa(script)) {
      // hex string script
      this._scriptBuffer = buffer.Buffer.from(script, 'hex')
    } else if (_.isString(script)) {
      // human readable string script
      this._script = new Script(script)
      this._script._isInput = true
      this._scriptBuffer = this._script.toBuffer()
    } else if (Buffer.isBuffer(script)) {
      // buffer script
      this._scriptBuffer = buffer.Buffer.from(script)
    } else {
      throw new TypeError('Invalid argument type: script')
    }
    return this
  }

  /**
   * Retrieve signatures for the provided PrivateKey.
   *
   * @param {Transaction} transaction - the transaction to be signed
   * @param {PrivateKey} privateKey - the private key to use when signing
   * @param {number} inputIndex - the index of this input in the provided transaction
   * @param {number} sigType - defaults to Signature.SIGHASH_ALL
   * @param {Buffer} addressHash - if provided, don't calculate the hash of the
   *     public key associated with the private key provided
   * @abstract
   */
  getSignatures() {
    throw new errors.AbstractMethodInvoked(
      'Trying to sign unsupported output type (only P2PKH and P2SH multisig inputs are supported)' +
      ' for input: ' + JSON.stringify(this)
    )
  }

  isFullySigned(): boolean {
    throw new errors.AbstractMethodInvoked('Input#isFullySigned')
  }

  isFinal(): boolean {
    return this.sequenceNumber === Input.MAXINT
  }

  addSignature() {
    throw new errors.AbstractMethodInvoked('Input#addSignature')
  }

  clearSignatures() {
    throw new errors.AbstractMethodInvoked('Input#clearSignatures')
  }

  isValidSignature(transaction, signature) {
    // FIXME: Refactor signature so this is not necessary
    signature.signature.nhashtype = signature.sigtype
    return Sighash.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      this.output.script,
      this.output.satoshisBN
    )
  }

  /**
   * @returns true if this is a coinbase input (represents no input)
   */
  isNull(): boolean {
    return this.prevTxId.toString('hex') === '0000000000000000000000000000000000000000000000000000000000000000' &&
      this.outputIndex === 0xffffffff
  }

  _estimateSize() {
    return this.toBufferWriter().toBuffer().length
  }
}
