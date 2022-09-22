"use strict"
const expect = require("chai").expect
const index = require("..")


describe("Test Util functions", function(){

  it("doesnt loop with a difficulty of 0", function()  {
      this.timeout(1000);
        expect(index.BoostUtilsHelper.difficulty2bits.bind(index.BoostUtilsHelper.difficulty2bits,0)).to.throw("difficulty cannot be zero");
  })
})