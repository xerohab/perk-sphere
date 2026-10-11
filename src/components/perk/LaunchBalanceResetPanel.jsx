import React, {useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';

export default function LaunchBalanceResetPanel() {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function run() {
    setBusy(true); setMessage('Pausing reward writes and saving balance backups…');
    try {
      await base44.functions.invoke('resetLaunchBalances',{action:'begin'});
      let offset=0, done=false, total=0;
      while (!done) {
        const {data}=await base44.functions.invoke('resetLaunchBalances',{action:'batch',offset});
        total+=data.count; offset=data.next_offset; done=data.done;
        setMessage('Reset and checked '+total+' members…');
      }
      offset=0; done=false; const members=[];
      while (!done) {
        const {data}=await base44.functions.invoke('resetLaunchBalances',{action:'verify',offset});
        members.push(...data.members); offset=data.next_offset; done=data.done;
      }
      const manifest={version:1,run_reference:'perksphere-zero-launch-20261011',app_reference:'6ac4c3e3ea28af5826e4b364',verified_at:new Date().toISOString(),members};
      const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}));
      const link=document.createElement('a'); link.href=url; link.download='perksphere-zero-launch-manifest.json'; link.click(); URL.revokeObjectURL(url);
      setMessage('Verified '+members.length+' members at zero Points and XP. The manifest has downloaded. Legacy rewards remain paused until launch setup is complete.');
    } catch(error) {
      setMessage(error?.response?.data?.error || 'Reset interrupted. Retry to resume from the saved backups.');
    } finally {setBusy(false);}
  }
  return <section className="mb-6 rounded-xl border p-4 space-y-3">
    <h2 className="font-semibold">Zero-balance launch</h2>
    <p className="text-sm text-muted-foreground">Reset all PerkSphere Points and XP, with private backups and verification. Partner points, account connections and transaction history are kept. Rewards stay paused during the launch setup.</p>
    <Button disabled={busy} onClick={run}>{busy?'Resetting…':'Reset PerkSphere balances to zero'}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
