/**
 * Server-side asset helpers. XLM is native (no trustline); USDC is the opt-in
 * stablecoin used only for the changeTrust ("Enable USDC") flow.
 */
import { Asset } from '@stellar/stellar-sdk';
import { env } from '@/server/config/env';
import type { AssetCode } from '@/lib/assets';

export const USDC_ISSUER = env.USDC_ASSET_ISSUER_TESTNET;

export function assetFor(code: AssetCode): Asset {
  return code === 'XLM' ? Asset.native() : new Asset('USDC', USDC_ISSUER);
}
