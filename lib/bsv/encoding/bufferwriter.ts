'use strict'

var assert = require('assert')

export class BufferWriter {
  bufLen: number
  bufs
  constructor(obj?:BufferWriter) {
    this.bufLen = 0
    if (obj) { this.set(obj) } else { this.bufs = [] }
  }

  set(obj:BufferWriter) {
    this.bufs = obj.bufs || this.bufs || []
    this.bufLen = this.bufs.reduce(function (prev, buf) { return prev + buf.length }, 0)
    return this
  }

  toBuffer(): BufferWriter {
    return this.concat()
  }

  concat() {
    return Buffer.concat(this.bufs, this.bufLen)
  }

  write(buf): BufferWriter {
    assert(Buffer.isBuffer(buf))
    this.bufs.push(buf)
    this.bufLen += buf.length
    return this
  }

  writeReverse(buf): BufferWriter {
    assert(Buffer.isBuffer(buf))
    this.bufs.push(Buffer.from(buf).reverse())
    this.bufLen += buf.length
    return this
  }

  writeUInt8(n): BufferWriter {
    var buf = Buffer.alloc(1)
    buf.writeUInt8(n, 0)
    this.write(buf)
    return this
  }

  writeUInt16BE(n): BufferWriter {
    var buf = Buffer.alloc(2)
    buf.writeUInt16BE(n, 0)
    this.write(buf)
    return this
  }

  writeUInt16LE(n): BufferWriter {
    var buf = Buffer.alloc(2)
    buf.writeUInt16LE(n, 0)
    this.write(buf)
    return this
  }

  writeUInt32BE(n): BufferWriter {
    var buf = Buffer.alloc(4)
    buf.writeUInt32BE(n, 0)
    this.write(buf)
    return this
  }

  writeInt32LE(n): BufferWriter {
    var buf = Buffer.alloc(4)
    buf.writeInt32LE(n, 0)
    this.write(buf)
    return this
  }

  writeUInt32LE(n): BufferWriter {
    var buf = Buffer.alloc(4)
    buf.writeUInt32LE(n, 0)
    this.write(buf)
    return this
  }

  writeUInt64BEBN(bn): BufferWriter {
    var buf = bn.toBuffer({ size: 8 })
    this.write(buf)
    return this
  }

  writeUInt64LEBN(bn): BufferWriter {
    var buf = bn.toBuffer({ size: 8 })
    this.writeReverse(buf)
    return this
  }

  writeVarintNum(n): BufferWriter {
    var buf = BufferWriter.varintBufNum(n)
    this.write(buf)
    return this
  }

  writeVarintBN(bn): BufferWriter {
    var buf = BufferWriter.varintBufBN(bn)
    this.write(buf)
    return this
  }

  static varintBufNum(n) {
    var buf
    if (n < 253) {
      buf = Buffer.alloc(1)
      buf.writeUInt8(n, 0)
    } else if (n < 0x10000) {
      buf = Buffer.alloc(1 + 2)
      buf.writeUInt8(253, 0)
      buf.writeUInt16LE(n, 1)
    } else if (n < 0x100000000) {
      buf = Buffer.alloc(1 + 4)
      buf.writeUInt8(254, 0)
      buf.writeUInt32LE(n, 1)
    } else {
      buf = Buffer.alloc(1 + 8)
      buf.writeUInt8(255, 0)
      buf.writeInt32LE(n & -1, 1)
      buf.writeUInt32LE(Math.floor(n / 0x100000000), 5)
    }
    return buf
  }

  static varintBufBN(bn) {
    var buf
    var n = bn.toNumber()
    if (n < 253) {
      buf = Buffer.alloc(1)
      buf.writeUInt8(n, 0)
    } else if (n < 0x10000) {
      buf = Buffer.alloc(1 + 2)
      buf.writeUInt8(253, 0)
      buf.writeUInt16LE(n, 1)
    } else if (n < 0x100000000) {
      buf = Buffer.alloc(1 + 4)
      buf.writeUInt8(254, 0)
      buf.writeUInt32LE(n, 1)
    } else {
      var bw = new BufferWriter()
      bw.writeUInt8(255)
      bw.writeUInt64LEBN(bn)
      buf = bw.concat()
    }
    return buf
  }
}
