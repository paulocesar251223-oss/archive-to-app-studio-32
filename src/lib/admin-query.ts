import { queryOptions } from '@tanstack/react-query';
import { getAdminAccess } from './admin.functions';

export const adminAccessQuery = queryOptions({
  queryKey: ['admin', 'access'],
  queryFn: () => getAdminAccess(),
  staleTime: 0,
});
