const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { rayToAPY, toUSD } = require("../dist/tools/getMarkets.js");
const { baseToUSD, wadToHF } = require("../dist/tools/getPosition.js");

describe("rayToAPY", () => {
  it("converts zero rate to zero APY", () => {
    assert.equal(rayToAPY(0n), 0);
  });

  it("converts 1e25 (1% in RAY) to 1", () => {
    const onePercent = 10n ** 25n;
    assert.equal(rayToAPY(onePercent), 1);
  });

  it("converts 5e25 (5% in RAY) to 5", () => {
    const fivePercent = 5n * 10n ** 25n;
    assert.equal(rayToAPY(fivePercent), 5);
  });

  it("converts real-world rate (4.766% APY)", () => {
    // 4.766% = 4.766e25 in RAY
    const rate = 47660000000000000000000000n;
    const result = rayToAPY(rate);
    assert.ok(result >= 4.76 && result <= 4.77, `Expected ~4.766, got ${result}`);
  });

  it("handles very small rates without precision loss", () => {
    const tinyRate = 10n ** 22n; // 0.001% in RAY
    const result = rayToAPY(tinyRate);
    assert.ok(result >= 0 && result < 0.01, `Expected near-zero, got ${result}`);
  });
});

describe("toUSD", () => {
  it("converts 1 USDC (6 dec) at $1 to 1 USD", () => {
    const amount = 1_000_000n; // 1 USDC (6 decimals)
    const price = 100_000_000n; // $1 with 8 decimals
    assert.equal(toUSD(amount, price, 6), 1);
  });

  it("converts 1 WETH (18 dec) at $3000 to 3000 USD", () => {
    const amount = 10n ** 18n;
    const price = 300_000_000_000n; // $3000 with 8 decimals
    assert.equal(toUSD(amount, price, 18), 3000);
  });

  it("converts 0.5 WBTC (8 dec) at $60000", () => {
    const amount = 50_000_000n; // 0.5 WBTC (8 decimals)
    const price = 6_000_000_000_000n; // $60000 with 8 decimals
    assert.equal(toUSD(amount, price, 8), 30000);
  });

  it("returns 0 for zero amount", () => {
    assert.equal(toUSD(0n, 100_000_000n, 18), 0);
  });

  it("returns 0 for zero price", () => {
    assert.equal(toUSD(10n ** 18n, 0n, 18), 0);
  });
});

describe("baseToUSD", () => {
  it("converts 0 to 0", () => {
    assert.equal(baseToUSD(0n), 0);
  });

  it("converts 1e8 (=$1 in base-8) to 1", () => {
    assert.equal(baseToUSD(100_000_000n), 1);
  });

  it("converts 5000e8 to 5000", () => {
    assert.equal(baseToUSD(500_000_000_000n), 5000);
  });

  it("handles sub-dollar precision", () => {
    assert.equal(baseToUSD(50_000_000n), 0.5);
  });
});

describe("wadToHF", () => {
  it("returns 'N/A' for zero", () => {
    assert.equal(wadToHF(0n), "N/A");
  });

  it("returns '∞' for very large values", () => {
    const huge = 10n ** 31n;
    assert.equal(wadToHF(huge), "∞");
  });

  it("converts 1 WAD to health factor 1", () => {
    const oneWad = 10n ** 18n;
    assert.equal(wadToHF(oneWad), 1);
  });

  it("converts 2.5 WAD to 2.5", () => {
    const twoPointFive = 25n * 10n ** 17n;
    assert.equal(wadToHF(twoPointFive), 2.5);
  });

  it("converts 1.0001 WAD correctly (4 decimal precision)", () => {
    const val = 10001n * 10n ** 14n;
    assert.equal(wadToHF(val), 1.0001);
  });
});
