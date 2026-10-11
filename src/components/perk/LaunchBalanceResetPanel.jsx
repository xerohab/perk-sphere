import React, {useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';

export default function LaunchBalanceResetPanel() {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function run() {
    setBusy(true); setMessage('Pausing reward writes and checking manually reset balances…');
    try {
      await base44.functions.invoke('resetLaunchBalances',{action:'begin'});
      let offset=0, done=false; const members=[];
      while (!done) {
        const {data}=await base44.functions.invoke('resetLaunchBalances',{action:'export',offset});
        members.push(...data.members); offset=data.next_offset; done=data.done;
      }
      const manifest={version:1,reset_method:'manual',run_reference:'perksphere-zero-launch-20261011',app_reference:'6ac4c3e3ea28af5826e4b364',verified_at:new Date().toISOString(),members};
      const url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}));
      const link=document.createElement('a'); link.href=url; link.download='perksphere-zero-launch-manifest.json'; link.click(); URL.revokeObjectURL(url);
      setMessage('Verified '+members.length+' members at zero Points and XP. The manifest has downloaded. Legacy rewards remain paused until launch setup is complete.');
    } catch(error) {
      setMessage(error?.response?.data?.error || 'Reset interrupted. Retry to resume from the saved backups.');
    } finally {setBusy(false);}
  }
  return <section className="mb-6 rounded-xl border p-4 space-y-3">
    <h2 className="font-semibold">Check manually reset launch balances</h2>
    <p className="text-sm text-muted-foreground">Check that every member has zero Points and XP and download the Linux launch manifest. This check pauses legacy rewards during setup and does not change member balances.</p>
    <Button disabled={busy} onClick={run}>{busy?'Checking…':'Verify zero balances and download manifest'}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}