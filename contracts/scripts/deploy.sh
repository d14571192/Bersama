#!/usr/bin/env bash
#
# Deploy the Match Pool contract to Stellar Testnet (or Mainnet) with the Stellar CLI.
#
# Prereqs:
#   - Rust 1.89 + wasm32-unknown-unknown target  (rustup target add wasm32-unknown-unknown)
#   - Stellar CLI v23+                            (cargo install --locked stellar-cli)
#   - A funded identity named "deployer"         (stellar keys ...)
#
# Usage:
#   ./scripts/deploy.sh                # testnet, identity "deployer"
#   NETWORK=public IDENTITY=prod ./scripts/deploy.sh
#
set -euo pipefail

NETWORK="${1:-${NETWORK:-testnet}}"
IDENTITY="${IDENTITY:-deployer}"
RPC_URL="${RPC_URL:-https://soroban-${NETWORK}.stellar.org}"
PASSPHRASE="${PASSPHRASE:-Test SDF Network ; September 2015}"
WASM="target/wasm32-unknown-unknown/release/match_pool.optimized.wasm"

# Native XLM Stellar Asset Contract (SAC) on testnet — no trustline required.
XLM_SAC="${XLM_SAC:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"

cd "$(dirname "$0")/.."

echo "* Network: $NETWORK   Identity: $IDENTITY"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"
echo "* Admin / deployer: $ADMIN_ADDR"

echo "* Building contract (cargo +1.89.0, wasm32-unknown-unknown)..."
cargo +1.89.0 build --release --target wasm32-unknown-unknown
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/match_pool.wasm

echo "* Deploying..."
CONTRACT_ID=""
for _ in 1 2 3 4 5; do
  CONTRACT_ID=$(stellar contract deploy --wasm "$WASM" --source "$IDENTITY" \
    --network "$NETWORK" --rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE" 2>/dev/null || true)
  [ -n "$CONTRACT_ID" ] && break
  sleep 8
done
echo "* Contract id: $CONTRACT_ID"

echo "* Initializing (admin + XLM SAC)..."
for _ in 1 2 3 4 5; do
  if stellar contract invoke --id "$CONTRACT_ID" --source "$IDENTITY" \
       --network "$NETWORK" --rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE" \
       -- initialize --admin "$ADMIN_ADDR" --token "$XLM_SAC"; then
    break
  fi
  sleep 10
done

echo ""
echo "Done. Add these to your app env (.env.local / Vercel):"
echo "   SOROBAN_RPC_URL=$RPC_URL"
echo "   MATCH_POOL_CONTRACT_ID=$CONTRACT_ID"
echo "   NEXT_PUBLIC_MATCH_POOL_CONTRACT_ID=$CONTRACT_ID"
echo "   XLM_SAC_CONTRACT_ID=$XLM_SAC"
