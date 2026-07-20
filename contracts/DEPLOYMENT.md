## ✅ Mainnet (live)

| Field | Value |
|-------|-------|
| **Network** | Stellar **public** (Public Global Stellar Network ; September 2015) |
| **Contract ID** | `CDYRUMJ4WMWRGTFKWNUTFR3UE2T5VTQ64REVXOKUZPF6AH25NGE2P5OO` |

Explorer: https://stellar.expert/explorer/public/contract/CDYRUMJ4WMWRGTFKWNUTFR3UE2T5VTQ64REVXOKUZPF6AH25NGE2P5OO

Note: this deployment predates this file being kept in sync with it — the wasm hash, admin key, and deploy-cost/tx history that the testnet record below captures weren't recorded at deploy time. The contract ID and explorer link above are confirmed live; nothing else about the deploy is documented here.

---

# Match Pool — Testnet Deployment

| Field | Value |
|-------|-------|
| **Network** | Stellar Testnet |
| **Contract ID** | `CCSHXAYAZ42OZK6JTXSTDDV3UAOTKRCM6UFNYYT4NM2HWB4S3Z4W3H67` |
| **Wasm hash** | `d557ea2eeee5015d03836bb5576ecacb60666b4acc226e022f6d342b34805531` |
| **Admin / deployer** | `GBL5RJKF4QNJ4ZPLJZ7PS7K5A4J44VEZJRV2CRTFFDRVSY2N76AIIE47` |
| **Default token (XLM SAC)** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **RPC** | `https://soroban-testnet.stellar.org` |
| **Toolchain** | `cargo +1.89.0`, target `wasm32-unknown-unknown`, Stellar CLI v27 |

Explorer: https://stellar.expert/explorer/testnet/contract/CCSHXAYAZ42OZK6JTXSTDDV3UAOTKRCM6UFNYYT4NM2HWB4S3Z4W3H67

## What it does

A sponsor funds a 1:1 match pool for a cause. Whenever a donor gives, the contract
pulls the gift from the donor and pays the cause **gift + match** (`match =
min(gift, remaining)`) in a single atomic transaction. Donation, match and pool
accounting all settle on-chain.

## Entrypoints

- `initialize(admin, token)` — one-time; records the deployer as admin and the XLM SAC as the default token.
- `fund_pool(sponsor, pool_id, cause, amount) -> Pool` — sponsor locks match funds for a cause; create or top up.
- `donate(donor, pool_id, amount) -> Receipt` — donor gift is paid to the cause with its 1:1 match, atomically. Returns `{ donated, matched, total, remaining }`.
- Views: `get_pool`, `pool_remaining`, `total_donated`, `total_matched`, `is_paused`, `get_token`, `get_admin`.
- Admin: `pause`, `unpause`, `set_admin`, `upgrade`.

`pool_id` is a `BytesN<32>` — the app generates a random 32-byte key per cause and stores
it alongside the Postgres pool row, so each cause maps to a stable on-chain pool.

## Seeded demo pool (testnet)

| Field | Value |
|-------|-------|
| **pool_id** | `b98873c77d71cd8d5d0cd526afb480782f88f6660f6249cc50049bdcfc7aaf7d` |
| **cause** | `GCWPQRAYEA2YQLROBWCARMGSOHYO4SQWPZU7QF7NWGMVQX6PVASDP3DY` |
| **funded** | 100 XLM |

## Rebuild / redeploy

```bash
cd contracts
make test          # cargo +1.89.0 test — 14 unit tests, 0 failed
make optimize      # build + stellar contract optimize
./scripts/deploy.sh
```

## Mainnet switch

Set `NETWORK=public`, fund the deployer, then re-run `./scripts/deploy.sh public`.
The XLM SAC on mainnet differs; pass it as `XLM_SAC=...`.
