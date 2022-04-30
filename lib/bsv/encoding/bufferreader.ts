'use strict'

var _ = require('../util/_')
var $ = require('../util/preconditions')
import {BN} from '../crypto/bn'

export class BufferReader {
  constructor(buf: Buffer) {
    if (_.isUndefined(buf)) {
      return
    }
    if (Buffer.isBuffer(buf)) {
      this.set({
        buf: buf
      })
    } else if (_.isString(buf)) {
      var b = Buffer.from(buf, 'hex')
      if (b.length * 2 !== buf.length) { throw new TypeError('Invalid hex string') }

      this.set({
        buf: b
      })
    } else if (_.isObject(buf)) {
      var obj = buf
      this.set(obj)
    } else {
      throw new TypeError('Unrecognized argument for BufferReader')
    }
  }

  set(obj): BufferReader {
    this.buf = obj.buf || this.buf || undefined
    this.pos = obj.pos || this.pos || 0
    return this
  }

  eof(): boolean {
    return this.pos >= this.buf.length
  }

  finished(): boolean {
    return this.eof()
  }

  read(len): Buffer {
    $.checkArgument(!_.isUndefined(len), 'Must specify a length')
    var buf = this.buf.slice(this.pos, this.pos + len)
    this.pos = this.pos + len
    return buf
  }

  readAll(): Buffer {
    var buf = this.buf.slice(this.pos, this.buf.length)
    this.pos = this.buf.length
    return buf
  }

  readUInt8(): number {
    var val = this.buf.readUInt8(this.pos)
    this.pos = this.pos + 1
    return val
  }

  readUInt16BE(): number {
    var val = this.buf.readUInt16BE(this.pos)
    this.pos = this.pos + 2
    return val
  }

  readUInt16LE(): number {
    var val = this.buf.readUInt16LE(this.pos)
    this.pos = this.pos + 2
    return val
  }

  readUInt32BE(): number {
    var val = this.buf.readUInt32BE(this.pos)
    this.pos = this.pos + 4
    return val
  }

  readUInt32LE(): number {
    var val = this.buf.readUInt32LE(this.pos)
    this.pos = this.pos + 4
    return val
  }

  readInt32LE(): number {
    var val = this.buf.readInt32LE(this.pos)
    this.pos = this.pos + 4
    return val
  }

  readUInt64BEBN(): BN {
    var buf = this.buf.slice(this.pos, this.pos + 8)
    var bn = BN.fromBuffer(buf)
    this.pos = this.pos + 8
    return bn
  }

  readUInt64LEBN(): BN {
    var second = this.buf.readUInt32LE(this.pos)
    var first = this.buf.readUInt32LE(this.pos + 4)
    var combined = (first * 0x100000000) + second
    // Instantiating an instance of BN with a number is faster than with an
    // array or string. However, the maximum safe number for a double precision
    // floating point is 2 ^ 52 - 1 (0x1fffffffffffff), thus we can safely use
    // non-floating point numbers less than this amount (52 bits). And in the case
    // that the number is larger, we can instatiate an instance of BN by passing
    // an array from the buffer (slower) and specifying the endianness.
    var bn
    if (combined <= 0x1fffffffffffff) {
      bn = new BN(combined)
    } else {
      var data = Array.prototype.slice.call(this.buf, this.pos, this.pos + 8)
      bn = new BN(data, 10, 'le')
    }
    this.pos = this.pos + 8
    return bn
  }

  readVarintNum(): number {
    var first = this.readUInt8()
    switch (first) {
      case 0xFD:
        return this.readUInt16LE()
      case 0xFE:
        return this.readUInt32LE()
      case 0xFF:
        var bn = this.readUInt64LEBN()
        var n = bn.toNumber()
        if (n <= Math.pow(2, 53)) {
          return n
        } else {
          throw new Error('number too large to retain precision - use readVarintBN')
        }
        // break // unreachable
      default:
        return first
    }
  }

  /**
   * reads a length prepended buffer
   */
  readVarLengthBuffer(): Buffer {
    var len = this.readVarintNum()
    var buf = this.read(len)
    $.checkState(buf.length === len, 'Invalid length while reading varlength buffer. ' +
      'Expected to read: ' + len + ' and read ' + buf.length)
    return buf
  }

  readVarintBuf() {
    var first = this.buf.readUInt8(this.pos)
    switch (first) {
      case 0xFD:
        return this.read(1 + 2)
      case 0xFE:
        return this.read(1 + 4)
      case 0xFF:
        return this.read(1 + 8)
      default:
        return this.read(1)
    }
  }

  readVarintBN() {
    var first = this.readUInt8()
    switch (first) {
      case 0xFD:
        return new BN(this.readUInt16LE())
      case 0xFE:
        return new BN(this.readUInt32LE())
      case 0xFF:
        return this.readUInt64LEBN()
      default:
        return new BN(first)
    }
  }

  reverse() {
    var buf = Buffer.alloc(this.buf.length)
    for (var i = 0; i < buf.length; i++) {
      buf[i] = this.buf[this.buf.length - 1 - i]
    }
    this.buf = buf
    return this
  }

  readReverse(len) {
    if (_.isUndefined(len)) {
      len = this.buf.length
    }
    var buf = this.buf.slice(this.pos, this.pos + len)
    this.pos = this.pos + len
    return Buffer.from(buf).reverse()
  }
}
