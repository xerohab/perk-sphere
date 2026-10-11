import {ensureLinuxWallet} from './memberWalletEnrollment.ts';
import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from './linuxClient.ts';
// Called only after Linux has confirmed the authenticated member's connection.
export async function requestPartnerLinkReward(partnerUuid,userId) {
  if (secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')!=='true' || secrets.get('PERKSPHERE_PARTNER_LINK_REWARDS_ENABLED')!=='true') return {issued:false,reason:'launch_rewards_not_enabled'};
  await ensureLinuxWallet(userId);
  const result=await linuxTrustedPost('/v1/perk-sphere/partner-rewards/claim-link',{actor:{role:'member',user_reference:userId},partner_uuid:partnerUuid});
  if(!result.ok) return {issued:false,reason:'link_reward_pending'};
  const data=result.data;
  if(data?.issued===true || data?.duplicate===true) return {issued:data.issued===true,duplicate:data.duplicate===true};
  return {issued:false,reason:'link_reward_not_eligible'};
}