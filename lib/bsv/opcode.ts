'use strict'

var _ = require('./util/_')
var $ = require('./util/preconditions')
var JSUtil = require('./util/javas')

export class Opcode {
  num
  constructor(num: number | string) {
    if (!(this instanceof Opcode)) {
      return new Opcode(num)
    }

    var value

    if (_.isNumber(num)) {
      value = num
    } else if (_.isString(num)) {
      value = Opcode.map[num]
    } else {
      throw new TypeError('Unrecognized num type: "' + typeof (num) + '" for Opcode')
    }

    JSUtil.defineImmutable(this, {
      num: value
    })

    return this
  }

  static fromBuffer(buf) {
    $.checkArgument(Buffer.isBuffer(buf))
    return new Opcode(Number('0x' + buf.toString('hex')))
  }

  static fromNumber(num) {
    $.checkArgument(_.isNumber(num))
    return new Opcode(num)
  }

  static fromString(str) {
    $.checkArgument(_.isString(str))
    var value = Opcode.map[str]
    if (typeof value === 'undefined') {
      throw new TypeError('Invalid opcodestr')
    }
    return new Opcode(value)
  }

  toHex() {
    return this.num.toString(16)
  }

  toBuffer() {
    return Buffer.from(this.toHex(), 'hex')
  }

  toNumber() {
    return this.num
  }

  toString() {
    var str = Opcode.reverseMap[this.num]
    if (typeof str === 'undefined') {
      throw new Error('Opcode does not have a string representation')
    }
    return str
  }

  static smallInt(n) {
    $.checkArgument(_.isNumber(n), 'Invalid Argument: n should be number')
    $.checkArgument(n >= 0 && n <= 16, 'Invalid Argument: n must be between 0 and 16')
    if (n === 0) {
      return new Opcode('OP_0')
    }
    return new Opcode(Opcode.map.OP_1 + n - 1)
  }

  static map: {[key: string]: number} = {
    // push value
    OP_FALSE: 0,
    OP_0: 0,
    OP_PUSHDATA1: 76,
    OP_PUSHDATA2: 77,
    OP_PUSHDATA4: 78,
    OP_1NEGATE: 79,
    OP_RESERVED: 80,
    OP_TRUE: 81,
    OP_1: 81,
    OP_2: 82,
    OP_3: 83,
    OP_4: 84,
    OP_5: 85,
    OP_6: 86,
    OP_7: 87,
    OP_8: 88,
    OP_9: 89,
    OP_10: 90,
    OP_11: 91,
    OP_12: 92,
    OP_13: 93,
    OP_14: 94,
    OP_15: 95,
    OP_16: 96,

    // control
    OP_NOP: 97,
    OP_VER: 98,
    OP_IF: 99,
    OP_NOTIF: 100,
    OP_VERIF: 101,
    OP_VERNOTIF: 102,
    OP_ELSE: 103,
    OP_ENDIF: 104,
    OP_VERIFY: 105,
    OP_RETURN: 106,

    // stack ops
    OP_TOALTSTACK: 107,
    OP_FROMALTSTACK: 108,
    OP_2DROP: 109,
    OP_2DUP: 110,
    OP_3DUP: 111,
    OP_2OVER: 112,
    OP_2ROT: 113,
    OP_2SWAP: 114,
    OP_IFDUP: 115,
    OP_DEPTH: 116,
    OP_DROP: 117,
    OP_DUP: 118,
    OP_NIP: 119,
    OP_OVER: 120,
    OP_PICK: 121,
    OP_ROLL: 122,
    OP_ROT: 123,
    OP_SWAP: 124,
    OP_TUCK: 125,

    // splice ops
    OP_CAT: 126,
    OP_SPLIT: 127,
    OP_NUM2BIN: 128,
    OP_BIN2NUM: 129,
    OP_SIZE: 130,

    // bit logic
    OP_INVERT: 131,
    OP_AND: 132,
    OP_OR: 133,
    OP_XOR: 134,
    OP_EQUAL: 135,
    OP_EQUALVERIFY: 136,
    OP_RESERVED1: 137,
    OP_RESERVED2: 138,

    // numeric
    OP_1ADD: 139,
    OP_1SUB: 140,
    OP_2MUL: 141,
    OP_2DIV: 142,
    OP_NEGATE: 143,
    OP_ABS: 144,
    OP_NOT: 145,
    OP_0NOTEQUAL: 146,

    OP_ADD: 147,
    OP_SUB: 148,
    OP_MUL: 149,
    OP_DIV: 150,
    OP_MOD: 151,
    OP_LSHIFT: 152,
    OP_RSHIFT: 153,

    OP_BOOLAND: 154,
    OP_BOOLOR: 155,
    OP_NUMEQUAL: 156,
    OP_NUMEQUALVERIFY: 157,
    OP_NUMNOTEQUAL: 158,
    OP_LESSTHAN: 159,
    OP_GREATERTHAN: 160,
    OP_LESSTHANOREQUAL: 161,
    OP_GREATERTHANOREQUAL: 162,
    OP_MIN: 163,
    OP_MAX: 164,

    OP_WITHIN: 165,

    // crypto
    OP_RIPEMD160: 166,
    OP_SHA1: 167,
    OP_SHA256: 168,
    OP_HASH160: 169,
    OP_HASH256: 170,
    OP_CODESEPARATOR: 171,
    OP_CHECKSIG: 172,
    OP_CHECKSIGVERIFY: 173,
    OP_CHECKMULTISIG: 174,
    OP_CHECKMULTISIGVERIFY: 175,

    OP_CHECKLOCKTIMEVERIFY: 177,
    OP_CHECKSEQUENCEVERIFY: 178,

    // expansion
    OP_NOP1: 176,
    OP_NOP2: 177,
    OP_NOP3: 178,
    OP_NOP4: 179,
    OP_NOP5: 180,
    OP_NOP6: 181,
    OP_NOP7: 182,
    OP_NOP8: 183,
    OP_NOP9: 184,
    OP_NOP10: 185,

    // template matching params
    OP_PUBKEYHASH: 253,
    OP_PUBKEY: 254,
    OP_INVALIDOPCODE: 255
  }

  static reverseMap: {[key: number]: string} = []

  // push value
  static OP_FALSE: 0
  static OP_0: 0
  static OP_PUSHDATA1: 76
  static OP_PUSHDATA2: 77
  static OP_PUSHDATA4: 78
  static OP_1NEGATE: 79
  static OP_RESERVED: 80
  static OP_TRUE: 81
  static OP_1: 81
  static OP_2: 82
  static OP_3: 83
  static OP_4: 84
  static OP_5: 85
  static OP_6: 86
  static OP_7: 87
  static OP_8: 88
  static OP_9: 89
  static OP_10: 90
  static OP_11: 91
  static OP_12: 92
  static OP_13: 93
  static OP_14: 94
  static OP_15: 95
  static OP_16: 96

  // control
  static OP_NOP: 97
  static OP_VER: 98
  static OP_IF: 99
  static OP_NOTIF: 100
  static OP_VERIF: 101
  static OP_VERNOTIF: 102
  static OP_ELSE: 103
  static OP_ENDIF: 104
  static OP_VERIFY: 105
  static OP_RETURN: 106

  // stack ops
  static OP_TOALTSTACK: 107
  static OP_FROMALTSTACK: 108
  static OP_2DROP: 109
  static OP_2DUP: 110
  static OP_3DUP: 111
  static OP_2OVER: 112
  static OP_2ROT: 113
  static OP_2SWAP: 114
  static OP_IFDUP: 115
  static OP_DEPTH: 116
  static OP_DROP: 117
  static OP_DUP: 118
  static OP_NIP: 119
  static OP_OVER: 120
  static OP_PICK: 121
  static OP_ROLL: 122
  static OP_ROT: 123
  static OP_SWAP: 124
  static OP_TUCK: 125

  // splice ops
  static OP_CAT: 126
  static OP_SPLIT: 127
  static OP_NUM2BIN: 128
  static OP_BIN2NUM: 129
  static OP_SIZE: 130

  // bit logic
  static OP_INVERT: 131
  static OP_AND: 132
  static OP_OR: 133
  static OP_XOR: 134
  static OP_EQUAL: 135
  static OP_EQUALVERIFY: 136
  static OP_RESERVED1: 137
  static OP_RESERVED2: 138

  // numeric
  static OP_1ADD: 139
  static OP_1SUB: 140
  static OP_2MUL: 141
  static OP_2DIV: 142
  static OP_NEGATE: 143
  static OP_ABS: 144
  static OP_NOT: 145
  static OP_0NOTEQUAL: 146

  static OP_ADD: 147
  static OP_SUB: 148
  static OP_MUL: 149
  static OP_DIV: 150
  static OP_MOD: 151
  static OP_LSHIFT: 152
  static OP_RSHIFT: 153

  static OP_BOOLAND: 154
  static OP_BOOLOR: 155
  static OP_NUMEQUAL: 156
  static OP_NUMEQUALVERIFY: 157
  static OP_NUMNOTEQUAL: 158
  static OP_LESSTHAN: 159
  static OP_GREATERTHAN: 160
  static OP_LESSTHANOREQUAL: 161
  static OP_GREATERTHANOREQUAL: 162
  static OP_MIN: 163
  static OP_MAX: 164

  static OP_WITHIN: 165

  // crypto
  static OP_RIPEMD160: 166
  static OP_SHA1: 167
  static OP_SHA256: 168
  static OP_HASH160: 169
  static OP_HASH256: 170
  static OP_CODESEPARATOR: 171
  static OP_CHECKSIG: 172
  static OP_CHECKSIGVERIFY: 173
  static OP_CHECKMULTISIG: 174
  static OP_CHECKMULTISIGVERIFY: 175

  static OP_CHECKLOCKTIMEVERIFY: 177
  static OP_CHECKSEQUENCEVERIFY: 178

  // expansion
  static OP_NOP1: 176
  static OP_NOP2: 177
  static OP_NOP3: 178
  static OP_NOP4: 179
  static OP_NOP5: 180
  static OP_NOP6: 181
  static OP_NOP7: 182
  static OP_NOP8: 183
  static OP_NOP9: 184
  static OP_NOP10: 185

  // template matching params
  static OP_PUBKEYHASH: 253
  static OP_PUBKEY: 254
  static OP_INVALIDOPCODE: 255

  /**
   * @returns true if opcode is one of OP_0, OP_1, ..., OP_16
   */
  static isSmallIntOp(opcode) {
    if (opcode instanceof Opcode) {
      opcode = opcode.toNumber()
    }
    return ((opcode === Opcode.map.OP_0) ||
      ((opcode >= Opcode.map.OP_1) && (opcode <= Opcode.map.OP_16)))
  }

  /**
   * Will return a string formatted for the console
   *
   * @returns {string} Script opcode
   */
  inspect(): string {
    return '<Opcode: ' + this.toString() + ', hex: ' + this.toHex() + ', decimal: ' + this.num + '>'
  }
}

for (var k in Opcode.map) {
  Opcode.reverseMap[Opcode.map[k]] = k
}
