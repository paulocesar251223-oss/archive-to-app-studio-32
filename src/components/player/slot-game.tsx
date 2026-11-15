import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, LoaderCircle, Repeat2, ShieldCheck, Square, Volume2, VolumeX } from 'lucide-react';
import templeArt from '@/assets/lost-temple.jpg';
import { accountQuery } from '@/lib/account-query';
import { prepareSpin, revealSpinSession, spin } from '@/lib/slot.functions';
import { SLOT_BET_VALUES, SLOT_PAYLINES, SLOT_SPIN_COUNTS, SLOT_WIN_CHANCE, clientSeedSchema, type PaylineId, type WinningLine } from '@/lib/slot-engine';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Session = { sessionId: string; serverSeedHash: string; clientSeed: string; nonce: number; rtp: number };
type WinResult = { count: number; payout: number; lines: WinningLine[] };
const symbolCrops = [
  { x: 168, y: 273, w: 138, h: 120, name: 'Red scarab' },
  { x: 318, y: 400, w: 145, h: 120, name: 'Green scarab' },
  { x: 315, y: 268, w: 150, h: 125, name: 'Pharaoh mask' },
  { x: 475, y: 277, w: 137, h: 117, name: 'Blue gem' },
  { x: 168, y: 400, w: 143, h: 120, name: 'Golden sun coin' },
  { x: 470, y: 398, w: 150, h: 122, name: 'Coin stack' },
];
const initialReels = [[0, 4, 3], [2, 1, 2], [3, 5, 0]];
const paylinePoints: Record<PaylineId, string> = {
  middle: '16.7,50 50,50 83.3,50',
  diagonalDown: '16.7,16.7 50,50 83.3,83.3',
  diagonalUp: '16.7,83.3 50,50 83.3,16.7',
};

function SymbolArt({ symbol, highlighted = false }: { symbol: number; highlighted?: boolean }) {
  const crop = symbolCrops[symbol] ?? symbolCrops[0]!;
  return <div className={`relative h-full w-full overflow-hidden bg-parchment transition-[filter] ${highlighted ? 'temple-symbol-win' : ''}`}>
    <img src={templeArt} alt={crop.name} draggable={false} className="absolute max-w-none select-none" style={{ width: `${768 / crop.w * 100}%`, left: `-${crop.x / crop.w * 100}%`, top: `-${crop.y / crop.h * 100}%` }} />
  </div>;
}

function PrizeCounter({ target, money, reduceMotion }: { target: number; money: (value: number) => string; reduceMotion: boolean }) {
  const [value, setValue] = useState(reduceMotion ? target : 0);
  useEffect(() => {
    if (reduceMotion) { setValue(target); return; }
    let frame = 0;
    const started = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / 900);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);
  return <>{money(value)}</>;
}

export function SlotGame({ gameId, gameName }: { gameId: string; gameName: string }) {
  const { t, lang } = useI18n();
  const { data: account } = useSuspenseQuery(accountQuery);
  const queryClient = useQueryClient();
  const prepare = useServerFn(prepareSpin);
  const play = useServerFn(spin);
  const reveal = useServerFn(revealSpinSession);
  const reduceMotionPreference = useReducedMotion();
  const reduceMotion = Boolean(reduceMotionPreference);
  const [session, setSession] = useState<Session | null>(null);
  const [clientSeed, setClientSeed] = useState('SOCHI-player');
  const [balance, setBalance] = useState(account.balance);
  const [bet, setBet] = useState(1);
  const [spins, setSpins] = useState<1 | 10 | 100>(1);
  const [reels, setReels] = useState<number[][]>(initialReels);
  const [stoppedColumns, setStoppedColumns] = useState(3);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(0);
  const [winResult, setWinResult] = useState<WinResult | null>(null);
  const [revealedSeed, setRevealedSeed] = useState('');
  const requestId = useRef<string | null>(null);
  const busyRef = useRef(false);
  const autoRef = useRef(false);
  const balanceRef = useRef(account.balance);
  const stoppedRef = useRef(3);
  const mutedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const winTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setSession(null);
    setError('');
    void prepare({ data: { game: gameId, clientSeed: 'SOCHI-player' } }).then((result) => {
      if (active) setSession(result);
    }).catch(() => {
      if (active) setError(t.spinSessionError);
    });
    return () => { active = false; autoRef.current = false; window.clearTimeout(winTimer.current); void audioRef.current?.close(); };
  }, [gameId, prepare]);

  function playSound(kind: 'spin' | 'win') {
    if (mutedRef.current) return;
    try {
      const audio = audioRef.current ?? new AudioContext();
      audioRef.current = audio;
      void audio.resume();
      const notes = kind === 'win' ? [523.25, 659.25, 783.99] : [110, 164.81];
      notes.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = kind === 'win' ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        const start = audio.currentTime + index * (kind === 'win' ? 0.12 : 0.07);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(kind === 'win' ? 0.11 : 0.035, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'win' ? 0.3 : 0.12));
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + (kind === 'win' ? 0.32 : 0.14));
      });
    } catch { /* Audio is optional when the browser blocks it. */ }
  }

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) { void audioRef.current?.close(); audioRef.current = null; }
  }

  async function startSession() {
    setError('');
    setRevealedSeed('');
    if (!clientSeedSchema.safeParse(clientSeed).success) { setError(t.invalidClientSeed); return; }
    setBusy(true);
    try {
      const result = await prepare({ data: { game: gameId, clientSeed } });
      setSession(result);
      requestId.current = null;
    } catch { setError(t.spinSessionError); } finally { setBusy(false); }
  }

  async function revealSession() {
    if (!session) return;
    setBusy(true);
    try {
      const result = await reveal({ data: { sessionId: session.sessionId } });
      setRevealedSeed(result.serverSeed);
      setSession(null);
      requestId.current = null;
    } catch { setError(t.spinSessionError); } finally { setBusy(false); }
  }

  async function executeSpin(): Promise<boolean> {
    if (!session || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setCompleted(0);
    setWinResult(null);
    window.clearTimeout(winTimer.current);
    requestId.current ??= crypto.randomUUID();
    let animation: number | undefined;
    const timers: number[] = [];
    try {
      playSound('spin');
      if (!reduceMotion) {
        stoppedRef.current = 0;
        setStoppedColumns(0);
        animation = window.setInterval(() => {
          setReels((current) => current.map((reel, index) => index < stoppedRef.current ? reel : reel.map(() => Math.floor(Math.random() * symbolCrops.length))));
        }, 75);
      }
      const response = await play({ data: { sessionId: session.sessionId, requestId: requestId.current, game: gameId, bet, spins } });
      const finalRound = response.rounds[response.rounds.length - 1];
      if (finalRound) {
        if (reduceMotion) setReels(finalRound.reels);
        else {
          for (let column = 0; column < 3; column += 1) {
            timers.push(window.setTimeout(() => {
              stoppedRef.current = column + 1;
              setStoppedColumns(column + 1);
              setReels((current) => current.map((reel, index) => index === column ? finalRound.reels[column] ?? reel : reel));
            }, 500 + column * 300));
          }
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
      if (animation) window.clearInterval(animation);
      const totalPayout = response.rounds.reduce((sum, round) => sum + round.payout, 0);
      const winningCount = response.rounds.filter((round) => round.winningLines.length > 0).length;
      if (winningCount > 0) {
        setWinResult({ count: winningCount, payout: totalPayout, lines: finalRound?.winningLines ?? [] });
        playSound('win');
        winTimer.current = window.setTimeout(() => setWinResult(null), 2100);
      }
      setBalance(response.balance);
      balanceRef.current = response.balance;
      setCompleted(response.rounds.length);
      setSession((current) => current ? { ...current, nonce: current.nonce + spins } : current);
      requestId.current = null;
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['account'] }), queryClient.invalidateQueries({ queryKey: ['wallet'] })]);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message.includes('INSUFFICIENT_BALANCE') || message.includes('Insufficient balance') ? t.insufficientBalance : message.includes('RATE_LIMITED') ? t.tooManySpins : message.includes('INVALID_BET') ? t.invalidBet : t.spinError);
      return false;
    } finally {
      if (animation) window.clearInterval(animation);
      timers.forEach((timer) => window.clearTimeout(timer));
      stoppedRef.current = 3;
      setStoppedColumns(3);
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function toggleAuto() {
    if (autoRef.current) { autoRef.current = false; setAuto(false); return; }
    if (!session || busyRef.current) return;
    autoRef.current = true;
    setAuto(true);
    while (autoRef.current) {
      if (balanceRef.current < bet * spins) { setError(t.insufficientBalance); break; }
      const succeeded = await executeSpin();
      if (!succeeded) break;
      if (!reduceMotion) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    autoRef.current = false;
    setAuto(false);
  }

  const money = (value: number) => new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const multiplier = (session?.rtp ?? 96) / 100 / SLOT_WIN_CHANCE;
  const winningPositions = new Set((winResult?.lines ?? []).flatMap((win) => SLOT_PAYLINES.find((line) => line.id === win.line)?.positions.map(([reel, row]) => `${reel}-${row}`) ?? []));
  const lineName = (line: PaylineId) => line === 'middle' ? t.middleLine : line === 'diagonalDown' ? t.diagonalDown : t.diagonalUp;

  return <main className="min-h-dvh bg-background pb-60 text-foreground">
    <header className="relative z-30 flex items-center justify-between px-3 py-3"><Button variant="ghost" size="icon" className="text-gold" asChild><Link to="/dashboard" aria-label={t.backHome}><ArrowLeft /></Link></Button><div className="text-center"><p className="text-[9px] uppercase tracking-[0.25em] text-gold">SOCHI Slots</p><h1 className="mt-1 font-serif text-lg font-semibold text-gold">{gameName}</h1></div><Button variant="ghost" size="icon" className="text-gold" onClick={toggleSound} aria-label={muted ? t.enableSound : t.muteSound}>{muted ? <VolumeX /> : <Volume2 />}</Button></header>

    <section className="temple-machine relative mx-auto w-full max-w-[520px] select-none" aria-label={gameName}>
      <img src={templeArt} alt="Lost Temple golden Egyptian slot machine" className="block h-auto w-full" draggable={false} />
      {[[12, 5], [87, 5], [11, 49], [88, 49]].map(([left, top], index) => <span key={index} aria-hidden="true" className="torch-flame" style={{ left: `${left}%`, top: `${top}%` }} />)}
      <div className="temple-reel-window absolute left-[20.7%] right-[20.3%] top-[25.7%] h-[37.1%] overflow-hidden border border-gold/50 bg-parchment">
        <div className="grid h-full grid-cols-3 gap-[2px] bg-gold/60">
          {reels.map((reel, reelIndex) => <motion.div key={reelIndex} className="grid grid-rows-3 gap-[2px] bg-gold/40" animate={busy && reelIndex >= stoppedColumns && !reduceMotion ? { y: [0, -14, 0] } : { y: 0 }} transition={busy && reelIndex >= stoppedColumns && !reduceMotion ? { duration: 0.2, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 280, damping: 21 }}>{reel.map((symbol, rowIndex) => <SymbolArt key={rowIndex} symbol={symbol} highlighted={winningPositions.has(`${reelIndex}-${rowIndex}`)} />)}</motion.div>)}
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{(winResult?.lines ?? []).map((win) => <motion.polyline key={win.line} points={paylinePoints[win.line]} fill="none" stroke="var(--gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.9 }} />)}</svg>
      </div>
      <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 text-center text-[9px] uppercase tracking-[0.2em] text-gold/80">{completed ? `${t.completedSpins}: ${completed}` : t.centralLine}</div>
      <AnimatePresence>{winResult && <motion.div role="status" className="pointer-events-none absolute inset-0 z-20 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {!reduceMotion && Array.from({ length: 18 }, (_, index) => <span key={index} className="temple-coin" style={{ left: `${(index * 37) % 96}%`, animationDelay: `${(index % 6) * 0.11}s` }} />)}
        <motion.div className="temple-win-card absolute left-1/2 top-[42%] w-[76%] -translate-x-1/2 border border-gold/60 bg-background/90 px-4 py-4 text-center" initial={{ scale: 0.75 }} animate={{ scale: 1 }}><p className="font-serif text-2xl font-bold text-gold">{t.bigWin}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{t.prize}</p><p className="text-2xl font-semibold tabular-nums text-gold"><PrizeCounter target={winResult.payout} money={money} reduceMotion={reduceMotion} /></p><p className="mt-1 text-[10px] text-muted-foreground">{winResult.count} {t.winningSpins}</p>{winResult.lines.map((win) => <p key={win.line} className="mt-1 text-[10px] text-gold">{lineName(win.line)}</p>)}</motion.div>
      </motion.div>}</AnimatePresence>
    </section>

    {error && <p role="alert" className="mx-4 mt-3 border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">{error}</p>}

    <section className="mx-4 mt-4 border border-gold/25 bg-card p-4"><details><summary className="cursor-pointer text-sm font-semibold text-gold">{t.paytable}</summary><div className="mt-4"><div className="grid grid-cols-6 gap-1">{symbolCrops.map((_, index) => <div key={index} className="aspect-[6/5]"><SymbolArt symbol={index} /></div>)}</div><div className="mt-4 flex items-center justify-between border-t border-gold/20 pt-3 text-sm"><span>{t.fiveCentralSymbols}</span><strong className="whitespace-nowrap text-gold">{money(multiplier)}×</strong></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{t.paytableNote}</p></div></details></section>

    <details className="mx-4 mt-3 border border-gold/25 bg-card p-4"><summary className="cursor-pointer text-sm font-medium text-gold"><ShieldCheck className="mr-2 inline size-4" />{t.provablyFair}</summary><div className="mt-4 space-y-3 text-xs"><div><Label>{t.serverSeedHash}</Label><code className="mt-1 block break-all text-muted-foreground">{session?.serverSeedHash ?? '—'}</code></div><div><Label>{t.clientSeed}</Label><Input className="mt-1 font-mono" value={clientSeed} readOnly={Boolean(session)} maxLength={64} onChange={(event) => setClientSeed(event.target.value)} /></div><p>{t.nonce}: {session?.nonce ?? 0}</p>{session ? <Button variant="outline" size="sm" disabled={busy || auto} onClick={() => void revealSession()}>{t.revealSeed}</Button> : <Button variant="outline" size="sm" disabled={busy} onClick={() => void startSession()}>{t.newFairSession}</Button>}{revealedSeed && <div><Label>{t.revealedServerSeed}</Label><code className="mt-1 block break-all text-gold">{revealedSeed}</code></div>}</div></details>

    <div className="temple-controls fixed inset-x-0 bottom-0 z-40 border-t border-gold/30 bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"><div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between gap-3"><div className="shrink-0"><p className="text-[9px] uppercase tracking-[0.18em] text-gold">{t.balance}</p><p className="whitespace-nowrap text-xl font-semibold tabular-nums" aria-live="polite">{money(balance)} <span className="text-xs text-gold">USDC</span></p></div><div><Label htmlFor="slot-bet" className="text-[9px] uppercase tracking-widest text-gold">{t.betAmount}</Label><select id="slot-bet" className="mt-1 h-9 min-w-20 rounded-md border border-gold/35 bg-background px-2 text-sm" value={bet} disabled={busy || auto} onChange={(event) => { setBet(Number(event.target.value)); requestId.current = null; }}>{SLOT_BET_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div><div><p className="text-[9px] uppercase tracking-widest text-gold">{t.spinCount}</p><div className="mt-1 flex gap-1">{SLOT_SPIN_COUNTS.map((value) => <button key={value} type="button" disabled={busy || auto} onClick={() => { setSpins(value); requestId.current = null; }} className={`h-9 min-w-9 border px-2 text-xs ${spins === value ? 'border-gold bg-gold/15 text-gold' : 'border-border text-muted-foreground'}`}>{value}</button>)}</div></div></div>
      <div className="mt-3 grid grid-cols-[auto_1fr] gap-2"><Button variant="outline" className={`h-12 border-gold/40 px-4 text-gold ${auto ? 'bg-gold/15' : ''}`} disabled={!session || (busy && !auto)} onClick={() => void toggleAuto()} aria-pressed={auto}>{auto ? <Square /> : <Repeat2 />}<span className="hidden sm:inline">{auto ? t.stopAuto : t.autoPlay}</span><span className="sm:hidden">{auto ? t.stop : t.auto}</span></Button><Button className="h-12 bg-gold text-base font-bold text-gold-foreground hover:bg-gold/90" disabled={!session || busy || auto} onClick={() => void executeSpin()}>{busy && !auto ? <LoaderCircle className="animate-spin" /> : null}{busy && !auto ? t.spinning : `${t.spin} · ${money(bet * spins)}`}</Button></div>
    </div></div>
  </main>;
}
