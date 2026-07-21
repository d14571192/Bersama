import { logout } from '@/server/controller/auth.controller';
import { compose } from '@/server/middleware/compose';
import { withError } from '@/server/middleware/withError';

export const POST = compose(withError)(logout);
