/**
 * Internal Stellar / Soroban module. Import the whole surface from here:
 *
 *   import { buildDonateXdr, submitDonate, network } from '@/server/stellar';
 */
export { network, horizon, soroban } from './network';
export { assetFor, USDC_ISSUER } from './assets';
export { buildTrustlineXdr, submitClassicXdr } from './payments';
export { submitInvoke } from './rpc';
export {
  newPoolKey,
  buildFundPoolXdr,
  buildDonateXdr,
  submitFundPool,
  submitDonate,
  readPoolRemaining,
  readPoolBalanceStroops,
  type FundResult,
  type DonateResult,
} from './matchPool';
