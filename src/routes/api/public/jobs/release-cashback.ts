import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

const bodySchema = z.object({ job: z.literal('release-cashback') }).strict();

export const Route = createFileRoute('/api/public/jobs/release-cashback')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = bodySchema.safeParse(await request.json());
        if (!body.success) return Response.json({ error: 'INVALID_JOB_BODY' }, { status: 400 });
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data, error } = await supabaseAdmin.rpc('release_cashback_installments');
        if (error) {
          console.error('Cashback release failed', error.message);
          return Response.json({ error: 'CASHBACK_RELEASE_FAILED' }, { status: 500 });
        }
        return Response.json({ ok: true, released: Number(data ?? 0) });
      },
    },
  },
});
