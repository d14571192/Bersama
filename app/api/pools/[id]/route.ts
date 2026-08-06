import { getPool } from '@/server/controller/pool.controller';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';

export const GET = compose(withError)(getPool);
