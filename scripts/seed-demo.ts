/**
 * Bersama seed — two REAL on-chain XLM match pools.
 *
 * Each pool is funded for real by locking XLM into the Match Pool Soroban
 * contract (signed with the deployer key), then recorded with the live
 * `poolKey`, `fundTxHash`, and remaining returned by the contract. No fake
 * donors or personas: donations only ever come from real wallet flows.
 */
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { db } from '../src/server/db/client';
import { donations, matchPools } from '../src/server/db/schema';
import { buildFundPoolXdr, newPoolKey, submitFundPool } from '../src/server/stellar';
import { network } from '../src/server/stellar/network';

// Deployer = on-chain sponsor of the seeded pools (testnet key).
const DEPLOYER_SECRET =
  process.env.DEPLOYER_SECRET ?? 'SDL4SWRGFBZ5XBB5EORL3BHLUSETFBVVQ6OIESURFR7D4BFQQJKMJI3P';
// Funded testnet payout address the seeded causes pay out to.
const DEMO_CAUSE = 'GCWPQRAYEA2YQLROBWCARMGSOHYO4SQWPZU7QF7NWGMVQX6PVASDP3DY';

const SEED_POOLS = [
  {
    causeName: 'Clean Water for Coastal Villages',
    causeDescription:
      'Funding rainwater harvesting and filtration for villages with no reliable safe-water source. Every gift is doubled while the match fund lasts.',
    matchStroops: '1000000000', // 100 XLM
  },
  {
    causeName: 'Solar Lamps for Off-Grid Schools',
    causeDescription:
      'Putting rechargeable solar study lamps into classrooms and homes without electricity, so students can keep learning after dark.',
    matchStroops: '500000000', // 50 XLM
  },
];

async function seed() {
  const kp = Keypair.fromSecret(DEPLOYER_SECRET);
  const sponsor = kp.publicKey();
  console.log(`Seeding Bersama match pools (sponsor ${sponsor})…`);

  await db.delete(donations);
  await db.delete(matchPools);

  for (const p of SEED_POOLS) {
    const poolKey = newPoolKey();
    console.log(`  Funding "${p.causeName}" (${poolKey.slice(0, 10)}…) on-chain…`);
    const xdr = await buildFundPoolXdr({
      sponsor,
      poolKey,
      cause: DEMO_CAUSE,
      stroops: p.matchStroops,
    });
    const signed = TransactionBuilder.fromXDR(xdr, network.passphrase);
    signed.sign(kp);
    const fund = await submitFundPool(signed.toXDR());
    console.log(`    funded ${fund.totalFunded} stroops, tx ${fund.hash}`);

    await db.insert(matchPools).values({
      sponsorPublicKey: sponsor,
      sponsorName: 'Bersama Community Match',
      causeName: p.causeName,
      causeDescription: p.causeDescription,
      causePublicKey: DEMO_CAUSE,
      asset: 'XLM',
      poolKey,
      totalFundedMinor: fund.totalFunded,
      remainingMinor: fund.remaining,
      matchedMinor: '0',
      status: 'active',
      fundTxHash: fund.hash,
    });
  }

  console.log(`Seeded ${SEED_POOLS.length} on-chain XLM match pools.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
