/**
 * Single source of truth for Stellar / Soroban network configuration.
 *
 * Everything (passphrase, Horizon, Soroban RPC, the XLM SAC, and the deployed
 * Match Pool contract id) is derived here from validated env, so no other module
 * hand-rolls a passphrase or URL.
 */
import { Horizon, Networks, rpc } from '@stellar/stellar-sdk';
import { env } from '@/server/config/env';

const NETWORKS = {
  testnet: { passphrase: Networks.TESTNET, horizon: 'https://horizon.stellar.org' },
  public: { passphrase: Networks.PUBLIC, horizon: 'https://horizon.stellar.org' },
  futurenet: { passphrase: Networks.FUTURENET, horizon: 'https://horizon-futurenet.stellar.org' },
} as const;

const cfg = NETWORKS[env.STELLAR_NETWORK];

export const network = {
  name: env.STELLAR_NETWORK,
  passphrase: env.STELLAR_NETWORK_PASSPHRASE || cfg.passphrase,
  horizonUrl: env.STELLAR_HORIZON_URL || cfg.horizon,
  rpcUrl: env.SOROBAN_RPC_URL,
  /** Native XLM Stellar Asset Contract (no trustline required). */
  xlmSac: env.XLM_SAC_CONTRACT_ID,
  /** Deployed Match Pool Soroban contract. */
  matchPoolContractId: env.MATCH_POOL_CONTRACT_ID,
} as const;

/** Horizon client — classic operations (trustlines, account lookups). */
export const horizon = new Horizon.Server(network.horizonUrl);

/** Soroban RPC client — contract simulate / submit / poll. */
export const soroban = new rpc.Server(network.rpcUrl, {
  allowHttp: network.rpcUrl.startsWith('http://'),
});
