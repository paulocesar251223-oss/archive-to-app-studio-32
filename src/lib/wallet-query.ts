import { queryOptions } from '@tanstack/react-query';
import { getWallet } from './wallet.functions';

export const walletQuery = queryOptions({ queryKey: ['wallet'], queryFn: () => getWallet(), staleTime: 0 });
