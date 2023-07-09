"use strict"
var expect = require("chai").expect
var index = require("..")

var bsv = require("bsv")

var tx_build = require("../dist/transaction.js")

describe("boost Puzzle createRedeemTransaction", () => {
  it("createRedeemTransaction success", async () => {
    // const job =
    // index.BoostPowJob.fromRawTransaction('01000000013cdee5edfaec88f5ec5d4048c35ba1ed595a5c3dc8efc5360f8a26ec08621dcb010000006b483045022100af4682a0b78dc943f0f0f7fa85d3b4efe7291cad3f33a615e195f59b7d6c56f402207ee620e1848986128c95c07f1e2110fc1d165075bd6b4cbd2c1e24a9c566840b4121021e25de581fcd348717345e8f4c1996990b42f5914e1942b8356292100e43d427ffffffff02c922000000000000fd500108626f6f7374706f777504000000002035b8fcb6882f93bddb928c9872198bcdf057ab93ed615ad938f24a63abde588104ffff001d14000000000000000000000000000000000000000004000000002000000000000000000000000000000000000000000000000000000000000000007e7c557a766b7e5279825488537f7653a269760120a1696b1d00000000000000000000000000000000000000000000000000000000007e6c5394986b557a8254887e557a8258887e7c7eaa517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c6b7e7e7c8254887e6c7e7c8254887eaa6c9f6976a96c88ace88df104000000001976a91432accdcb557ed57b9f01b4c42d69d4c9ea5d972a88ac00000000');
    const output = index.Output.fromTransaction(
      "010000000174d9f6dc235207fbbcdff7bdc412dcb375eb634da698ed164cc1e9aa1b88729a040000006b4830450221008596410738406e0e8589292a0e7a4d960e739025ab1859a3df6c77b4cf8c59ac0220733024f199162bc7b9ccd648aae56f0a0e307558a9827a26d35b1016de1865c54121025a77fe27d1db166b660205ff08b97f7dd87c7c68edaa2931895c2c8577f1a351ffffffff027d20000000000000e108626f6f7374706f777504000000002035b8fcb6882f93bddb928c9872198bcdf057ab93ed615ad938f24a63abde588104ffff001d14000000000000000000000000000000000000000004000000002000000000000000000000000000000000000000000000000000000000000000007e7c557a766b7e52796b557a8254887e557a8258887e7c7eaa7c6b7e7e7c8254887e6c7e7c8254887eaa01007e816c825488537f7681530121a5696b768100a0691d00000000000000000000000000000000000000000000000000000000007e6c539458959901007e819f6976a96c88acb461590e000000001976a914ba6e459a2b505dc78e44e8c5874776c00890e16088ac00000000"
    )

    expect(output.txid.hex).to.eql(
      "4eb545a588a21045495e74449b348ce1eb8f48ac95356c519a2a85a57731a518"
    )

    const jobProof = index.BoostPowJobProof.fromObject({
      signature: "00",
      minerPubKey:
        "020370f418d21765b33bc093db143aa1dd5cfefc97275652dc8396c2d567f93d65",
      extraNonce1: "0a00000a",
      extraNonce2: "bf07000000000000",
      time: "81c06d5e",
      nonce: "e069a11c",
      minerPubKeyHash: "9fb8cb68b8850a13c7438e26e1d277b748be657a",
    })

    const powString = index.BoostPowJob.tryValidateJobProof(output.script, jobProof)
    expect(powString).to.not.eql(null)

    expect(powString.boostPowString.toString()).to.eql(
      "0000000035b8fcb6882f93bddb928c9872198bcdf057ab93ed615ad938f24a63abde588119401f4fd9d4279f4ead46f2bd3ccaabce904f7e17367338c08b2a4aefb9877681c06d5effff001de069a11c"
    )

    expect(powString.boostPowString.hash.hex).to.eql(
      "0000000000f0e97bec0c369dd6c7cbde0243a351d8ab138778717c63660afa35"
    )

    let expected_tx = (
      "010000000118a53177a5852a9a516c3595ac488febe18c349b44745e494510" +
      "a288a545b54e0000000098483045022100d447110684b8fa1b9071be6efbda" +
      "80f26107a7dacf4ad143963780dd952f730002202735d07575e917b13ae8b8" +
      "a8527455f754db8cc42b74332429be1f1d35c100a44121020370f418d21765" +
      "b33bc093db143aa1dd5cfefc97275652dc8396c2d567f93d6504e069a11c04" +
      "81c06d5e08bf07000000000000040a00000a149fb8cb68b8850a13c7438e26" +
      "e1d277b748be657affffffff0248200000000000001976a9140bed1b97a1ec" +
      "681cf100ee8b11800a54b39b9fda88ac000000000000000011006a08626f6f" +
      "7374706f770570726f6f6600000000")

    let wif = "5d5c870220eeb18afe8a498324013955c316cbaaed2a824e5230362c36964c27"
    let sats_per_byte = .2

    let tx = new index.Puzzle(output, wif).createRedeemTransaction(
      jobProof.solution, "1264UeZnzrjrMdYn1QSED5TCbY8Gd11e23", sats_per_byte, [
        "boostpow", "proof"
      ]
    )

    let bsv_tx = bsv.Transaction(tx).toJSON()

    // check that the fee is reasonable
    let fee = output.value - bsv_tx.outputs[0].satoshis
    expect(fee / tx.length >= sats_per_byte).to.eql(true)
    expect(fee / tx.length > sats_per_byte + .1).to.eql(false)

    let tx_string = tx.toString('hex')

    // this part is the tx version and the previous outpoint.
    expect(tx_string.substr(0, 82)).to.eql(expected_tx.substr(0, 82))
    // the rest of the input script up to the end of the tx.
    expect(tx_string.substr(tx_string.length - 246)).to.eql(expected_tx.substr(expected_tx.length - 246))

    // now check the signature.
    expect(tx_build.verify(
      (new bsv.PrivateKey(wif)).toPublicKey(),
      index.Redeem.fromScript(new bsv.Script(bsv_tx.inputs[0].script)).signature.buffer,
      {satoshis: output.value,
        scriptCode: output.script.toScript(),
        inputIndex: 0,
        incompleteTransaction: tx})).to.eql(true)
  })
})
