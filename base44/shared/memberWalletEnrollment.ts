import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from './linuxClient.ts';
export async function ensureLinuxWallet(userId) {
 if(secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')!=='true'||secrets.get('PERKSPHERE_NEW_MEMBER_WALLETS_ENABLED')!=='true')return;
 const result=await linuxTrustedPost('/v1/perk-sphere/ledger/enroll',{actor:{role:'member',user_reference:userId}});
 if(!result.ok || result.data?.enrolled!==true)throw new Error('member_wallet_enrollment_unavailable');
}
