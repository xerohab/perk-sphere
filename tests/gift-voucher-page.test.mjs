import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { giftVoucherRequest } from '../base44/shared/giftVoucherContract.ts';
let intentUuid;
const mounted=[];
function Reveal(props) { mounted.push(props.intentUuid); return React.createElement('div', {'data-voucher':props.intentUuid}); }
globalThis.__voucherPage={React,useParams:()=>({intentUuid}),Link:'a',PageHeader:'header',GiftVoucherReveal:Reveal,giftVoucherRequest};
const raw=await readFile(new URL('../src/pages/user/GiftVoucher.jsx',import.meta.url),'utf8');
const prefix='const {React,useParams,Link,PageHeader,GiftVoucherReveal,giftVoucherRequest}=globalThis.__voucherPage;';
const code=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {default:Page}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const id='12345678-1234-4234-8234-123456789012';
test('valid voucher link mounts only its exact reveal scope and offers return navigation',async()=>{intentUuid=id;mounted.length=0;let view;try{await act(async()=>{view=Renderer.create(React.createElement(Page));});assert.deepEqual(mounted,[id]);assert.equal(view.root.findByType('a').props.to,'/rewards');assert.equal(view.root.findAllByProps({role:'alert'}).length,0);}finally{if(view)await act(async()=>view.unmount());}});
test('invalid voucher links do not mount reveal or echo supplied content',async()=>{for(const value of [undefined,'not-a-voucher','<script>private</script>']){intentUuid=value;mounted.length=0;let view;try{await act(async()=>{view=Renderer.create(React.createElement(Page));});assert.equal(mounted.length,0);assert.equal(view.root.findAllByProps({role:'alert'}).length,1);assert.doesNotMatch(JSON.stringify(view.toJSON()),/<script>|not-a-voucher/);}finally{if(view)await act(async()=>view.unmount());}}});
test('changing a voucher link replaces its scope and invalidating it unmounts reveal',async()=>{intentUuid=id;let view;try{await act(async()=>{view=Renderer.create(React.createElement(Page));});intentUuid='22345678-1234-4234-8234-123456789012';await act(async()=>view.update(React.createElement(Page)));assert.equal(view.root.findByType(Reveal).props.intentUuid,intentUuid);intentUuid='invalid';await act(async()=>view.update(React.createElement(Page)));assert.equal(view.root.findAllByType(Reveal).length,0);}finally{if(view)await act(async()=>view.unmount());}});
