import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {base44} from '@/api/base44Client';
import PageHeader from '@/components/perk/PageHeader';
import {Button} from '@/components/ui/button';
import XpConversionPolicyControls from '@/components/admin/XpConversionPolicyControls';
const CHECK_LABELS={ledger:'Authoritative wallet and frozen legacy writers',new_member_enrollment:'New-member zero-balance enrolment',game_rewards:'Six enabled game reward policies',daily_checkin:'Daily check-in API',daily_presence:'Missed-login deduction policy and attendance table',core_tables:'Required wallet, game and attendance tables'};
const FLAG_LABELS={ledger_read:'Wallet API',ledger_delivery:'API delivery flag (worker has its own setting)',games:'Native games',daily_checkin:'Daily check-in',missed_login:'Prospective missed-login deductions (1 Point per full UTC day, settled on return)',new_member_wallets:'New-member wallet creation',xp_conversion:'XP conversion',xp_conversion_admin:'XP conversion administration',verified_streaks:'Verified streak rewards'};
const SOURCE_LABELS={wallet_authoritative:'Authoritative wallet mode',legacy_writers_frozen:'Legacy balance writers frozen',new_member_wallets_enabled:'Member wallet enrolment gateway',social_source_enabled:'Social ownership evidence source',social_claims_enabled:'Social linking reward claims',partner_tasks_enabled:'Partner task gateway',youtube_configuration_present:'YouTube configuration present',x_configuration_present:'X configuration present',token_encryption_configuration_present:'Token encryption configured'};
export default function AdminLaunchChecks(){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[checked,setChecked]=useState(null),generation=useRef(0);
 const load=useCallback(async()=>{
  const current=++generation.current;setLoading(true);setData(null);setError('');
  try{const response=await base44.functions.invoke('getCoreLaunchReadiness',{});if(!response.data?.data)throw Error();if(current===generation.current){setData(response.data.data);setChecked(new Date());}}
  catch{if(current===generation.current)setError('Launch checks could not be loaded. Rules-view permission and the authenticated API connection are required.');}
  finally{if(current===generation.current)setLoading(false);}
 },[]);
 useEffect(()=>{load();return ()=>{generation.current++;};},[load]);
 return <div className="space-y-6">
  <PageHeader title="Launch checks" description="Core configuration checks and separate XP policy administration"/>
  <div className="rounded-xl border bg-card p-4 space-y-2 text-sm"><p>Configuration checks are not launch approval. A new member must still register, earn a reward and see the correct wallet history in the bulk test session.</p><p>Provider configuration being present does not prove public approval, a successful OAuth connection or a verified payment. Paused financial features are not made available by this page.</p></div>
  <Button variant="outline" disabled={loading} onClick={load}>{loading?'Checking…':'Run checks again'}</Button>
  {error&&<p role="alert" className="rounded border p-4 text-sm">{error}</p>}
  {data&&<>
   <section className="rounded-xl border bg-card p-5 space-y-3"><h2 className="font-semibold">{data.configuration_complete?'Core configuration checks passed':'Core configuration needs attention'}</h2>{Object.entries(data.checks).map(([key,value])=><p key={key} className="text-sm"><span className={value?'text-emerald-700 dark:text-emerald-400':'text-amber-700 dark:text-amber-400'}>{value?'Pass':'Needs attention'}</span> · {CHECK_LABELS[key]}</p>)}
    <p className="text-sm">New-member cutoff: {data.enrollment_cutoff_valid?data.enrollment_cutoff_utc:'Missing or invalid — enrolment must remain blocked until reviewed.'}</p>
    <p className="text-xs text-muted-foreground">Checked at {checked?.toLocaleString()}. Running these checks does not change settings or balances.</p>
   </section>
   <div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-xl border bg-card p-5 space-y-2"><h2 className="font-semibold">API feature gates</h2><p className="text-xs text-muted-foreground">These are API-process flags. Scheduled delivery workers have separate settings and monitoring.</p>{Object.entries(data.flags).map(([key,value])=><p key={key} className="text-sm">{FLAG_LABELS[key]}: <strong>{value?'Enabled':'Paused'}</strong></p>)}</section>
    <section className="rounded-xl border bg-card p-5 space-y-2"><h2 className="font-semibold">App and provider configuration</h2>{Object.entries(data.source_flags).map(([key,value])=><p key={key} className="text-sm">{SOURCE_LABELS[key]}: <strong>{value?'Present / enabled':'Not enabled'}</strong></p>)}</section>
   </div>
   <XpConversionPolicyControls administrationEnabled={data.flags.xp_conversion_admin} conversionEnabled={data.flags.xp_conversion} />
   <section className="rounded-xl border bg-card p-5 space-y-3"><h2 className="font-semibold">Game policies</h2>{data.games.map(game=><p key={game.game_reference} className="text-sm">{game.title}: {game.enabled?'enabled':'paused'} · {game.points} Points / {game.xp} XP · {game.required_seconds} eligible seconds</p>)}<Link className="text-sm underline" to="/admin/games">Manage game policies</Link></section>
  </>}
  <section className="rounded-xl border bg-card p-5 space-y-3"><h2 className="font-semibold">One core acceptance session</h2><ol className="list-decimal pl-5 space-y-2 text-sm"><li>Register one genuinely new Perk Sphere member. Confirm zero opening balances and wallet creation without changing existing accounts.</li><li>Complete an eligible game and claim the daily point. Reload/retry and confirm no duplicate credit.</li><li>Check partner links, a genuine eligible watch task, social ownership connections and wallet history.</li><li>Repeat the key member pages on mobile and switch accounts to check stale data is not displayed.</li><li>Review a sponsor enquiry and draft booking. Do not falsely confirm payment or activate a pretend paid placement.</li></ol><p className="text-sm text-muted-foreground">Cash, gift cards and paid-subscription rewards need their separate unfinished implementation/provider acceptance. This checklist cannot approve them.</p></section>
 </div>;
}
