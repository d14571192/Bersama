import { confirmDonation, listDonations } from '@/server/controller/pool.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

// confirmDonation submits the donor-signed donate invoke (atomic gift + match)
// and polls Soroban to finality.
export const maxDuration = 60;

export const GET = compose(withError)(listDonations);
// Submits the donor-signed donate invoke. Requires a wallet session.
export const POST = compose(withError, withRateLimit, withAuth)(confirmDonation);
