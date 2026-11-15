import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { CheckCircle2 } from 'lucide-react';
import { setReferralCode } from '@/lib/admin.functions';
import { adminErrorMessage } from '@/lib/admin-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  userId: string;
  status: string;
  currentCode: string;
};

export function ReferralCodeEditor({ userId, status, currentCode }: Props) {
  const client = useQueryClient();
  const approve = useServerFn(setReferralCode);
  const [code, setCode] = useState(status === 'approved' ? currentCode : '');
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: () => approve({ data: { userId, code: code.trim().toUpperCase() } }),
    onSuccess: async (result) => {
      setCode(result.code);
      setMessage(`Código ${result.code} aprovado.`);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'player', userId] }),
        client.invalidateQueries({ queryKey: ['admin', 'audit'] }),
      ]);
    },
  });
  const statusLabel = status === 'approved' ? 'Aprovado' : status === 'pending' ? 'Aguardando análise' : 'Não solicitado';

  return <div className="mt-6 border-t border-border pt-5">
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor="referral-code-approval">Gerar ou aprovar código de indicação</Label>
      <span className="text-xs text-muted-foreground">{statusLabel}</span>
    </div>
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <Input
        id="referral-code-approval"
        value={code}
        onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setMessage(''); }}
        placeholder="Gerar automaticamente"
        maxLength={8}
        autoComplete="off"
        className="font-mono uppercase"
      />
      <Button type="button" variant="outline" className="shrink-0" disabled={mutation.isPending} onClick={() => { setMessage(''); mutation.mutate(); }}>
        {mutation.isPending ? 'Aprovando…' : code.trim() ? 'Aprovar código' : 'Gerar e aprovar'}
      </Button>
    </div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Use 8 letras ou números, ou deixe vazio para gerar um código único. A aprovação fica registrada na auditoria.</p>
    {mutation.error && <p role="alert" className="mt-2 text-sm text-destructive">{adminErrorMessage(mutation.error)}</p>}
    {message && <p role="status" className="mt-2 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />{message}</p>}
  </div>;
}
