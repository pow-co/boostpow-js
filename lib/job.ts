import * as bsv from 'bsv'
import { Int32Little } from './fields/int32Little'
import { UInt32Little } from './fields/uint32Little'
import { UInt16Little } from './fields/uint16Little'
import { Digest32 } from './fields/digest32'
import { Digest20 } from './fields/digest20'
import { Bytes } from './fields/bytes'
import { Difficulty } from './fields/difficulty'
import * as work from './work/proof'
import { Redeem } from './redeem'
import { Metadata } from './metadata'
import { Utils } from './utils'
import { Output } from './output'
import { Puzzle } from './puzzle'

interface json_job {
    content: string,
    diff: number,
    category?: string,
    tag?: string,
    additionalData?: string,
    userNonce?: string,
    minerPubKeyHash?: string,
    useGeneralPurposeBits?: boolean
}

export class Job {
  private constructor(
    // The hash of the content to be boosted.
    private Content: Digest32,
    // how much it is to be boosted.
    private Difficulty: number,
    // corresponds to the version field in a bitcoin block header.
    // when we use ASICBoost, only half these bytes are avalable
    // to be whatever the user wants.
    private Category: Int32Little,
    // Up to 20 bytes. One tag per boost.
    private Tag: Bytes,
    // Hold whatever other information you want here.
    private AdditionalData: Bytes,
    // used to ensure no two boosts have the same script unless
    // the user wants it.
    private UserNonce: UInt32Little,
    // whether we are using version 1 of the script or version 2,
    // which enables ASICBoost.
    private useGeneralPurposeBits: boolean,
    // the address of the miner will completed this boost.
    // used to ensure that other miners cannot steal the miner's nonce
    // for themselves.
    //
    // Optional because boost bounty adds it in the redeem script instead
    // of the locking script. If it is present, then his is a boost
    // contract script.
    private MinerPubKeyHash?: Digest20,
    // Optional tx information attached or not
    private Txid?: string,
    private Vout?: number,
    private Value?: number,
  ) {}

  get category(): Int32Little {
    return this.Category
  }

  get content(): Digest32 {
    return this.Content
  }

  get tag(): Bytes {
    return this.Tag
  }

  get additionalData(): Bytes {
    return this.AdditionalData
  }

  get userNonce(): UInt32Little {
    return this.UserNonce
  }

  get difficulty(): number {
    return this.Difficulty
  }

  get bits(): UInt32Little {
    return UInt32Little.fromNumber(Utils.difficulty2bits(this.difficulty))
  }

  get minerPubKeyHash(): Digest20 | undefined {
    return this.MinerPubKeyHash
  }

  get id(): string{
    return this.scriptHash
  }

  get scriptVersion(): number {
    if (this.useGeneralPurposeBits) return 2
    return 1
  }

  get useASICBoost(): boolean {
    return this.scriptVersion > 1
  }

  isContract(): boolean {
    return !!this.MinerPubKeyHash
  }

  isBounty(): boolean {
    return !this.MinerPubKeyHash
  }

  // the 16 bits of category that can be set by the user.
  get magicNumber(): UInt16Little {
    return UInt16Little.fromNumber(Utils.magicNumber(this.category.number))
  }

  static fromObject(params: json_job): Job {

    if (params.content && params.content.length > 64) {
      throw new Error('content too large. Max 32 bytes.')
    }

    if (params.diff <= 0 || isNaN(params.diff) || (typeof params.diff !== 'number')) {
      throw new Error('diff must be a positive number.')
    }

    let category
    if (params.category) {
      if (params.category.length > 8) {
        throw new Error('category too large. Max 4 bytes.')
      }
      category = new Int32Little(Utils.createBufferAndPad(params.category, 4, false))
    } else {
      category = Int32Little.fromNumber(0)
    }

    if (params.tag && params.tag.length > 40) {
      throw new Error('tag too large. Max 20 bytes.')
    }

    if (params.userNonce && params.userNonce.length > 8) {
      throw new Error('userNonce too large. Max 4 bytes.')
    }

    let userNonce
    if(!params.userNonce) {
      let getRandomInt = (max) => {
        return Math.floor(Math.random() * max)
      }
      let tempBuffer=Buffer.from([getRandomInt(0xff), getRandomInt(0xff), getRandomInt(0xff), getRandomInt(0xff)])
      userNonce = tempBuffer.toString('hex')
    } else {
      userNonce = params.userNonce
    }

    let minerPubKeyHash
    if (params.minerPubKeyHash) {
      if (params.minerPubKeyHash.length > 40) {
        throw new Error('minerPubKeyHash too large. Max 4 bytes.')
      }
      minerPubKeyHash = new Bytes(Buffer.from(params.minerPubKeyHash, 'hex'))
    }

    return new Job(
      new Digest32(Utils.createBufferAndPad(params.content, 32)),
      params.diff, category,
      new Bytes(params.tag ? Buffer.from(params.tag, 'hex') : Buffer.alloc(0)),
      new Bytes(params.additionalData ? Buffer.from(params.additionalData, 'hex') : Buffer.alloc(0)),
      new UInt32Little(Utils.createBufferAndPad(userNonce, 4, false)),
      params.useGeneralPurposeBits ? params.useGeneralPurposeBits : false,
      minerPubKeyHash
    )
  }

  toObject (): json_job {
    if (this.minerPubKeyHash) {
      return {
        content: this.content.hex,
        diff: this.difficulty,
        category: this.category.hex,
        tag: this.tag.hex,
        additionalData: this.additionalData.hex,
        userNonce: this.userNonce.hex,
        minerPubKeyHash: this.minerPubKeyHash.hex,
        useGeneralPurposeBits: this.useGeneralPurposeBits
      }
    } else {
      return {
        content: this.content.hex,
        diff: this.difficulty,
        category: this.category.hex,
        tag: this.tag.hex,
        additionalData: this.additionalData.hex,
        userNonce: this.userNonce.hex,
        useGeneralPurposeBits: this.useGeneralPurposeBits
      }
    }
  }

  toHex(): string {
    return this.toScript().toHex()
  }

  toBuffer(): Buffer {
    return this.toScript().toBuffer()
  }

  private toOpCode(num:Buffer)  {
    if(num.length == 1) {
      if (num[0] >= 1 && num[0] <= 16) {
        return bsv.Opcode.OP_1 + (num[0] - 1)
      }
      if(num[0] == 0x81) {
        return bsv.Opcode.OP_1NEGATE
      }
    }

    return num
  }

  toScript(): bsv.Script {
    let buildOut = bsv.Script()

    buildOut.add(this.toOpCode(Buffer.from('boostpow', 'utf8')))

    buildOut.add(bsv.Opcode.OP_DROP)

    if (this.minerPubKeyHash) {
      buildOut.add(this.toOpCode(this.minerPubKeyHash.buffer))
    }

    buildOut.add(this.toOpCode(this.category.buffer))

    buildOut.add(this.toOpCode(this.content.buffer))

    buildOut.add(this.toOpCode(this.bits.buffer))

    buildOut.add(this.toOpCode(this.tag.buffer))

    buildOut.add(this.toOpCode(this.userNonce.buffer))

    buildOut.add(this.toOpCode(this.additionalData.buffer))

    // Add the rest of the script
    for (const op of Job.scriptOperations(this.useGeneralPurposeBits)) {
      buildOut.add(op)
    }

    // Return script
    return buildOut
  }

  static remainingOperationsMatchExactly(remainingChunks, start: number, expectedOps): boolean {
    let i = 0

    if ((remainingChunks.length - start) !== expectedOps.length) {
      return false
    }

    while (i < (remainingChunks.length - start)) {
      if (
        (
          // If it's a buffer, then ensure the value matches expect length
          remainingChunks[start + i].buf && (remainingChunks[start + i].len === expectedOps[i].length)
        )
        ||
        (
          remainingChunks[start + i].buf === undefined &&
          expectedOps[i] === remainingChunks[start + i].opcodenum
        )
      ) {
        i++
      } else {
        return false
      }
    }

    return true
  }

  public static readScript(script: bsv.Script, txid?: string, vout?: number, value?: number): Job {
    let category
    let content
    let diff
    let tag
    let additionalData
    let userNonce
    let minerPubKeyHash
    let useGeneralPurposeBits

    if (!(
      script.chunks[0].buf.toString('utf8') === 'boostpow' &&

      // Drop the identifier
      script.chunks[1].opcodenum === bsv.Opcode.OP_DROP))
      throw new Error('Invalid: no "boostpow" flag')

    let is_bounty: boolean

    if (
      // Category
      script.chunks[2].buf &&
      script.chunks[2].opcodenum === 4
    ) {
      is_bounty = true
    } else if (
      // minerPubKeyHash
      script.chunks[2].buf &&
      script.chunks[2].opcodenum === 20
    ) {
      is_bounty = false
    } else throw new Error('Invalid: could not detect bounty or contract pattern')

    if (is_bounty) {
      if (
        // Content
        script.chunks[3].buf &&
        script.chunks[3].len === 32 &&

        // Target
        script.chunks[4].buf &&
        script.chunks[4].len === 4 &&

        // Tag
        ((script.chunks[5].buf && script.chunks[5].len <= 20) ||
          script.chunks[5].opcodenum == bsv.Opcode.OP_0 ||
          script.chunks[5].opcodenum == bsv.Opcode.OP_1NEGATE ||
          (script.chunks[5].opcodenum >= bsv.Opcode.OP_1 && script.chunks[5].opcodenum <= bsv.Opcode.OP_16)) &&

        // User Nonce
        script.chunks[6].buf &&
        script.chunks[6].len === 4 &&

        // Additional Data
        (script.chunks[7].buf || script.chunks[7].opcodenum == bsv.Opcode.OP_0 ||
        script.chunks[7].opcodenum == bsv.Opcode.OP_1NEGATE ||
        (script.chunks[7].opcodenum >= bsv.Opcode.OP_1 && script.chunks[7].opcodenum <= bsv.Opcode.OP_16))
      ) {

        if (Job.remainingOperationsMatchExactly(script.chunks, 8, Job.scriptOperationsV1NoASICBoost())) {
          useGeneralPurposeBits = false
        } else if (Job.remainingOperationsMatchExactly(script.chunks, 8, Job.scriptOperationsV2ASICBoost())) {
          useGeneralPurposeBits = true
        } else throw new Error('Invalid script program')

        category = new Int32Little(Utils.fromOpCode(script.chunks[2]))
        content = new Digest32(Utils.fromOpCode(script.chunks[3]))
        let targetHex = (Utils.fromOpCode(script.chunks[4]).toString('hex').match(/../g) || []).reverse().join('')
        let targetInt = parseInt(targetHex, 16)
        diff = Utils.difficulty(targetInt)

        tag = new Bytes(Utils.fromOpCode(script.chunks[5]))

        userNonce = new UInt32Little(Utils.fromOpCode(script.chunks[6]))

        additionalData = new Bytes(Utils.fromOpCode(script.chunks[7]))

      } else throw new Error('Not valid Boost Output')
    } else {
      if (

        // Category
        script.chunks[3].buf &&
        script.chunks[3].opcodenum === 4 &&

        // Content
        script.chunks[4].buf &&
        script.chunks[4].len === 32 &&

        // Target
        script.chunks[5].buf &&
        script.chunks[5].len === 4 &&

        // Tag
        ((script.chunks[6].buf && script.chunks[6].len <= 20) ||
          script.chunks[6].opcodenum == bsv.Opcode.OP_0 ||
          script.chunks[6].opcodenum == bsv.Opcode.OP_1NEGATE ||
          (script.chunks[6].opcodenum >= bsv.Opcode.OP_1 && script.chunks[6].opcodenum <= bsv.Opcode.OP_16)) &&

        // User Nonce
        script.chunks[7].buf &&
        script.chunks[7].len === 4 &&

        // Additional Data
        (script.chunks[8].buf ||
        script.chunks[8].opcodenum == bsv.Opcode.OP_0 ||
        script.chunks[8].opcodenum == bsv.Opcode.OP_1NEGATE ||
        (script.chunks[8].opcodenum >= bsv.Opcode.OP_1 && script.chunks[8].opcodenum <= bsv.Opcode.OP_16))
      ) {
        if (Job.remainingOperationsMatchExactly(script.chunks, 9, Job.scriptOperationsV1NoASICBoost())) {
          useGeneralPurposeBits = false
        } else if (Job.remainingOperationsMatchExactly(script.chunks, 9, Job.scriptOperationsV2ASICBoost())) {
          useGeneralPurposeBits = true
        } else throw new Error('Not valid Boost Output')

        minerPubKeyHash = new Bytes(Utils.fromOpCode(script.chunks[2]))
        category = new Int32Little(Utils.fromOpCode(script.chunks[3]))
        content = new Digest32(Utils.fromOpCode(script.chunks[4]))
        let targetHex = (Utils.fromOpCode(script.chunks[5]).toString('hex').match(/../g) || []).reverse().join('')
        let targetInt = parseInt(targetHex, 16)
        diff = Utils.difficulty(targetInt)

        tag = new Bytes(Utils.fromOpCode(script.chunks[6]))

        userNonce = new UInt32Little(Utils.fromOpCode(script.chunks[7]))

        additionalData = new Bytes(Utils.fromOpCode(script.chunks[8]))
      } else throw new Error('Invalid boost format')
    }

    return new Job(
      content,
      diff,
      category,
      tag,
      additionalData,
      userNonce,
      useGeneralPurposeBits,
      minerPubKeyHash,
      txid,
      vout,
      value
    )
  }

  static fromHex(asm: string, txid?: string, vout?: number, value?: number): Job {
    return Job.readScript(new bsv.Script(asm), txid, vout, value)
  }

  static fromASM(asm: string, txid?: string, vout?: number, value?: number): Job {
    return Job.readScript(new bsv.Script.fromASM(asm), txid, vout, value)
  }

  static fromBuffer(b: Buffer, txid?: string, vout?: number, value?: number): Job {
    return Job.readScript(new bsv.Script.fromBuffer(b), txid, vout, value)
  }

  toASM(): string {
    const makeHex = this.toHex()
    const makeAsm = new bsv.Script(makeHex)
    return makeAsm.toASM()
  }

  static fromASM4(str: string, txid?: string, vout?: number, value?: number): Job {
    return Job.fromHex(str, txid, vout, value)
  }

  static fromASM2(str: string, txid?: string, vout?: number, value?: number): Job {
    return Job.fromHex(str, txid, vout, value)
  }

  toString(): string {
    const makeHex = this.toHex()
    const makeAsm = new bsv.Script(makeHex)
    return makeAsm.toString()
  }

  static fromString(str: string, txid?: string, vout?: number, value?: number): Job {
    return Job.fromHex(str, txid, vout, value)
  }

  // Optional attached information if available
  get txOutpoint(): {txid?: string, vout?: number, value?: number} {
    return {
      txid: this.txid,
      vout: this.vout,
      value: this.value,
    }
  }

  // Optional attached information if available
  get txid(): string | undefined {
    return this.Txid
  }

  // Optional attached information if available
  get vout(): number | undefined {
    return this.Vout
  }

  // Optional attached information if available
  get value(): number | undefined {
    return this.Value
  }

  get scriptHash(): string {
    const hex = this.toHex()
    const buffer = Buffer.from(hex, 'hex')
    return bsv.crypto.Hash.sha256(buffer).reverse().toString('hex')
  }

  /**
   * @deprecated
   * @param t 
   * @param vout 
   * @returns 
   */
  static fromTransaction(t: bsv.Transaction | Buffer | string, vout: number = 0): Job | undefined {
    if (!t) {
      return undefined
    }

    let tx: bsv.Transaction = new bsv.Transaction(t)

    if (vout > tx.outputs.length - 1 || vout < 0 || vout === undefined || vout === null) {
      return undefined
    }

    if (tx.outputs[vout].script && tx.outputs[vout].script.chunks[0].buf &&
      tx.outputs[vout].script.chunks[0].buf.toString('hex') === Buffer.from('boostpow', 'utf8').toString('hex')) {
      return Job.readScript(tx.outputs[vout].script, tx.hash, vout, tx.outputs[vout].satoshis)
    }

    return undefined
  }

  static fromTransactionGetAllOutputs(tx: bsv.Transaction): Job[] {
    if (!tx) {
      return []
    }

    const boostJobs: Job[] = []
    let o = 0
    for (const out of tx.outputs) {
      if (out.script && out.script.chunks[0].buf &&
        out.script.chunks[0].buf.toString('hex') === Buffer.from('boostpow', 'utf8').toString('hex')) {
        boostJobs.push(Job.readScript(out.script, tx.hash, o, out.satoshis))
      }
      o++
    }

    return boostJobs
  }

  static fromRawTransaction(rawtx: string, vout: number = 0): Job | undefined {
    if (isNaN(vout)) {
      return undefined
    }

    const tx = new bsv.Transaction(rawtx)
    return Job.fromTransaction(tx, vout)
  }
  /**
   * Create a transaction fragment that can be modified to redeem the boost job
   *
   * @param boostPowJob Boost Job to redeem
   * @param boostPowJobProof Boost job proof to use to redeem
   * @param privateKey The private key string of the minerPubKeyHash
   */
  static createRedeemTransaction(
    boostPowJob: Job,
    boostPowJobProof: Redeem,
    privateKeyStr: string,
    receiveAddressStr: string, sats_per_byte: number = .5): bsv.Transaction {
    const boostPowString = Job.tryValidateJobProof(boostPowJob, boostPowJobProof)
    if (!boostPowString) {
      throw new Error('createRedeemTransaction: Invalid Job Proof')
    }

    if (boostPowJob.value === undefined) throw new Error('createRedeemTransaction: job requires satoshi value')

    if (boostPowJob.txid === undefined) throw new Error('createRedeemTransaction: job requires txid')

    if (boostPowJob.vout === undefined) throw new Error('createRedeemTransaction: job requires vout')

    return new bsv.Transaction(
      new Puzzle(new Output(boostPowJob), privateKeyStr).createRedeemTransaction(
        boostPowJobProof.solution,
        receiveAddressStr,
        sats_per_byte))
  }

  static puzzle(boostPowJob: Job, address?: Digest20): work.Puzzle {
    let minerPubKeyHash
    if (boostPowJob.isBounty() && address !== undefined) {
      minerPubKeyHash = address
    } else if (boostPowJob.isContract() && address === undefined) {
      minerPubKeyHash = boostPowJob.minerPubKeyHash
    } else throw "invalid"

    let meta_begin = new Bytes(Buffer.concat([
      boostPowJob.tag.buffer,
      minerPubKeyHash.buffer
    ]))

    let meta_end = new Bytes(Buffer.concat([
      boostPowJob.userNonce.buffer,
      boostPowJob.additionalData.buffer
    ]))

    return boostPowJob.useGeneralPurposeBits ?
      new work.Puzzle(
        boostPowJob.category,
        boostPowJob.content,
        new Difficulty(boostPowJob.difficulty),
        meta_begin,
        meta_end,
        Int32Little.fromNumber(Utils.generalPurposeBitsMask())
      ) : new work.Puzzle(
        boostPowJob.category,
        boostPowJob.content,
        new Difficulty(boostPowJob.difficulty),
        meta_begin,
        meta_end
      )
  }

  static createBoostPowMetadata(boostPowJob: Job, boostPowJobProof: Redeem): Metadata {
    let minerPubKeyHash
    if (boostPowJobProof.minerPubKeyHash) {
      minerPubKeyHash = boostPowJobProof.minerPubKeyHash
    } else if (boostPowJob.minerPubKeyHash) {
      minerPubKeyHash = boostPowJob.minerPubKeyHash
    } else throw "invalid proof"

    return Metadata.fromBuffer({
      tag: boostPowJob.tag.buffer,
      minerPubKeyHash: minerPubKeyHash.buffer,
      extraNonce1: boostPowJobProof.extraNonce1.buffer,
      extraNonce2: boostPowJobProof.extraNonce2.buffer,
      userNonce: boostPowJob.userNonce.buffer,
      additionalData: boostPowJob.additionalData.buffer,
    })
  }

  static proof(boostPowJob: Job, boostPowJobProof: Redeem): work.Proof {
    const meta = Job.createBoostPowMetadata(boostPowJob, boostPowJobProof)

    let meta_begin = new Bytes(Buffer.concat([
      meta.tag.buffer,
      meta.minerPubKeyHash.buffer
    ]))

    let meta_end = new Bytes(Buffer.concat([
      meta.userNonce.buffer,
      meta.additionalData.buffer
    ]))

    let z: work.Puzzle

    if (boostPowJob.useGeneralPurposeBits) {
      z = new work.Puzzle(
        boostPowJob.category,
        boostPowJob.content,
        new Difficulty(boostPowJob.difficulty),
        meta_begin,
        meta_end,
        Int32Little.fromNumber(Utils.generalPurposeBitsMask())
      )
    } else {
      z = new work.Puzzle(
        boostPowJob.category,
        boostPowJob.content,
        new Difficulty(boostPowJob.difficulty),
        meta_begin,
        meta_end
      )
    }

    return new work.Proof(z, boostPowJobProof.solution)
  }

  static tryValidateJobProof(boostPowJob: Job, boostPowJobProof: Redeem):
    null | { boostPowString: work.PowString, boostPowMetadata: Metadata } {
    let x = this.proof(boostPowJob, boostPowJobProof).string()
    if (!(x && x.valid())) return null

    return {
      boostPowString: x,
      boostPowMetadata: Job.createBoostPowMetadata(boostPowJob, boostPowJobProof)
    }
  }

  static loopOperation(loopIterations: number, generateFragmentInvoker: Function) {
    let concatOps = []
    for (let i = 0; i < loopIterations; i++) {
      concatOps = concatOps.concat(generateFragmentInvoker())
    }
    return concatOps
  }

  static scriptOperations(useGeneralPurposeBits:boolean) {
    if (useGeneralPurposeBits) return this.scriptOperationsV2ASICBoost()
    return this.scriptOperationsV1NoASICBoost()
  }

  static scriptOperationsV1NoASICBoost() {
    return [
      // CAT SWAP
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_SWAP,

      // {5} ROLL DUP TOALTSTACK CAT                // copy mining pool’s pubkey hash to alt stack. A copy remains on the stack.
      bsv.Opcode.OP_5,
      bsv.Opcode.OP_ROLL,
      bsv.Opcode.OP_DUP,
      bsv.Opcode.OP_TOALTSTACK,
      bsv.Opcode.OP_CAT,

      // {2} PICK TOALTSTACK                         // copy target and push to altstack.
      bsv.Opcode.OP_2,
      bsv.Opcode.OP_PICK,
      bsv.Opcode.OP_TOALTSTACK,

      // {5} ROLL SIZE {4} EQUALVERIFY CAT          // check size of extra_nonce_1
      bsv.Opcode.OP_5,
      bsv.Opcode.OP_ROLL,
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_4,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CAT,

      // {5} ROLL SIZE {8} EQUALVERIFY CAT          // check size of extra_nonce_2
      bsv.Opcode.OP_5,
      bsv.Opcode.OP_ROLL,
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_8,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CAT,

      // SWAP CAT HASH256                           // create metadata string and hash it.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_HASH256,

      // SWAP TOALTSTACK CAT CAT                    // target to altstack.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_TOALTSTACK,
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_CAT,

      // SWAP SIZE {4} EQUALVERIFY CAT              // check size of timestamp.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_4,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CAT,

      // FROMALTSTACK CAT                           // attach target
      bsv.Opcode.OP_FROMALTSTACK,
      bsv.Opcode.OP_CAT,

      // SWAP SIZE {4} EQUALVERIFY CAT             // check size of nonce. Boost POW string is constructed.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_4,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CAT,

      // Take hash of work string and ensure that it is positive and minimally encoded.
      bsv.Opcode.OP_HASH256, ...Job.ensure_positive(),

      bsv.Opcode.OP_FROMALTSTACK, ...Job.expand_target(), ...Job.ensure_positive(),

      // check that the hash of the Boost POW string is less than the target
      bsv.Opcode.OP_LESSTHAN,
      bsv.Opcode.OP_VERIFY,

      // check that the given address matches the pubkey and check signature.
      // DUP HASH160 FROMALTSTACK EQUALVERIFY CHECKSIG
      bsv.Opcode.OP_DUP,
      bsv.Opcode.OP_HASH160,
      bsv.Opcode.OP_FROMALTSTACK,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CHECKSIG,
    ]
  }

  static scriptOperationsV2ASICBoost() {
    return [
      // CAT SWAP
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_SWAP,

      // {5} ROLL DUP TOALTSTACK CAT                // copy mining pool’s pubkey hash to alt stack. A copy remains on the stack.
      bsv.Opcode.OP_5,
      bsv.Opcode.OP_ROLL,
      bsv.Opcode.OP_DUP,
      bsv.Opcode.OP_TOALTSTACK,
      bsv.Opcode.OP_CAT,

      // {2} PICK TOALTSTACK                         // copy target and push to altstack.
      bsv.Opcode.OP_2,
      bsv.Opcode.OP_PICK,
      bsv.Opcode.OP_TOALTSTACK,

      // {6} ROLL SIZE {4} EQUALVERIFY CAT          // check size of extra_nonce_1
      bsv.Opcode.OP_6,
      bsv.Opcode.OP_ROLL,
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_4,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CAT,

      // {6} ROLL SIZE {8} EQUALVERIFY CAT          // check size of extra_nonce_2
      bsv.Opcode.OP_6,
      bsv.Opcode.OP_ROLL,
      bsv.Opcode.OP_SIZE,
      Buffer.from("20", "hex"),                   // push 32 to the stack.
      bsv.Opcode.OP_LESSTHANOREQUAL,
      bsv.Opcode.OP_VERIFY,
      bsv.Opcode.OP_CAT,

      // SWAP CAT HASH256                           // create metadata string and hash it.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_HASH256,

      // SWAP TOALTSTACK CAT CAT                    // target and content + merkleroot to altstack.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_TOALTSTACK,
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_TOALTSTACK,

      Buffer.from("ff1f00e0", "hex"),               // combine version/category with general purpose bits.
      bsv.Opcode.OP_DUP,
      bsv.Opcode.OP_INVERT,
      bsv.Opcode.OP_TOALTSTACK,
      bsv.Opcode.OP_AND,

      bsv.Opcode.OP_SWAP,                           // general purpose bits
      bsv.Opcode.OP_FROMALTSTACK,
      bsv.Opcode.OP_AND,
      bsv.Opcode.OP_OR,

      bsv.Opcode.OP_FROMALTSTACK,                   // attach content + merkleroot
      bsv.Opcode.OP_CAT,

      // SWAP SIZE {4} EQUALVERIFY CAT              // check size of timestamp.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_4,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CAT,

      // FROMALTSTACK CAT                           // attach target
      bsv.Opcode.OP_FROMALTSTACK,
      bsv.Opcode.OP_CAT,

      // SWAP SIZE {4} EQUALVERIFY CAT             // check size of nonce. Boost POW string is constructed.
      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_4,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CAT,

      // Take hash of work string and ensure that it is positive and minimally encoded.
      bsv.Opcode.OP_HASH256, ...Job.ensure_positive(),

      bsv.Opcode.OP_FROMALTSTACK, ...Job.expand_target(), ...Job.ensure_positive(),

      // check that the hash of the Boost POW string is less than the target
      bsv.Opcode.OP_LESSTHAN,
      bsv.Opcode.OP_VERIFY,

      // check that the given address matches the pubkey and check signature.
      // DUP HASH160 FROMALTSTACK EQUALVERIFY CHECKSIG
      bsv.Opcode.OP_DUP,
      bsv.Opcode.OP_HASH160,
      bsv.Opcode.OP_FROMALTSTACK,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_CHECKSIG,
    ]
  }

  /*
  expand_target - transforms the uint32 exponential (compact) format for the difficulty target into the full uint256 value.
  */
  static expand_target() {
    return [
      bsv.Opcode.OP_SIZE,
      bsv.Opcode.OP_4,
      bsv.Opcode.OP_EQUALVERIFY,
      bsv.Opcode.OP_3,
      bsv.Opcode.OP_SPLIT,
      bsv.Opcode.OP_DUP,
      bsv.Opcode.OP_BIN2NUM,
      bsv.Opcode.OP_3,
      Buffer.from('21', 'hex'),   // actually 33, but in hex
      bsv.Opcode.OP_WITHIN,
      bsv.Opcode.OP_VERIFY,
      bsv.Opcode.OP_TOALTSTACK,
      bsv.Opcode.OP_DUP,
      bsv.Opcode.OP_BIN2NUM,
      bsv.Opcode.OP_0,
      bsv.Opcode.OP_GREATERTHAN,
      bsv.Opcode.OP_VERIFY,
      Buffer.from('0000000000000000000000000000000000000000000000000000000000', 'hex'),
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_FROMALTSTACK,
      bsv.Opcode.OP_3,
      bsv.Opcode.OP_SUB,
      bsv.Opcode.OP_8,
      bsv.Opcode.OP_MUL,
      bsv.Opcode.OP_RSHIFT,
    ]
  }

  /*
  Numbers in Bitcoin script are in little endian and the last bit is a sign bit.
  However, the target and the hash digest are both supposed to be positive
  numbers. Thus, we have to attach an extra byte of zeros to numbers if they
  would be treated as negative in Bitcoin script.
  */
  static ensure_positive() {
    return [
      Buffer.from('00', 'hex'),
      bsv.Opcode.OP_CAT,
      bsv.Opcode.OP_BIN2NUM
    ]
  }

  // reverse endianness. Cuz why not?
  static reverse32() {
    return [
      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_1,
      bsv.Opcode.OP_SPLIT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,

      bsv.Opcode.OP_SWAP,
      bsv.Opcode.OP_CAT,
    ]
  }
}
