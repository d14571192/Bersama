import { createPool, listPools } from '@/server/controller/pool.controller';
import { compose } from '@/server/middleware/compose';
import { withAuth } from '@/server/middleware/withAuth';
import { withError } from '@/server/middleware/withError';
import { withRateLimit } from '@/server/middleware/withRateLimit';

// createPool submits the signed fund_pool invoke and polls Soroban to finality.
export const maxDuration = 60;

export const GET = compose(withError)(listPools);
export const POST = compose(withError, withRateLimit, withAuth)(createPool);
