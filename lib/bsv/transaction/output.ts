'use strict'

var _ = require('../util/_')
import {BN} from '../crypto/bn'
var buffer = require('buffer')
var JSUtil = require('../util/javas')
import {BufferWriter} from '../encoding/bufferwriter'
import {BufferReader} from '../encoding/bufferreader'
import {Varint} from '../encoding/varint'
import {Script} from '../script/script'
var $ = require('../util/preconditions')
var errors = require('../errors')

var MAX_SAFE_INTEGER = 0x1fffffffffffff

export interface output {
  script: Script | string | Buffer,
  satoshis: number | BN
}

export class Output {
  _satoshis: number = 0
  _script: Script = new Script()
  constructor(args: output) {
    this.satoshis = args.satoshis instanceof BN ? args.satoshis.toNumber() : args.satoshis
    if (Buffer.isBuffer(args.script)) {
      this.setScriptFromBuffer(args.script)
    } else {
      var script
      if (_.isString(args.script) && JSUtil.isHexa(args.script)) {
        script = Script.fromHex(<string>args.script)
      } else {
        script = args.script
      }
      this.setScript(script)
    }
  }

  get script(): Script {
    return this._script
  }

  get satoshis() {
    return this._satoshis
  }

  set satoshis(num: number | BN) {
    if (num instanceof BN) {
      this._satoshis = num.toNumber()
    } else if (_.isString(num)) {
      this._satoshis = parseInt(num)
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'Output satoshis is not a natural number'
      )
      this._satoshis = num
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    )
  }

  invalidSatoshis(): boolean | string {
    if (this._satoshis > MAX_SAFE_INTEGER) {
      return 'transaction txout satoshis greater than max safe integer'
    }
    if (this._satoshis < 0) {
      return 'transaction txout negative'
    }
    return false
  }

  get satoshisBN(): BN {
    return BN.fromNumber(this._satoshis)
  }

  set satoshisBN(num: BN) {
    this._satoshis = num.toNumber()
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    )
  }

  toObject(): output {
    return {
      satoshis: this.satoshis,
      script: this._script.toHex()
    }
  }

  toJSON(): output {
    return this.toObject()
  }

  static fromObject(data: output): Output {
    return new Output(data)
  }

  setScriptFromBuffer(buffer: Buffer) {
    this._script = Script.fromBuffer(buffer)
    this._script._isOutput = true
  }

  setScript(script: Script | Buffer | string): Output {
    if (script instanceof Script) {
      this._script = script
      this._script._isOutput = true
    } else if (_.isString(script)) {
      this._script = Script.fromHex(<string>script)
      this._script._isOutput = true
    } else if (Buffer.isBuffer(script)) {
      this.setScriptFromBuffer(script)
    } else {
      throw new TypeError('Invalid argument type: script')
    }
    return this
  }

  inspect(): string {
    var scriptStr
    if (this.script) {
      scriptStr = this.script.inspect()
    }
    return '<Output (' + this.satoshis + ' sats) ' + scriptStr + '>'
  }

  static fromBufferReader(br: BufferReader) {
    var sats = br.readUInt64LEBN()
    var size = br.readVarintNum()
    return new Output({satoshis: sats, script: size !== 0 ? br.read(size) : buffer.Buffer.from([])})
  }

  toBufferWriter(writer?: BufferWriter): BufferWriter {
    if (!writer) {
      writer = new BufferWriter()
    }
    writer.writeUInt64LEBN(this.satoshisBN)
    var script = this._script.toBuffer()
    writer.writeVarintNum(script.length)
    writer.write(script)
    return writer
  }

  // 8    value
  // ???  script size (VARINT)
  // ???  script
  getSize(): number {
    var scriptSize = this.script.toBuffer().length
    var varintSize = new Varint(scriptSize).toBuffer().length
    return 8 + varintSize + scriptSize
  }
}
