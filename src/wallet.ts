import { ethers } from "ethers";

/**
 * Creates a signer from the process environment only.
 * Plaintext wallet-file fallbacks are intentionally unsupported.
 */
export function loadWallet(provider: ethers.JsonRpcProvider): ethers.Wallet {
  const raw = process.env.MCP_WALLET_KEY?.trim();
  const key = raw ? (raw.startsWith("0x") ? raw : `0x${raw}`) : "";
  if (!ethers.isHexString(key, 32)) {
    throw new Error("No valid MCP_WALLET_KEY supplied; plaintext wallet-file fallbacks are disabled.");
  }
  return new ethers.Wallet(key, provider);
}
