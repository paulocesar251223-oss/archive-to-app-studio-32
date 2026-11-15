import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));

import { getAccount } from '@/lib/account.functions';

describe('Account profile loading', () => {
  const maybeSingle = vi.fn();
  const rpc = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq })) })), rpc };
  const load = getAccount as unknown as (input: { context: { supabase: typeof supabase; userId: string } }) => Promise<unknown>;

  beforeEach(() => { vi.clearAllMocks(); });

  it('loads only the signed-in profile and its ledger balance', async () => {
    const profile = { user_id: 'signed-in-user', status: 'pending', kyc_submitted_at: null };
    maybeSingle.mockResolvedValue({ data: profile, error: null });
    rpc.mockResolvedValue({ data: '12.50', error: null });
    await expect(load({ context: { supabase, userId: 'signed-in-user' } })).resolves.toEqual({ profile, balance: 12.5 });
    expect(eq).toHaveBeenCalledWith('user_id', 'signed-in-user');
    expect(rpc).toHaveBeenCalledWith('get_balance', { _user_id: 'signed-in-user' });
  });

  it('rejects a missing profile explicitly without reading a balance', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(load({ context: { supabase, userId: 'signed-in-user' } })).rejects.toThrow('Your account profile is missing.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('preserves database failures rather than treating them as missing profiles', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(load({ context: { supabase, userId: 'signed-in-user' } })).rejects.toThrow('permission denied');
    expect(rpc).not.toHaveBeenCalled();
  });
});