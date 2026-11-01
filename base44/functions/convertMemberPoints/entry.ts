import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {createMemberCashConversionHandler} from '../../shared/memberCashConversionHandler.ts';
const handler=createMemberCashConversionHandler({getClient:createClientFromRequest,getSecret:name=>secrets.get(name),post:linuxTrustedPost});
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
