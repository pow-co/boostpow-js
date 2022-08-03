import * as bsv from './bsv'
import { Digest32 } from './fields/digest32'
import { Int32Little } from './fields/int32Little'
import { UInt32Little } from './fields/uint32Little'

// How to create a transaction:
//
//  1. Create the INCOMPLETE TRANSACTION. This means that all input scripts
//     are blank. The incomplete_input interface has a field for script_size
//     that you need to fill in from your inputs. You don't know these values
//     exactly because the signatures are variable size and they aren't created
//     yet. The max signature size is 73, so use that value to estimate input
//     script sizes.
//
//  2. Estimate the SIZE of the complete transaction using
//     estimate_transaction_size().
//
//  3. Calculate the FEE to be paid for a transaction of this size and adjust
//     values in outputs as needed.
//
//  4. Generate all SIGNATURES.
//
//  5. Generate all INPUT SCRIPTS.
//
//  6. Insert input scripts in the FINAL TRANSACTION.

// (step 1) the incomplete transaction
interface incomplete_input {
  // if it's a string, it's assumed to be the backwards hex version of the hash,
  // in accordance with a horribly stupid convention that we have in Bitcoin.
  prevTxId: Buffer | string | Digest32,

  outputIndex: number | UInt32Little,

  // you are required to correctly estimate the script size here. Signatures
  // should be estimated to have size 73, which is the maximum signature size.
  scriptSize: number,

  // default is 0xffffffff, which indicates that the input is finalized, insofar
  // as no higher number is possible.
  sequenceNumber?: number | UInt32Little
}

export interface output {
  satoshis: number,
  script: Buffer | string | bsv.Script
}

export interface incomplete_transaction {
  version: number | Int32Little,
  inputs: incomplete_input[],
  outputs: output[],
  locktime?: number | UInt32Little
}

function varIntSize(n: number): number {
  if (n < 253) return 1
  if (n < 0x10000) return 3
  if (n < 0x100000000) return 5
  return 9
}

// (step 2) given an incomplete transaction, we determine the expected size here.
// this is used to determine the fee.
export function estimateTransactionSize(x: incomplete_transaction): number {
  let size = 8 + varIntSize(x.outputs.length) + varIntSize(x.inputs.length)
  for (let input of x.inputs) size += 40 + varIntSize(input.scriptSize) + input.scriptSize
  for (let output of x.outputs) size += 8 + varIntSize(output.script.length) +output.script.length
  return size
}

export interface input {
  prevTxId: Buffer | string | Digest32,
  outputIndex: number | UInt32Little,
  script: Buffer | string | bsv.Script,
  sequenceNumber?: number | UInt32Little
}

export interface transaction {
  version: number | Int32Little,
  inputs: input[],
  outputs: output[],
  locktime?: number | UInt32Little
}

export function serializedSize(x: transaction): number {
  let size = 8 + varIntSize(x.outputs.length) + varIntSize(x.inputs.length)
  for (let input of x.inputs) size += 40 + varIntSize(input.script.length) + input.script.length
  for (let output of x.outputs) size += 8 + varIntSize(output.script.length) + output.script.length
  return size
}

class Writer {
  buf: Buffer
  position: number

  constructor(size: number) {
    this.position = 0
    this.buf = Buffer.alloc(Number(size))
  }

  write_buffer(b: Buffer) {
    b.copy(this.buf, this.position)
    this.position += b.length
  }

  write_var_int(n: number) {
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
    this.write_buffer(buf)
  }

  write_input(i: input) {
    this.write_buffer(i.prevTxId instanceof Buffer ?
      i.prevTxId : (i.prevTxId instanceof Digest32 ?
        i.prevTxId : Digest32.fromHex(i.prevTxId)).buffer)

    this.write_buffer((i.outputIndex instanceof UInt32Little ?
      i.outputIndex : UInt32Little.fromNumber(i.outputIndex)).buffer)

    let script: Buffer = i.script instanceof Buffer ? i.script : Buffer.from(i.script, 'hex')
    this.write_var_int(script.length)
    this.write_buffer(script)

    this.write_buffer((i.outputIndex instanceof UInt32Little ?
      i.outputIndex : UInt32Little.fromNumber((!i.outputIndex) ?
        0xffffffff : i.outputIndex)).buffer)
  }

  write_satoshis(n: number) {
    this.write_buffer(bsv.crypto.BN.fromNumber(n).toBuffer({ size: 8 }).reverse())
  }

  write_output(o: output) {
    this.write_satoshis(o.satoshis)

    let script: Buffer = o.script instanceof Buffer ? o.script : Buffer.from(o.script, 'hex')
    this.write_var_int(script.length)
    this.write_buffer(script)
  }

  write_transaction(tx: transaction) {
    this.write_buffer((tx.version instanceof Int32Little ?
      tx.version : UInt32Little.fromNumber(tx.version)).buffer)

    this.write_var_int(tx.inputs.length)
    for (let input of tx.inputs) this.write_input(input)

    this.write_var_int(tx.outputs.length)
    for (let output of tx.outputs) this.write_output(output)

    this.write_buffer((tx.locktime instanceof UInt32Little ?
      tx.locktime : UInt32Little.fromNumber((!tx.locktime) ?
        0 : tx.locktime)).buffer)
  }
}

// write a transaction in the format given above to a buffer
export function writeTransaction(tx: transaction): Buffer {
  let w = new Writer(serializedSize(tx))
  w.write_transaction(tx)
  return w.buf
}

// (step 4) write incomplete transaction for signing.
export function writeIncompleteTransaction(tx: incomplete_transaction): Buffer {
  let inputs: input[] = []
  for (let input of tx.inputs) inputs.push({
    prevTxId: input.prevTxId,
    outputIndex: input.outputIndex,
    script: Buffer.alloc(0),
    sequenceNumber: input.sequenceNumber
  })

  return writeTransaction({
    version: tx.version,
    inputs: inputs,
    outputs: tx.outputs,
    locktime: tx.locktime
  })
}

interface document {
  // required for FORKID signatures, not required for
  // the original signature algorithm.
  satoshis?: number,

  // for FORKID, the output script. For the original
  // algorithm, the script before the last OP_CODESEPARATOR
  // before the signature with all OP_CODESEPARATORs and
  // previous instances of the signature removed.
  scriptCode: Buffer | string | bsv.Script,

  // the index of the input which contains this signature.
  inputIndex: number,

  incompleteTransaction: Buffer | bsv.Transaction | incomplete_transaction
}

export function sign(
  wif: string | bsv.PrivateKey,
  doc: document,
  sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID,
  flags = bsv.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA |
    bsv.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID |
    bsv.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES |
    bsv.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES): Buffer {

    let tx = doc.incompleteTransaction instanceof bsv.Transaction ||
      doc.incompleteTransaction instanceof Buffer ?
      doc.incompleteTransaction :
      writeIncompleteTransaction(doc.incompleteTransaction)
    return Buffer.concat([
      bsv.Transaction.Sighash.sign(
        new bsv.Transaction(tx),
        new bsv.PrivateKey(wif), sigtype,
        doc.inputIndex, new bsv.Script(doc.scriptCode),
        new bsv.crypto.BN(doc.satoshis), flags).toBuffer(),
      Buffer.from([sigtype & 0xff])
    ])
}

export function verify(
  pubkey: Buffer | bsv.PublicKey,
  sig: Buffer,
  doc: document,
  flags = bsv.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA |
  bsv.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID |
  bsv.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES |
  bsv.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES): boolean {
  let tx = doc.incompleteTransaction instanceof bsv.Transaction ||
    doc.incompleteTransaction instanceof Buffer ?
    doc.incompleteTransaction :
    writeIncompleteTransaction(doc.incompleteTransaction)
  let pub = pubkey instanceof Buffer ? bsv.PublicKey.fromBuffer(pubkey) : pubkey
  return bsv.Transaction.Sighash.verify(
    new bsv.Transaction(tx),
    new bsv.crypto.Signature.fromTxFormat(sig), pub, doc.inputIndex,
    new bsv.Script(doc.scriptCode),
    new bsv.crypto.BN(doc.satoshis), flags)
}
