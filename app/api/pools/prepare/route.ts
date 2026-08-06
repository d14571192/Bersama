import { preparePool } from '@/server/controller/pool.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

// Simulates the fund_pool invoke against Soroban RPC.
export const maxDuration = 60;

export const POST = compose(withError, withRateLimit, withAuth)(preparePool);
