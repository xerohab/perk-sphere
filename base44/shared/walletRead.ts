import {linuxTrustedPost} from './linuxClient.ts';

export function walletInteger(value,signed=false){
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('invalid_ledger_integer');
 const s=String(value);if(!(signed?/^(0|-?[1-9][0-9]*)$/:/^(0|[1-9][0-9]*)$/).test(s))throw Error('invalid_ledger_integer');
 const n=BigInt(s);if(n<-(1n<<63n)||n>(1n<<63n)-1n)throw Error('invalid_ledger_integer');return s;
}

// The caller authenticates/authorizes the member reference before invoking this.
// Read-only: staff inspection must never enroll a member or change a balance.
export async function readLinuxWallet(userId){
 const actor={role:'member',user_reference:String(userId)};
 const [balance,history]=await Promise.all([linuxTrustedPost('/v1/perk-sphere/ledger/balance',{actor}),linuxTrustedPost('/v1/perk-sphere/ledger/history',{actor})]);
 if(!balance.ok||!history.ok||!balance.data||!Array.isArray(history.data)||history.data.length>100)throw Error('ledger_unavailable');
 const operations=history.data.map(row=>{
  if(typeof row.operation_uuid!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.operation_uuid)||!['opening_balance','task_reward','partner_reward','manual_adjustment','redemption','reversal','xp_conversion'].includes(row.operation_type)||row.status!=='applied'||!Number.isFinite(Date.parse(row.applied_at)))throw Error('invalid_ledger_history');
  const missed=typeof row.source_reference==='string'&&/^missed-login:(\\d{4}-\\d{2}-\\d{2}):(\\d{4}-\\d{2}-\\d{2})$/.exec(row.source_reference);
  const reason=missed&&row.operation_type==='manual_adjustment' ? 'Missed daily login: '+missed[1]+' to '+missed[2]+' UTC (1 Point per missed day, capped at available balance)' : row.operation_type.replace(/_/g,' ');
  return {id:row.operation_uuid,created_date:row.applied_at,transaction_type:row.operation_type,reason,amount:walletInteger(row.points_delta,true),xp_amount:walletInteger(row.xp_delta,true),balance_after:null,xp_after:null};
 });
 return {source:'linux',points_balance:walletInteger(balance.data.points_balance),loyalty_xp:walletInteger(balance.data.xp_balance,true),version:walletInteger(balance.data.version),points:operations.filter(row=>row.amount!=='0'),xp:operations.filter(row=>row.xp_amount!=='0')};
}
