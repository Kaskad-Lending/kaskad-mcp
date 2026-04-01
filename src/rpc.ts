import { AbiCoder, Interface, InterfaceAbi } from "ethers";
import { RPC_URL } from "./contracts.js";

let _reqId = 1;

/** Raw JSON-RPC call */
export async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: _reqId++,
    method,
    params,
  });

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

/** eth_blockNumber → number */
export async function getBlockNumber(): Promise<number> {
  const hex = (await rpcCall("eth_blockNumber", [])) as string;
  return parseInt(hex, 16);
}

/** eth_call helper — returns raw hex result */
export async function ethCall(to: string, data: string): Promise<string> {
  return (await rpcCall("eth_call", [{ to, data }, "latest"])) as string;
}

/** Pad an address to 32-byte ABI word */
export function padAddress(addr: string): string {
  return "000000000000000000000000" + addr.replace(/^0x/, "").toLowerCase();
}

// Shared AbiCoder instance
const coder = AbiCoder.defaultAbiCoder();

/** Decode a single return value */
export function decode(types: string[], data: string): unknown[] {
  return coder.decode(types, data) as unknown[];
}

/** Call a view function using ethers Interface */
export async function callFunction(
  abi: InterfaceAbi,
  address: string,
  funcName: string,
  args: unknown[] = []
): Promise<unknown[]> {
  const iface = new Interface(abi);
  const encoded = iface.encodeFunctionData(funcName, args);
  const result = await ethCall(address, encoded);
  return iface.decodeFunctionResult(funcName, result) as unknown[];
}

/** Wrap any on-chain call with RPC-down error handling */
export async function safeCall<T>(
  fn: () => Promise<T>
): Promise<T | { error: string; rpc: string }> {
  try {
    return await fn();
  } catch (err) {
    return {
      error: "Igra testnet RPC unavailable",
      rpc: RPC_URL,
    };
  }
}
