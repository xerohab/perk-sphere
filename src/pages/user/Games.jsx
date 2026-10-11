import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/perk/PageHeader';
import { Button } from '@/components/ui/button';

export default function Games() {
  const [session, setSession] = useState(null);
  const [game, setGame] = useState('number-memory');
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const visible = useRef(!document.hidden);
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
  async function send(action) {
    if(busy || !visible.current) return;
    setBusy(true); setError('');
    try {
      const body = action === 'start' ? {action,game_reference:game} : {
        action,game_reference:game,session_uuid:session.session_uuid,round_number:session.round_number,answer
      };
      const result = await base44.functions.invoke('playGame', body);
      if(result.data?.error || !result.data?.data) throw new Error(result.data?.error || 'Unable to load game');
      const next = result.data.data;
      setSession(next); setAnswer(''); setRevealed(next.status === 'active' && game === 'number-memory');
      setMessage(next.status === 'awarded' ? `Reward credited: ${next.points} points${next.xp ? ` and ${next.xp} XP` : ''}. Come back tomorrow for another reward.` :
        next.correct === false ? 'That answer was incorrect. Try the next round.' :
        game === 'quick-maths' ? 'Add the two numbers.' : game === 'reverse-code' ? 'Enter the six digits in reverse order.' : 'Memorise the number, then enter it once it disappears.');
    } catch {
      setError('Game rewards are unavailable or this round has expired. Use Start / Resume to check your session.');
    } finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <PageHeader title="Games" description="Play on Perk Sphere and earn rewards from eligible game sessions." />
    <section className="max-w-xl rounded-2xl border bg-card p-6 space-y-4">
      <label htmlFor="game-type" className="block text-sm font-medium">Choose a game</label>
      <select id="game-type" className="w-full rounded-md border bg-background p-2" disabled={busy} value={game} onChange={event=>{setGame(event.target.value);setSession(null);setAnswer('');setMessage('');setError('');}}>
        <option value="number-memory">Number Memory</option>
        <option value="quick-maths">Quick Maths</option>
        <option value="reverse-code">Reverse Code</option>
      </select>
      <p className="text-sm text-muted-foreground">Remember a six-digit number and type it back. Successful rounds count towards the configured play-time target. One reward per game per day, resetting at midnight UTC. Long pauses do not count.</p>
      <Button disabled={busy} onClick={() => send('start')}>Start / Resume</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {session && <>
        <p className="text-sm">{session.eligible_seconds} / {session.required_seconds} seconds · {session.points} points{session.xp ? ` · ${session.xp} XP` : ''}</p>
        <progress className="w-full" value={session.eligible_seconds} max={session.required_seconds} aria-label="Eligible play time" />
        <p role="status" className="text-sm">{message}</p>
        {session.status === 'active' && <>
          <div className="rounded-xl bg-muted p-6 text-center text-3xl font-mono tracking-widest" aria-live="polite">{revealed || game !== 'number-memory' ? session.challenge : '••••••'}</div>
          <form className="flex gap-3" onSubmit={event => { event.preventDefault(); send('round'); }}>
            <label className="sr-only" htmlFor="memory-answer">Six-digit number</label>
            <input id="memory-answer" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2" inputMode="numeric" autoComplete="off" maxLength={6} value={answer} onChange={event => setAnswer(event.target.value.replace(/\D/g,''))} disabled={busy || revealed} />
            <Button type="submit" disabled={busy || revealed || answer.length !== 6}>Check</Button>
          </form>
        </>}
      </>}
    </section>
  </div>;
}
