import { queryOptions } from '@tanstack/react-query';
import { getPlayerSafety } from './player.functions';
export const playerSafetyQuery = queryOptions({ queryKey: ['player-safety'], queryFn: () => getPlayerSafety(), staleTime: 0 });