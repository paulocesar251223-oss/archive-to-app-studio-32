import { useState, type FormEvent } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Plus, Save, Trophy } from 'lucide-react';
import { getAdminSettings, saveAchievement, saveGameSettings, saveMissionTerms } from '@/lib/admin.functions';
import { adminErrorMessage } from '@/lib/admin-rules';
import type { Database, Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeader } from '@/components/admin/admin-ui';
import { adminHead } from '@/lib/metadata';

type Game = Database['public']['Tables']['game_settings']['Row'];
type Achievement = Database['public']['Tables']['achievements']['Row'];
export const Route = createFileRoute('/_authenticated/admin/settings')({
  head: () => adminHead('Configurações', 'Gerencie RTP, limites dos jogos, termos da missão e conquistas.'),
  component: AdminSettings,
});
function AdminSettings() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => getAdminSettings() });
  const [editor, setEditor] = useState<Achievement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  async function refresh() { await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'settings'] }), client.invalidateQueries({ queryKey: ['admin', 'audit'] })]); }
  if (query.isLoading) return <LoadingPanel />;
  if (query.error) return <ErrorPanel error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return null;
  return <><PageHeader title="Configurações" description="Alterações entram em vigor após salvar e ficam registradas na auditoria." action={<Button onClick={() => { setEditor(null); setEditorOpen(true); }}><Plus />Nova conquista</Button>} /><section><h2 className="mb-4 text-xl font-semibold">RTP e limites por jogo</h2><div className="space-y-4">{query.data.games.map((game) => <GameEditor key={`${game.game}-${game.updated_at}`} game={game} onSaved={refresh} />)}<GameEditor game={null} onSaved={refresh} /></div></section><section className="mt-10"><h2 className="mb-4 text-xl font-semibold">Termos da missão</h2><MissionEditor value={query.data.missionTerms} onSaved={refresh} /></section><section className="mt-10"><h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Trophy className="h-5 w-5" />Conquistas</h2>{!query.data.achievements.length ? <EmptyPanel title="Nenhuma conquista" description="Crie a primeira recompensa para os jogadores." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.achievements.map((achievement) => <button key={achievement.id} className="border border-border p-5 text-left transition-colors hover:bg-accent" onClick={() => { setEditor(achievement); setEditorOpen(true); }}><div className="flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">{achievement.code}</span><span className="text-xs">{achievement.active ? 'Ativa' : 'Inativa'}</span></div><h3 className="mt-4 font-semibold">{achievement.title_en}</h3><p className="mt-1 text-sm text-muted-foreground">{achievement.title_ru}</p><p className="mt-4 font-mono text-sm">Recompensa {achievement.reward_amount}</p></button>)}</div>}</section><Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor ? 'Editar conquista' : 'Nova conquista'}</DialogTitle></DialogHeader><AchievementEditor key={editor?.id ?? 'new'} achievement={editor} onSaved={async () => { setEditorOpen(false); await refresh(); }} /></DialogContent></Dialog></>;
}
function GameEditor({ game, onSaved }: { game: Game | null; onSaved: () => Promise<void> }) {
  const save = useServerFn(saveGameSettings);
  const [name, setName] = useState(game?.game ?? '');
  const [rtp, setRtp] = useState(String(game?.rtp ?? 96));
  const [minBet, setMinBet] = useState(String(game?.min_bet ?? 1));
  const [maxBet, setMaxBet] = useState(String(game?.max_bet ?? 100));
  const [enabled, setEnabled] = useState(game?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await save({ data: { game: name, rtp: Number(rtp), minBet: Number(minBet), maxBet: Number(maxBet), enabled } }); if (!game) setName(''); await onSaved(); } catch (cause) { setError(adminErrorMessage(cause)); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="border border-border p-5"><div className="grid items-end gap-4 md:grid-cols-5"><div><Label>Nome interno</Label><Input className="mt-2 font-mono" required value={name} readOnly={Boolean(game)} onChange={(event) => setName(event.target.value)} placeholder="slots" /></div><div><Label>RTP (%)</Label><Input className="mt-2" type="number" min="0.01" max="100" step="0.01" required value={rtp} onChange={(event) => setRtp(event.target.value)} /></div><div><Label>Aposta mín.</Label><Input className="mt-2" type="number" min="0.01" step="0.01" required value={minBet} onChange={(event) => setMinBet(event.target.value)} /></div><div><Label>Aposta máx.</Label><Input className="mt-2" type="number" min="0.01" step="0.01" required value={maxBet} onChange={(event) => setMaxBet(event.target.value)} /></div><Button disabled={busy}><Save />{busy ? 'Salvando…' : game ? 'Salvar' : 'Adicionar jogo'}</Button></div><div className="mt-4 flex items-center gap-3 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Jogo habilitado" />{enabled ? 'Jogo habilitado' : 'Jogo desabilitado'}</div>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</form>;
}
function MissionEditor({ value, onSaved }: { value: Json | null; onSaved: () => Promise<void> }) {
  const save = useServerFn(saveMissionTerms);
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const [version, setVersion] = useState(String(typeof object['version'] === 'number' ? object['version'] : 1));
  const [rollover, setRollover] = useState(String(typeof object['rollover'] === 'number' ? object['rollover'] : 1));
  const [expiresDays, setExpiresDays] = useState(String(typeof object['expiresDays'] === 'number' ? object['expiresDays'] : 30));
  const [terms, setTerms] = useState(typeof object['terms'] === 'string' ? object['terms'] : '');
  const [withdrawalRules, setWithdrawalRules] = useState(typeof object['withdrawalRules'] === 'string' ? object['withdrawalRules'] : '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setSaved(false); try { await save({ data: { version: Number(version), rollover: Number(rollover), expiresDays: Number(expiresDays), terms, withdrawalRules } }); setSaved(true); await onSaved(); } catch (cause) { setError(adminErrorMessage(cause)); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="border border-border p-5"><div className="grid gap-4 sm:grid-cols-3"><div><Label>Versão dos termos</Label><Input type="number" min="1" required className="mt-2" value={version} onChange={(event) => setVersion(event.target.value)} /></div><div><Label>Rollover (vezes)</Label><Input type="number" min="0" max="1000" step="0.1" required className="mt-2" value={rollover} onChange={(event) => setRollover(event.target.value)} /></div><div><Label>Prazo da missão (dias)</Label><Input type="number" min="1" max="365" required className="mt-2" value={expiresDays} onChange={(event) => setExpiresDays(event.target.value)} /></div></div><Label className="mt-4 block">Texto dos termos</Label><Textarea required minLength={10} className="mt-2 min-h-40" value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Descreva parcelas, prazos e condições da missão" /><Label className="mt-4 block">Regras de saque</Label><Textarea required minLength={3} className="mt-2 min-h-28" value={withdrawalRules} onChange={(event) => setWithdrawalRules(event.target.value)} placeholder="Explique o rollover e as condições para sacar" />{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}{saved && <p role="status" className="mt-3 text-sm">Termos salvos.</p>}<Button className="mt-4" disabled={busy}><Save />{busy ? 'Salvando…' : 'Salvar termos'}</Button></form>;
}
function AchievementEditor({ achievement, onSaved }: { achievement: Achievement | null; onSaved: () => Promise<void> }) {
  const save = useServerFn(saveAchievement);
  const [code, setCode] = useState(achievement?.code ?? ''); const [titleEn, setTitleEn] = useState(achievement?.title_en ?? ''); const [titleRu, setTitleRu] = useState(achievement?.title_ru ?? '');
  const [descriptionEn, setDescriptionEn] = useState(achievement?.description_en ?? ''); const [descriptionRu, setDescriptionRu] = useState(achievement?.description_ru ?? ''); const [icon, setIcon] = useState(achievement?.icon ?? 'trophy');
  const [reward, setReward] = useState(String(achievement?.reward_amount ?? 0)); const [criteria, setCriteria] = useState(JSON.stringify(achievement?.criteria ?? {}, null, 2)); const [active, setActive] = useState(achievement?.active ?? true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const parsed: unknown = JSON.parse(criteria); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Os critérios devem ser um objeto JSON.'); await save({ data: { id: achievement?.id ?? null, code, titleEn, titleRu, descriptionEn, descriptionRu, icon, rewardAmount: Number(reward), criteria: parsed as Record<string, unknown>, active } }); await onSaved(); } catch (cause) { setError(adminErrorMessage(cause)); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label>Código</Label><Input className="mt-2 font-mono" required value={code} onChange={(event) => setCode(event.target.value)} /></div><div><Label>Ícone</Label><Input className="mt-2" value={icon} onChange={(event) => setIcon(event.target.value)} /></div><div><Label>Título em inglês</Label><Input className="mt-2" required value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></div><div><Label>Título em russo</Label><Input className="mt-2" required value={titleRu} onChange={(event) => setTitleRu(event.target.value)} /></div></div><div><Label>Descrição em inglês</Label><Textarea className="mt-2" value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} /></div><div><Label>Descrição em russo</Label><Textarea className="mt-2" value={descriptionRu} onChange={(event) => setDescriptionRu(event.target.value)} /></div><div><Label>Recompensa</Label><Input className="mt-2" type="number" min="0" step="0.01" required value={reward} onChange={(event) => setReward(event.target.value)} /></div><div><Label>Critérios (JSON)</Label><Textarea className="mt-2 min-h-28 font-mono text-xs" required value={criteria} onChange={(event) => setCriteria(event.target.value)} /></div><div className="flex items-center gap-3 text-sm"><Switch checked={active} onCheckedChange={setActive} />{active ? 'Conquista ativa' : 'Conquista inativa'}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button disabled={busy}>{busy ? 'Salvando…' : 'Salvar conquista'}</Button></DialogFooter></form>;
}
