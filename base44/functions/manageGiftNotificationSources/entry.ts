import {createClientFromRequest} from 'npm:@base44/sdk@0.8.52';
import {secrets} from 'base44:runtime';
import {authorize} from '../../shared/permissions.ts';
import {linuxTrustedPost} from '../../shared/linuxClient.ts';
import {createGiftSourceAdminHandler} from '../../shared/giftSourceAdminHandler.ts';
// The Linux service-auth bridge must preserve the handler envelope, validate
// this signed actor and supply real authorization/rate adapters before enabling.
const handler=createGiftSourceAdminHandler({getClient:createClientFromRequest,getSecret:name=>secrets.get(name),authorize,post:linuxTrustedPost});
export default handler;if(typeof Deno!=='undefined')Deno.serve(handler);
