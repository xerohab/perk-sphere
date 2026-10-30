import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { NATIVE_GAMES } from '../../../base44/shared/nativeGames.ts';
import PageHeader from '@/components/perk/PageHeader';
import CardLadder from '@/components/perk/CardLadder';
import { Button } from '@/components/ui/button';

export default function Games() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const catalogGeneration = useRef(0), requestLock = useRef(null);
  const currentMember = useRef(user?.id);
  currentMember.current = user?.id;
  const [catalogOwner, setCatalogOwner] = useState(null);
  const [sessionOwner, setSessionOwner] = useState(null);
  const [session, setSession] = useState(null);
  const [game, setGame] = useState('number-memory');
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const visible = useRef(!document.hidden);
  const loadCatalog = useCallback(async () => {
    const current = ++catalogGeneration.current;
    const member = user?.id;
    if (!user?.id) { setCatalog([]); setCatalogLoading(false); return; }
    setCatalogLoading(true); setCatalogError('');
    try {
      const result = await base44.functions.invoke('getGameCatalog', {});
      if (!Array.isArray(result.data?.data)) throw Error('unavailable');
      if (current !== catalogGeneration.current || member !== currentMember.current) return;
      const games = result.data.data;
      setCatalog(games); setCatalogOwner(member);
      setGame(previous => games.some(item => item.game_reference === previous) ? previous : games[0]?.game_reference || '');
    } catch {
      if (current === catalogGeneration.current) { setCatalog([]); setCatalogError('Game availability could not be checked. Please retry.'); }
    } finally { if (current === catalogGeneration.current) setCatalogLoading(false); }
  }, [user?.id]);
  useEffect(() => {
    requestLock.current = null;
    setBusy(false); setError(''); setRevealed(false);
    setSession(null); setSessionOwner(null); setAnswer(''); setMessage(''); loadCatalog();
    return () => { catalogGeneration.current++; requestLock.current = null; };
  }, [loadCatalog]);
  const availableCatalog = catalogOwner === user?.id ? catalog : [];
  const selectedPolicy = availableCatalog.find(item => item.game_reference === game);
  const instruction = NATIVE_GAMES.find(item => item.id === game)?.instruction || '';
  useEffect(() => {
    const changed = () => { visible.current = !document.hidden; if(document.hidden) setRevealed(false); };
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  useEffect(() => {
    if(!revealed) return;
    const timer = setTimeout(() => setRevealed(false), 4000);
    return () => clearTimeout(timer);
  }, [revealed]);
  async function send(action,submittedAnswer=answer) {
    if(requestLock.current || !visible.current || !selectedPolicy || !user?.id) return;
    if(action !== 'start' && (!session || sessionOwner !== user.id)) return;
    const member = user.id;
    const request = Symbol('game-request');
    requestLock.current = request;
    const isCurrent = () => currentMember.current === member && requestLock.current === request;
    setBusy(true); setError('');
    try {
      const body = action === 'start' ? {action,game_reference:game} : {
        action,game_reference:game,session_uuid:session.session_uuid,round_number:session.round_number,answer:submittedAnswer
      };
      const result = await base44.functions.invoke('playGame', body);
      if (!isCurrent()) return;
      if(result.data?.error || !result.data?.data) throw new Error('Unable to load game');
      const next = result.data.data;
      setSession(next); setSessionOwner(member); setAnswer(''); setRevealed(next.status === 'active' && game === 'number-memory');
      setMessage(next.status === 'awarded' ? 'Reward credited: ' + next.points + ' points' + (next.xp ? ' and ' + next.xp + ' XP' : '') + '. Come back tomorrow for another reward.' :
        next.correct === false ? 'That answer was incorrect. Try the next round.' : instruction);
    } catch {
      if (isCurrent()) setError('Game rewards are unavailable or this round has expired. Use Start / Resume to check your session.');
    } finally { if (isCurrent()) { requestLock.current = null; setBusy(false); } }
  }
  return <div className="space-y-6">
    <PageHeader title="Games" description="Play on Perk Sphere and earn rewards from eligible game sessions." />
    {catalogLoading ? <p role="status">Checking available games…</p> : catalogError ? <div role="alert"><p>{catalogError}</p><Button onClick={loadCatalog}>Retry</Button></div> : availableCatalog.length === 0 ? <p>No game rewards are currently enabled. Please check back later.</p> : <section className="max-w-xl rounded-2xl border bg-card p-6 space-y-4">
      <label htmlFor="game-type" className="block text-sm font-medium">Choose a game</label>
      <select id="game-type" className="w-full rounded-md border bg-background p-2" disabled={busy} value={game} onChange={event=>{setGame(event.target.value);setSession(null);setAnswer('');setMessage('');setError('');}}>
        {availableCatalog.map(item => <option key={item.game_reference} value={item.game_reference}>{item.title}</option>)}
      </select>
      <p className="text-sm text-muted-foreground">{instruction} Successful rounds count towards the configured play-time target. One reward per game per day, resetting at midnight UTC. Long pauses do not count.</p>
      {selectedPolicy && <p className="text-sm font-medium">Reward: {selectedPolicy.points} points + {selectedPolicy.xp} XP · Active play target: {selectedPolicy.required_seconds} seconds</p>}
      <Button disabled={busy || !selectedPolicy} onClick={() => send('start')}>Start / Resume</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {session && sessionOwner === user?.id && <>
        <p className="text-sm">{session.eligible_seconds} / {session.required_seconds} seconds · {session.points} points{session.xp ? ' · ' + session.xp + ' XP' : ''}</p>
        <progress className="w-full" value={session.eligible_seconds} max={session.required_seconds} aria-label="Eligible play time" />
        <p role="status" className="text-sm">{message}</p>
        {session.status === 'active' && <>
          {game === 'card-ladder' ? <CardLadder challenge={session.challenge} selected={answer} disabled={busy} onChange={setAnswer} onSubmit={next=>send('round',next)} /> : <>
          <div className="rounded-xl bg-muted p-6 text-center text-3xl font-mono tracking-widest" aria-live="polite">{revealed || game !== 'number-memory' ? session.challenge : '••••••'}</div>
          <form className="flex gap-3" onSubmit={event => { event.preventDefault(); send('round'); }}>
            <label className="sr-only" htmlFor="memory-answer">Six-digit number</label>
            <input id="memory-answer" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2" inputMode="numeric" autoComplete="off" maxLength={6} value={answer} onChange={event => setAnswer(event.target.value.replace(/\D/g,''))} disabled={busy || revealed} />
            <Button type="submit" disabled={busy || revealed || answer.length !== 6}>Check</Button>
          </form>
          </>}
        </>}
      </>}
    </section>}
  </div>;
}

