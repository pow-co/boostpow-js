'use strict'

import {Address} from '../address'
import {BufferReader} from '../encoding/bufferreader'
import {BufferWriter} from '../encoding/bufferwriter'
import {Hash} from '../crypto/hash'
import {Opcode} from '../opcode'
import {PublicKey} from '../publickey'
import {Signature} from '../crypto/signature'
import {Networks} from '../networks'
var $ = require('../util/preconditions')
var _ = require('../util/_')
var errors = require('../errors')
var buffer = require('buffer')
var JSUtil = require('../util/javas')

interface scriptJSON {
  chunks?: any[]
}

/**
 * A bitcoin transaction script. Each transaction's inputs and outputs
 * has a script that is evaluated to validate it's spending.
 *
 * See https://en.bitcoin.it/wiki/Script
 *
 * @constructor
 * @param {Object|string|Buffer=} from optional data to populate script
 */
export class Script {
  public chunks
  public _isOutput
  static types

  public OP_RETURN_STANDARD_SIZE: number = 220

  constructor(from ?: Buffer | Address | Script | string | scriptJSON ) {
    this.chunks = []

    if (!from) return

    if (Buffer.isBuffer(from)) {
      return Script.fromBuffer(from)
    } else if (from instanceof Address) {
      return Script.fromAddress(from)
    } else if (from instanceof Script) {
      return Script.fromBuffer(from.toBuffer())
    } else if (typeof from === 'string') {
      return Script.fromString(from)
    } else if (from.chunks) {
      this.set(<scriptJSON>from)
    }
/*
  Script.outputIdentifiers = {}
  Script.outputIdentifiers.PUBKEY_OUT = Script.prototype.isPublicKeyOut
  Script.outputIdentifiers.PUBKEYHASH_OUT = Script.prototype.isPublicKeyHashOut
  Script.outputIdentifiers.MULTISIG_OUT = Script.prototype.isMultisigOut
  Script.outputIdentifiers.SCRIPTHASH_OUT = Script.prototype.isScriptHashOut
  Script.outputIdentifiers.DATA_OUT = Script.prototype.isDataOut
  Script.outputIdentifiers.SAFE_DATA_OUT = Script.prototype.isSafeDataOut

  Script.inputIdentifiers = {}
  Script.inputIdentifiers.PUBKEY_IN = Script.prototype.isPublicKeyIn
  Script.inputIdentifiers.PUBKEYHASH_IN = Script.prototype.isPublicKeyHashIn
  Script.inputIdentifiers.MULTISIG_IN = Script.prototype.isMultisigIn
  Script.inputIdentifiers.SCRIPTHASH_IN = Script.prototype.isScriptHashIn*/
  }

  set(obj: Script) {
    $.checkArgument(_.isObject(obj))
    $.checkArgument(_.isArray(obj.chunks))
    this.chunks = obj.chunks
    return this
  }

  static fromBuffer(buffer: Buffer): Script {
    var script = new Script()
    script.chunks = []

    var br = new BufferReader(buffer)
    while (!br.finished()) {
      try {
        var opcodenum = br.readUInt8()

        var len, buf
        if (opcodenum > 0 && opcodenum < Opcode.OP_PUSHDATA1) {
          len = opcodenum
          script.chunks.push({
            buf: br.read(len),
            len: len,
            opcodenum: opcodenum
          })
        } else if (opcodenum === Opcode.OP_PUSHDATA1) {
          len = br.readUInt8()
          buf = br.read(len)
          script.chunks.push({
            buf: buf,
            len: len,
            opcodenum: opcodenum
          })
        } else if (opcodenum === Opcode.OP_PUSHDATA2) {
          len = br.readUInt16LE()
          buf = br.read(len)
          script.chunks.push({
            buf: buf,
            len: len,
            opcodenum: opcodenum
          })
        } else if (opcodenum === Opcode.OP_PUSHDATA4) {
          len = br.readUInt32LE()
          buf = br.read(len)
          script.chunks.push({
            buf: buf,
            len: len,
            opcodenum: opcodenum
          })
        } else {
          script.chunks.push({
            opcodenum: opcodenum
          })
        }
      } catch (e) {
        if (e instanceof RangeError) {
          throw new errors.Script.InvalidBuffer(buffer.toString('hex'))
        }
        throw e
      }
    }

    return script
  }

  toBuffer(): Buffer {
    var bw = new BufferWriter()

    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i]
      var opcodenum = chunk.opcodenum
      bw.writeUInt8(chunk.opcodenum)
      if (chunk.buf) {
        if (opcodenum < Opcode.OP_PUSHDATA1) {
          bw.write(chunk.buf)
        } else if (opcodenum === Opcode.OP_PUSHDATA1) {
          bw.writeUInt8(chunk.len)
          bw.write(chunk.buf)
        } else if (opcodenum === Opcode.OP_PUSHDATA2) {
          bw.writeUInt16LE(chunk.len)
          bw.write(chunk.buf)
        } else if (opcodenum === Opcode.OP_PUSHDATA4) {
          bw.writeUInt32LE(chunk.len)
          bw.write(chunk.buf)
        }
      }
    }

    return bw.concat()
  }

  static fromASM(str: string): Script {
    var script = new Script()
    script.chunks = []

    var tokens = str.split(' ')
    var i = 0
    while (i < tokens.length) {
      var token = tokens[i]
      var opcode = new Opcode(token)
      var opcodenum = opcode.toNumber()

      // we start with two special cases, 0 and -1, which are handled specially in
      // toASM. see _chunkToString.
      if (token === '0') {
        opcodenum = 0
        script.chunks.push({
          opcodenum: opcodenum
        })
        i = i + 1
      } else if (token === '-1') {
        opcodenum = Opcode.OP_1NEGATE
        script.chunks.push({
          opcodenum: opcodenum
        })
        i = i + 1
      } else if (_.isUndefined(opcodenum)) {
        var buf = Buffer.from(tokens[i], 'hex')
        if (buf.toString('hex') !== tokens[i]) {
          throw new Error('invalid hex string in script')
        }
        var len = buf.length
        if (len >= 0 && len < Opcode.OP_PUSHDATA1) {
          opcodenum = len
        } else if (len < Math.pow(2, 8)) {
          opcodenum = Opcode.OP_PUSHDATA1
        } else if (len < Math.pow(2, 16)) {
          opcodenum = Opcode.OP_PUSHDATA2
        } else if (len < Math.pow(2, 32)) {
          opcodenum = Opcode.OP_PUSHDATA4
        }
        script.chunks.push({
          buf: buf,
          len: buf.length,
          opcodenum: opcodenum
        })
        i = i + 1
      } else {
        script.chunks.push({
          opcodenum: opcodenum
        })
        i = i + 1
      }
    }
    return script
  }

  static fromHex(str: string): Script {
    return new Script(buffer.Buffer.from(str, 'hex'))
  }

  static fromString(str: string): Script {
    if (JSUtil.isHexa(str) || str.length === 0) {
      return new Script(buffer.Buffer.from(str, 'hex'))
    }
    var script = new Script()
    script.chunks = []

    var tokens = str.split(' ')
    var i = 0
    while (i < tokens.length) {
      var token = tokens[i]
      var opcode = new Opcode(token)
      var opcodenum = opcode.toNumber()

      if (_.isUndefined(opcodenum)) {
        opcodenum = parseInt(token)
        if (opcodenum > 0 && opcodenum < Opcode.OP_PUSHDATA1) {
          script.chunks.push({
            buf: Buffer.from(tokens[i + 1].slice(2), 'hex'),
            len: opcodenum,
            opcodenum: opcodenum
          })
          i = i + 2
        } else {
          throw new Error('Invalid script: ' + JSON.stringify(str))
        }
      } else if (opcodenum === Opcode.OP_PUSHDATA1 ||
        opcodenum === Opcode.OP_PUSHDATA2 ||
        opcodenum === Opcode.OP_PUSHDATA4) {
        if (tokens[i + 2].slice(0, 2) !== '0x') {
          throw new Error('Pushdata data must start with 0x')
        }
        script.chunks.push({
          buf: Buffer.from(tokens[i + 2].slice(2), 'hex'),
          len: parseInt(tokens[i + 1]),
          opcodenum: opcodenum
        })
        i = i + 3
      } else {
        script.chunks.push({
          opcodenum: opcodenum
        })
        i = i + 1
      }
    }
    return script
  }

  _chunkToString(chunk, type?: string): string {
    var opcodenum = chunk.opcodenum
    var asm = (type === 'asm')
    var str = ''
    if (!chunk.buf) {
      // no data chunk
      if (typeof Opcode.reverseMap[opcodenum] !== 'undefined') {
        if (asm) {
          // A few cases where the opcode name differs from reverseMap
          // aside from 1 to 16 data pushes.
          if (opcodenum === 0) {
            // OP_0 -> 0
            str = str + ' 0'
          } else if (opcodenum === 79) {
            // OP_1NEGATE -> 1
            str = str + ' -1'
          } else {
            str = str + ' ' + new Opcode(opcodenum).toString()
          }
        } else {
          str = str + ' ' + new Opcode(opcodenum).toString()
        }
      } else {
        var numstr = opcodenum.toString(16)
        if (numstr.length % 2 !== 0) {
          numstr = '0' + numstr
        }
        if (asm) {
          str = str + ' ' + numstr
        } else {
          str = str + ' ' + '0x' + numstr
        }
      }
    } else {
      // data chunk
      if (!asm && (opcodenum === Opcode.OP_PUSHDATA1 ||
        opcodenum === Opcode.OP_PUSHDATA2 ||
        opcodenum === Opcode.OP_PUSHDATA4)) {
        str = str + ' ' + Opcode(opcodenum).toString()
      }
      if (chunk.len > 0) {
        if (asm) {
          str = str + ' ' + chunk.buf.toString('hex')
        } else {
          str = str + ' ' + chunk.len + ' ' + '0x' + chunk.buf.toString('hex')
        }
      }
    }
    return str
  }

  toASM(): string {
    var str = ''
    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i]
      str += this._chunkToString(chunk, 'asm')
    }

    return str.substr(1)
  }

  toString(): string {
    var str = ''
    for (var i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i]
      str += this._chunkToString(chunk)
    }

    return str.substr(1)
  }

  toHex(): string {
    return this.toBuffer().toString('hex')
  }

  inspect(): string {
    return '<Script: ' + this.toString() + '>'
  }

  // script classification methods

  /**
   * @returns {boolean} if this is a pay to pubkey hash output script
   */
  isPublicKeyHashOut(): boolean {
    return !!(this.chunks.length === 5 &&
      this.chunks[0].opcodenum === Opcode.OP_DUP &&
      this.chunks[1].opcodenum === Opcode.OP_HASH160 &&
      this.chunks[2].buf &&
      this.chunks[2].buf.length === 20 &&
      this.chunks[3].opcodenum === Opcode.OP_EQUALVERIFY &&
      this.chunks[4].opcodenum === Opcode.OP_CHECKSIG)
  }

  /**
   * @returns {boolean} if this is a pay to public key hash input script
   */
  isPublicKeyHashIn(): boolean {
    if (this.chunks.length === 2) {
      var signatureBuf = this.chunks[0].buf
      var pubkeyBuf = this.chunks[1].buf
      if (signatureBuf &&
        signatureBuf.length &&
        signatureBuf[0] === 0x30 &&
        pubkeyBuf &&
        pubkeyBuf.length
      ) {
        var version = pubkeyBuf[0]
        if ((version === 0x04 ||
          version === 0x06 ||
          version === 0x07) && pubkeyBuf.length === 65) {
          return true
        } else if ((version === 0x03 || version === 0x02) && pubkeyBuf.length === 33) {
          return true
        }
      }
    }
    return false
  }

  getPublicKey() {
    $.checkState(this.isPublicKeyOut(), 'Can\'t retrieve PublicKey from a non-PK output')
    return this.chunks[0].buf
  }

  getPublicKeyHash() {
    $.checkState(this.isPublicKeyHashOut(), 'Can\'t retrieve PublicKeyHash from a non-PKH output')
    return this.chunks[2].buf
  }

  /**
   * @returns {boolean} if this is a public key output script
   */
  isPublicKeyOut(): boolean {
    if (this.chunks.length === 2 &&
      this.chunks[0].buf &&
      this.chunks[0].buf.length &&
      this.chunks[1].opcodenum === Opcode.OP_CHECKSIG) {
      var pubkeyBuf = this.chunks[0].buf
      var version = pubkeyBuf[0]
      var isVersion = false
      if ((version === 0x04 ||
        version === 0x06 ||
        version === 0x07) && pubkeyBuf.length === 65) {
        isVersion = true
      } else if ((version === 0x03 || version === 0x02) && pubkeyBuf.length === 33) {
        isVersion = true
      }
      if (isVersion) {
        return PublicKey.isValid(pubkeyBuf)
      }
    }
    return false
  }

  /**
   * @returns {boolean} if this is a pay to public key input script
   */
  isPublicKeyIn(): boolean {
    if (this.chunks.length === 1) {
      var signatureBuf = this.chunks[0].buf
      if (signatureBuf &&
        signatureBuf.length &&
        signatureBuf[0] === 0x30) {
        return true
      }
    }
    return false
  }

  /**
   * @returns {boolean} if this is a p2sh output script
   */
  isScriptHashOut(): boolean {
    var buf = this.toBuffer()
    return (buf.length === 23 &&
      buf[0] === Opcode.OP_HASH160 &&
      buf[1] === 0x14 &&
      buf[buf.length - 1] === Opcode.OP_EQUAL)
  }

  /**
   * @returns {boolean} if this is a p2sh input script
   * Note that these are frequently indistinguishable from pubkeyhashin
   */
  isScriptHashIn(): boolean {
    if (this.chunks.length <= 1) {
      return false
    }
    var redeemChunk = this.chunks[this.chunks.length - 1]
    var redeemBuf = redeemChunk.buf
    if (!redeemBuf) {
      return false
    }

    var redeemScript
    try {
      redeemScript = Script.fromBuffer(redeemBuf)
    } catch (e) {
      if (e instanceof errors.Script.InvalidBuffer) {
        return false
      }
      throw e
    }
    var type = redeemScript.classify()
    return type !== Script.types.UNKNOWN
  }

  /**
   * @returns {boolean} if this is a mutlsig output script
   */
  isMultisigOut(): boolean {
    return (this.chunks.length > 3 &&
      Opcode.isSmallIntOp(this.chunks[0].opcodenum) &&
      this.chunks.slice(1, this.chunks.length - 2).every(function (obj) {
        return obj.buf && Buffer.isBuffer(obj.buf)
      }) &&
      Opcode.isSmallIntOp(this.chunks[this.chunks.length - 2].opcodenum) &&
      this.chunks[this.chunks.length - 1].opcodenum === Opcode.OP_CHECKMULTISIG)
  }

  /**
   * @returns {boolean} if this is a multisig input script
   */
  isMultisigIn(): boolean {
    return this.chunks.length >= 2 &&
      this.chunks[0].opcodenum === 0 &&
      this.chunks.slice(1, this.chunks.length).every(function (obj) {
        return obj.buf &&
          Buffer.isBuffer(obj.buf) &&
          Signature.isTxDER(obj.buf)
      })
  }

  /**
   * @returns {boolean} true if this is a valid standard OP_RETURN output
   */
  isDataOut(): boolean {
    var step1 = this.chunks.length >= 1 &&
      this.chunks[0].opcodenum === Opcode.OP_RETURN
    if (!step1) return false
    var chunks = this.chunks.slice(1)
    var script2 = new Script({ chunks: chunks })
    return script2.isPushOnly()
  }

  isSafeDataOut(): boolean {
    if (this.chunks.length < 2) {
      return false
    }
    if (this.chunks[0].opcodenum !== Opcode.OP_FALSE) {
      return false
    }
    var chunks = this.chunks.slice(1)
    var script2 = new Script({ chunks })
    return script2.isDataOut()
  }

  /**
   * Retrieve the associated data for this script.
   * In the case of a pay to public key hash or P2SH, return the hash.
   * In the case of safe OP_RETURN data, return an array of buffers
   * In the case of a standard deprecated OP_RETURN, return the data
   * @returns {Buffer}
   */
  getData(): Buffer {
    if (this.isSafeDataOut()) {
      var chunks = this.chunks.slice(2)
      var buffers = chunks.map(chunk => chunk.buf)
      return buffers
    }
    if (this.isDataOut() || this.isScriptHashOut()) {
      if (_.isUndefined(this.chunks[1])) {
        return Buffer.alloc(0)
      } else {
        return Buffer.from(this.chunks[1].buf)
      }
    }
    if (this.isPublicKeyHashOut()) {
      return Buffer.from(this.chunks[2].buf)
    }
    throw new Error('Unrecognized script type to get data from')
  }

  /**
   * @returns {boolean} if the script is only composed of data pushing
   * opcodes or small int opcodes (OP_0, OP_1, ..., OP_16)
   */
  isPushOnly(): boolean {
    return _.every(this.chunks, function (chunk) {
      return chunk.opcodenum <= Opcode.OP_16 ||
        chunk.opcodenum === Opcode.OP_PUSHDATA1 ||
        chunk.opcodenum === Opcode.OP_PUSHDATA2 ||
        chunk.opcodenum === Opcode.OP_PUSHDATA4
    })
  }

  /**
   * @returns {object} The Script type if it is a known form,
   * or Script.UNKNOWN if it isn't
   */
  classify() {
    if (this._isInput) {
      return this.classifyInput()
    } else if (this._isOutput) {
      return this.classifyOutput()
    } else {
      var outputType = this.classifyOutput()
      return outputType !== Script.types.UNKNOWN ? outputType : this.classifyInput()
    }
  }

  /**
   * @returns {object} The Script type if it is a known form,
   * or Script.UNKNOWN if it isn't
   */
  classifyOutput() {
    for (var type in Script.outputIdentifiers) {
      if (Script.outputIdentifiers[type].bind(this)()) {
        return Script.types[type]
      }
    }
    return Script.types.UNKNOWN
  }

  /**
   * @returns {object} The Script type if it is a known form,
   * or Script.UNKNOWN if it isn't
   */
  classifyInput() {
    for (var type in Script.inputIdentifiers) {
      if (Script.inputIdentifiers[type].bind(this)()) {
        return Script.types[type]
      }
    }
    return Script.types.UNKNOWN
  }

  /**
   * @returns {boolean} if script is one of the known types
   */
  isStandard() {
    // TODO: Add BIP62 compliance
    return this.classify() !== Script.types.UNKNOWN
  }

  // Script construction methods

  /**
   * Adds a script element at the start of the script.
   * @param {*} obj a string, number, Opcode, Buffer, or object to add
   * @returns {Script} this script instance
   */
  prepend(obj) {
    this._addByType(obj, true)
    return this
  }

  /**
   * Compares a script with another script
   */
  equals(script: Script): boolean {
    $.checkState(script instanceof Script, 'Must provide another script')
    if (this.chunks.length !== script.chunks.length) {
      return false
    }
    var i
    for (i = 0; i < this.chunks.length; i++) {
      if (Buffer.isBuffer(this.chunks[i].buf) && !Buffer.isBuffer(script.chunks[i].buf)) {
        return false
      }
      if (Buffer.isBuffer(this.chunks[i].buf) && !this.chunks[i].buf.equals(script.chunks[i].buf)) {
        return false
      } else if (this.chunks[i].opcodenum !== script.chunks[i].opcodenum) {
        return false
      }
    }
    return true
  }

  /**
   * Adds a script element to the end of the script.
   *
   * @param {*} obj a string, number, Opcode, Buffer, or object to add
   * @returns {Script} this script instance
   *
   */
  add(obj) {
    this._addByType(obj, false)
    return this
  }

  _addByType(obj, prepend) {
    if (typeof obj === 'string') {
      this._addOpcode(obj, prepend)
    } else if (typeof obj === 'number') {
      this._addOpcode(obj, prepend)
    } else if (obj instanceof Opcode) {
      this._addOpcode(obj, prepend)
    } else if (Buffer.isBuffer(obj)) {
      this._addBuffer(obj, prepend)
    } else if (obj instanceof Script) {
      this.chunks = this.chunks.concat(obj.chunks)
    } else if (typeof obj === 'object') {
      this._insertAtPosition(obj, prepend)
    } else {
      throw new Error('Invalid script chunk')
    }
  }

  _insertAtPosition(op, prepend) {
    if (prepend) {
      this.chunks.unshift(op)
    } else {
      this.chunks.push(op)
    }
  }

  _addOpcode(opcode, prepend) {
    var op
    if (typeof opcode === 'number') {
      op = opcode
    } else if (opcode instanceof Opcode) {
      op = opcode.toNumber()
    } else {
      op = Opcode(opcode).toNumber()
    }
    this._insertAtPosition({
      opcodenum: op
    }, prepend)
    return this
  }

  _addBuffer(buf, prepend) {
    var opcodenum
    var len = buf.length
    if (len >= 0 && len < Opcode.OP_PUSHDATA1) {
      opcodenum = len
    } else if (len < Math.pow(2, 8)) {
      opcodenum = Opcode.OP_PUSHDATA1
    } else if (len < Math.pow(2, 16)) {
      opcodenum = Opcode.OP_PUSHDATA2
    } else if (len < Math.pow(2, 32)) {
      opcodenum = Opcode.OP_PUSHDATA4
    } else {
      throw new Error('You can\'t push that much data')
    }
    this._insertAtPosition({
      buf: buf,
      len: len,
      opcodenum: opcodenum
    }, prepend)
    return this
  }

  removeCodeseparators() {
    var chunks = []
    for (var i = 0; i < this.chunks.length; i++) {
      if (this.chunks[i].opcodenum !== Opcode.OP_CODESEPARATOR) {
        chunks.push(this.chunks[i])
      }
    }
    this.chunks = chunks
    return this
  }

  // high level script builder methods

  /**
   * @returns {Script} a new Multisig output script for given public keys,
   * requiring m of those public keys to spend
   * @param {PublicKey[]} publicKeys - list of all public keys controlling the output
   * @param {number} threshold - amount of required signatures to spend the output
   * @param {Object=} opts - Several options:
   *        - noSorting: defaults to false, if true, don't sort the given
   *                      public keys before creating the script
   */
  static buildMultisigOut(publicKeys, threshold, opts): Script {
    $.checkArgument(threshold <= publicKeys.length,
      'Number of required signatures must be less than or equal to the number of public keys')
    opts = opts || {}
    var script = new Script()
    script.add(Opcode.smallInt(threshold))
    publicKeys = _.map(publicKeys, PublicKey)
    var sorted = publicKeys
    if (!opts.noSorting) {
      sorted = publicKeys.map(k => k.toString('hex')).sort().map(k => new PublicKey(k))
    }
    for (var i = 0; i < sorted.length; i++) {
      var publicKey = sorted[i]
      script.add(publicKey.toBuffer())
    }
    script.add(Opcode.smallInt(publicKeys.length))
    script.add(Opcode.OP_CHECKMULTISIG)
    return script
  }

  /**
   * A new Multisig input script for the given public keys, requiring m of those public keys to spend
   *
   * @param {PublicKey[]} pubkeys list of all public keys controlling the output
   * @param {number} threshold amount of required signatures to spend the output
   * @param {Array} signatures and array of signature buffers to append to the script
   * @param {Object=} opts
   * @param {boolean=} opts.noSorting don't sort the given public keys before creating the script (false by default)
   * @param {Script=} opts.cachedMultisig don't recalculate the redeemScript
   *
   * @returns {Script}
   */
  static buildMultisigIn(pubkeys, threshold, signatures): Script {
    $.checkArgument(_.isArray(pubkeys))
    $.checkArgument(_.isNumber(threshold))
    $.checkArgument(_.isArray(signatures))

    var s = new Script()
    s.add(Opcode.OP_0)
    _.each(signatures, function (signature) {
      $.checkArgument(Buffer.isBuffer(signature), 'Signatures must be an array of Buffers')
      // TODO: allow signatures to be an array of Signature objects
      s.add(signature)
    })
    return s
  }

  /**
   * A new P2SH Multisig input script for the given public keys, requiring m of those public keys to spend
   *
   * @param {PublicKey[]} pubkeys list of all public keys controlling the output
   * @param {number} threshold amount of required signatures to spend the output
   * @param {Array} signatures and array of signature buffers to append to the script
   * @param {Object=} opts
   * @param {boolean=} opts.noSorting don't sort the given public keys before creating the script (false by default)
   * @param {Script=} opts.cachedMultisig don't recalculate the redeemScript
   *
   * @returns {Script}
   */
  static buildP2SHMultisigIn(pubkeys, threshold, signatures, opts): Script {
    $.checkArgument(_.isArray(pubkeys))
    $.checkArgument(_.isNumber(threshold))
    $.checkArgument(_.isArray(signatures))
    opts = opts || {}
    var s = new Script()
    s.add(Opcode.OP_0)
    _.each(signatures, function (signature) {
      $.checkArgument(Buffer.isBuffer(signature), 'Signatures must be an array of Buffers')
      // TODO: allow signatures to be an array of Signature objects
      s.add(signature)
    })
    s.add((opts.cachedMultisig || Script.buildMultisigOut(pubkeys, threshold, opts)).toBuffer())
    return s
  }

  /**
   * @returns {Script} a new pay to public key hash output for the given
   * address or public key
   * @param {(Address|PublicKey)} to - destination address or public key
   */
  static buildPublicKeyHashOut(to): Script {
    $.checkArgument(!_.isUndefined(to))
    $.checkArgument(to instanceof PublicKey || to instanceof Address || _.isString(to))
    if (to instanceof PublicKey) {
      to = to.toAddress()
    } else if (_.isString(to)) {
      to = new Address(to)
    }
    var s = new Script()
    s.add(Opcode.OP_DUP)
      .add(Opcode.OP_HASH160)
      .add(to.hashBuffer)
      .add(Opcode.OP_EQUALVERIFY)
      .add(Opcode.OP_CHECKSIG)
    s._network = to.network
    return s
  }

  /**
   * @returns {Script} a new pay to public key output for the given
   *  public key
   */
  static buildPublicKeyOut(pubkey): Script {
    $.checkArgument(pubkey instanceof PublicKey)
    var s = new Script()
    s.add(pubkey.toBuffer())
      .add(Opcode.OP_CHECKSIG)
    return s
  }

  /**
   * @returns {Script} a new OP_RETURN script with data
   * @param {(string|Buffer|Array)} data - the data to embed in the output - it is a string, buffer, or array of strings or buffers
   * @param {(string)} encoding - the type of encoding of the string(s)
   */
  static buildDataOut(data, encoding?: string): Script {
    $.checkArgument(_.isUndefined(data) || _.isString(data) || _.isArray(data) || Buffer.isBuffer(data))
    var datas = data
    if (!_.isArray(datas)) {
      datas = [data]
    }
    var s = new Script()
    s.add(Opcode.OP_RETURN)
    for (let data of datas) {
      $.checkArgument(_.isUndefined(data) || _.isString(data) || Buffer.isBuffer(data))
      if (_.isString(data)) {
        data = Buffer.from(data, encoding)
      }
      if (!_.isUndefined(data)) {
        s.add(data)
      }
    }
    return s
  }

  /**
   * @returns {Script} a new OP_RETURN script with data
   * @param {(string|Buffer|Array)} data - the data to embed in the output - it is a string, buffer, or array of strings or buffers
   * @param {(string)} encoding - the type of encoding of the string(s)
   */
  static buildSafeDataOut(data, encoding?: string): Script {
    var s2 = Script.buildDataOut(data, encoding)
    var s1 = new Script()
    s1.add(Opcode.OP_FALSE)
    s1.add(s2)
    return s1
  }

  /**
   * @param {Script|Address} script - the redeemScript for the new p2sh output.
   *    It can also be a p2sh address
   * @returns {Script} new pay to script hash script for given script
   */
  static buildScriptHashOut(script): Script {
    $.checkArgument(script instanceof Script ||
      (script instanceof Address && script.isPayToScriptHash()))
    var s = new Script()
    s.add(Opcode.OP_HASH160)
      .add(script instanceof Address ? script.hashBuffer : Hash.sha256ripemd160(script.toBuffer()))
      .add(Opcode.OP_EQUAL)

    s._network = script._network || script.network
    return s
  }

  /**
   * Builds a scriptSig (a script for an input) that signs a public key output script.
   *
   * @param {Signature|Buffer} signature - a Signature object, or the signature in DER canonical encoding
   * @param {number=} sigtype - the type of the signature (defaults to SIGHASH_ALL)
   */
  static buildPublicKeyIn(signature, sigtype): Script {
    $.checkArgument(signature instanceof Signature || Buffer.isBuffer(signature))
    $.checkArgument(_.isUndefined(sigtype) || _.isNumber(sigtype))
    if (signature instanceof Signature) {
      signature = signature.toBuffer()
    }
    var script = new Script()
    script.add(Buffer.concat([
      signature,
      Buffer.from([(sigtype || Signature.SIGHASH_ALL) & 0xff])
    ]))
    return script
  }

  /**
   * Builds a scriptSig (a script for an input) that signs a public key hash
   * output script.
   *
   * @param {Buffer|string|PublicKey} publicKey
   * @param {Signature|Buffer} signature - a Signature object, or the signature in DER canonical encoding
   * @param {number=} sigtype - the type of the signature (defaults to SIGHASH_ALL)
   */
  static buildPublicKeyHashIn(publicKey, signature, sigtype): Script {
    $.checkArgument(signature instanceof Signature || Buffer.isBuffer(signature))
    $.checkArgument(_.isUndefined(sigtype) || _.isNumber(sigtype))
    if (signature instanceof Signature) {
      signature = signature.toBuffer()
    }
    var script = new Script()
      .add(Buffer.concat([
        signature,
        Buffer.from([(sigtype || Signature.SIGHASH_ALL) & 0xff])
      ]))
      .add(new PublicKey(publicKey).toBuffer())
    return script
  }

  /**
   * @returns {Script} an empty script
   */
  static empty(): Script {
    return new Script()
  }

  /**
   * @returns {Script} a new pay to script hash script that pays to this script
   */
  toScriptHashOut(): Script {
    return Script.buildScriptHashOut(this)
  }

  /**
   * @return {Script} an output script built from the address
   */
  static fromAddress(address): Script {
    address = Address(address)
    if (address.isPayToScriptHash()) {
      return Script.buildScriptHashOut(address)
    } else if (address.isPayToPublicKeyHash()) {
      return Script.buildPublicKeyHashOut(address)
    }
    throw new errors.Script.UnrecognizedAddress(address)
  }

  /**
   * Will return the associated address information object
   * @return {Address|boolean}
   */
  getAddressInfo() {
    if (this._isInput) {
      return this._getInputAddressInfo()
    } else if (this._isOutput) {
      return this._getOutputAddressInfo()
    } else {
      var info = this._getOutputAddressInfo()
      if (!info) {
        return this._getInputAddressInfo()
      }
      return info
    }
  }

  /**
   * Will return the associated output scriptPubKey address information object
   * @return {Address|boolean}
   * @private
   */
  _getOutputAddressInfo() {
    var info = {}
    if (this.isScriptHashOut()) {
      info.hashBuffer = this.getData()
      info.type = Address.PayToScriptHash
    } else if (this.isPublicKeyHashOut()) {
      info.hashBuffer = this.getData()
      info.type = Address.PayToPublicKeyHash
    } else {
      return false
    }
    return info
  }

  /**
   * Will return the associated input scriptSig address information object
   * @return {Address|boolean}
   * @private
   */
  _getInputAddressInfo() {
    var info = {}
    if (this.isPublicKeyHashIn()) {
      // hash the publickey found in the scriptSig
      info.hashBuffer = Hash.sha256ripemd160(this.chunks[1].buf)
      info.type = Address.PayToPublicKeyHash
    } else if (this.isScriptHashIn()) {
      // hash the redeemscript found at the end of the scriptSig
      info.hashBuffer = Hash.sha256ripemd160(this.chunks[this.chunks.length - 1].buf)
      info.type = Address.PayToScriptHash
    } else {
      return false
    }
    return info
  }

  /**
   * @param {Network=} network
   * @return {Address|boolean} the associated address for this script if possible, or false
   */
  toAddress(network) {
    var info = this.getAddressInfo()
    if (!info) {
      return false
    }
    info.network = Networks.get(network) || this._network || Networks.defaultNetwork
    return new Address(info)
  }

  /**
   * Analogous to bitcoind's FindAndDelete. Find and delete equivalent chunks,
   * typically used with push data chunks.  Note that this will find and delete
   * not just the same data, but the same data with the same push data op as
   * produced by default. i.e., if a pushdata in a tx does not use the minimal
   * pushdata op, then when you try to remove the data it is pushing, it will not
   * be removed, because they do not use the same pushdata op.
   */
  findAndDelete(script) {
    var buf = script.toBuffer()
    var hex = buf.toString('hex')
    for (var i = 0; i < this.chunks.length; i++) {
      var script2 = Script({
        chunks: [this.chunks[i]]
      })
      var buf2 = script2.toBuffer()
      var hex2 = buf2.toString('hex')
      if (hex === hex2) {
        this.chunks.splice(i, 1)
      }
    }
    return this
  }

  /**
   * Comes from bitcoind's script interpreter CheckMinimalPush function
   * @returns {boolean} if the chunk {i} is the smallest way to push that particular data.
   */
  checkMinimalPush(i) {
    var chunk = this.chunks[i]
    var buf = chunk.buf
    var opcodenum = chunk.opcodenum
    if (!buf) {
      return true
    }
    if (buf.length === 0) {
      // Could have used OP_0.
      return opcodenum === Opcode.OP_0
    } else if (buf.length === 1 && buf[0] >= 1 && buf[0] <= 16) {
      // Could have used OP_1 .. OP_16.
      return opcodenum === Opcode.OP_1 + (buf[0] - 1)
    } else if (buf.length === 1 && buf[0] === 0x81) {
      // Could have used OP_1NEGATE
      return opcodenum === Opcode.OP_1NEGATE
    } else if (buf.length <= 75) {
      // Could have used a direct push (opcode indicating number of bytes pushed + those bytes).
      return opcodenum === buf.length
    } else if (buf.length <= 255) {
      // Could have used OP_PUSHDATA.
      return opcodenum === Opcode.OP_PUSHDATA1
    } else if (buf.length <= 65535) {
      // Could have used OP_PUSHDATA2.
      return opcodenum === Opcode.OP_PUSHDATA2
    }
    return true
  }

  /**
   * Comes from bitcoind's script DecodeOP_N function
   * @param {number} opcode
   * @returns {number} numeric value in range of 0 to 16
   */
  _decodeOP_N(opcode) {
    if (opcode === Opcode.OP_0) {
      return 0
    } else if (opcode >= Opcode.OP_1 && opcode <= Opcode.OP_16) {
      return opcode - (Opcode.OP_1 - 1)
    } else {
      throw new Error('Invalid opcode: ' + JSON.stringify(opcode))
    }
  }

  /**
   * Comes from bitcoind's script GetSigOpCount(boolean) function
   * @param {boolean} use current (true) or pre-version-0.6 (false) logic
   * @returns {number} number of signature operations required by this script
   */
  getSignatureOperationsCount(accurate): number {
    accurate = (_.isUndefined(accurate) ? true : accurate)
    var self = this
    var n = 0
    var lastOpcode = Opcode.OP_INVALIDOPCODE
    _.each(self.chunks, function getChunk (chunk) {
      var opcode = chunk.opcodenum
      if (opcode === Opcode.OP_CHECKSIG || opcode === Opcode.OP_CHECKSIGVERIFY) {
        n++
      } else if (opcode === Opcode.OP_CHECKMULTISIG || opcode === Opcode.OP_CHECKMULTISIGVERIFY) {
        if (accurate && lastOpcode >= Opcode.OP_1 && lastOpcode <= Opcode.OP_16) {
          n += self._decodeOP_N(lastOpcode)
        } else {
          n += 20
        }
      }
      lastOpcode = opcode
    })
    return n
  }
}

Script.types = {}
Script.types.UNKNOWN = 'Unknown'
Script.types.PUBKEY_OUT = 'Pay to public key'
Script.types.PUBKEY_IN = 'Spend from public key'
Script.types.PUBKEYHASH_OUT = 'Pay to public key hash'
Script.types.PUBKEYHASH_IN = 'Spend from public key hash'
Script.types.SCRIPTHASH_OUT = 'Pay to script hash'
Script.types.SCRIPTHASH_IN = 'Spend from script hash'
Script.types.MULTISIG_OUT = 'Pay to multisig'
Script.types.MULTISIG_IN = 'Spend from multisig'
Script.types.DATA_OUT = 'Data push'
Script.types.SAFE_DATA_OUT = 'Safe data push'
