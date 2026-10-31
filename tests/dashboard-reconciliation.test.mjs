import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import ts from 'typescript';

const state={member:'A',walletError:'',sectionErrors:[],loading:false,claimed:true};
const runtime={React,...React,
 base44:{functions:{invoke:async(name)=>{
  if(name==='dailyLoginStatus')return {data:{enabled:true,user_reference:state.member,day:new Date().toISOString().slice(0,10),claimed:state.claimed,penalty_enabled:true}};
  if(name==='listVerifiedStreaks')return {data:{data:[]}};
  throw Error('Unexpected function '+name);
 }}},
 useAuth:()=>({user:{id:state.member,display_name:'Member',role:'member'}}),
 useMemberWallet:()=>({wallet:{points_balance:'1',loyalty_xp:'0',source:'linux',points:[]},error:state.walletError,loading:false,refresh:async()=>true}),
 useDashboardData:()=>({levels:[],activities:[],rewards:[],achievements:[],tasks:[],taskProgress:[],loading:state.loading,sectionErrors:state.sectionErrors,loadData:async()=>true}),
 usePublicDestinations:()=>({destinations:[]}),formatWalletInteger:value=>String(value),rankXp:()=>0,memberTaskState:()=>({status:'available'})
};
globalThis.__dashboardReconciliation=runtime;
async function compile(path,prefix){
 const raw=await readFile(new URL('../'+path,import.meta.url),'utf8');
 const output=ts.transpileModule(prefix+raw.replace(/^import .*;\r?\n/gm,''),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return (await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))).default;
}
runtime.DailyCheckIn=await compile('src/components/perk/DailyCheckIn.jsx',"const {React,useEffect,useRef,useState,base44}=globalThis.__dashboardReconciliation;const Button='button';");
runtime.VerifiedStreakBonuses=await compile('src/components/perk/VerifiedStreakBonuses.jsx',"const {React,useEffect,useRef,useState,base44}=globalThis.__dashboardReconciliation;const Link='a';");
const names=['Link','Coins','TrendingUp','Flame','Gift','Award','ArrowRight','Shield','BookOpen','HelpCircle','BarChart3','ClipboardCheck','PageHeader','StatCard','ProgressBar','RankBadge','StatusBadge','EmptyState','Tabs','TabsList','TabsTrigger','TabsContent','DestinationCard','TaskCard','PullToRefresh'];
const prefix="const {React,useEffect,useState,useDashboardData,useMemberWallet,formatWalletInteger,rankXp,memberTaskState,useAuth,usePublicDestinations,DailyCheckIn,VerifiedStreakBonuses}=globalThis.__dashboardReconciliation;const "+names.map(name=>name+"='"+name+"'").join(',')+";";
const Dashboard=await compile('src/pages/user/Dashboard.jsx',prefix);
test('dashboard keeps one daily panel through error insertion, refreshes and account switches',async()=>{
 const errors=[],original=console.error;console.error=(...args)=>errors.push(args.map(String).join(' '));
 let root;
 try{
  await act(async()=>{root=TestRenderer.create(React.createElement(Dashboard));});
  const panels=()=>root.root.findAllByProps({'aria-label':'Daily check-in'});
  assert.equal(panels().length,1);
  for(let i=0;i<12;i++){
   state.walletError=i%2?'':'Temporary wallet outage';state.sectionErrors=i%3?[]:['activities'];
   await act(async()=>{root.update(React.createElement(Dashboard));});
   assert.equal(panels().length,1,'exactly one check-in after inserting/removing dashboard notices');
  }
  state.loading=true;await act(async()=>{root.update(React.createElement(Dashboard));});assert.equal(panels().length,0);
  state.loading=false;state.walletError='';state.sectionErrors=[];state.member='B';
  await act(async()=>{root.update(React.createElement(Dashboard));});assert.equal(panels().length,1);
  state.member='A';await act(async()=>{root.update(React.createElement(Dashboard));});assert.equal(panels().length,1);
  assert.ok(!errors.some(line=>/same key|unique.*key|Encountered two children/i.test(line)),errors.join('\n'));
 }finally{if(root)await act(async()=>root.unmount());console.error=original;}
});
test.after(()=>delete globalThis.__dashboardReconciliation);
