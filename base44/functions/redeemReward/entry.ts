import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {redeemReward} from '../../shared/rewards.ts';
import {createRewardRedemptionHandler} from '../../shared/rewardRedemptionGateway.ts';
const handler=createRewardRedemptionHandler({getClient:createClientFromRequest,isAuthoritative:()=>secrets.get('PERKSPHERE_LINUX_LEDGER_AUTHORITATIVE')==='true',redeem:redeemReward});
export default handler;
if(typeof Deno!=='undefined')Deno.serve(handler);
