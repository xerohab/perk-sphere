import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {authorize} from '../../shared/permissions.ts';
import {createPaypalPayoutHandler} from '../../shared/paypalPayoutHandler.ts';
const handler=createPaypalPayoutHandler({getClient:createClientFromRequest,getSecret:name=>secrets.get(name),post:linuxTrustedPost,authorize},true);
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
