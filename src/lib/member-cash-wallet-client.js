import {validCashWalletRequest,projectMemberCashWallet} from '../../base44/shared/memberCashWalletContract.ts';
export {formatGbpPence} from '../../base44/shared/memberCashWalletContract.ts';
export async function readMemberCashWallet({base44,actorId,body,isCurrent=()=>true}){
 const active=u=>u?.id===actorId&&typeof actorId==='string'&&actorId.length>0&&!['disabled','suspended','banned'].includes(u.account_status);
 try{if(!validCashWalletRequest(body)||!isCurrent()||!active(await base44.auth.me())||!isCurrent())throw Error('UNAVAILABLE');const r=await base44.functions.invoke('getMemberCashWallet',body);if(!isCurrent()||!active(await base44.auth.me())||!isCurrent())throw Error('UNAVAILABLE');const data=r?.data?.data;return projectMemberCashWallet(data?.enabled===true?{...data,user_reference:actorId}:data,{actorId,body});}catch{throw Error('CASH_WALLET_UNAVAILABLE');}
}
