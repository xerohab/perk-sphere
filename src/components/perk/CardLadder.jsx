import React from 'react';
import {Button} from '@/components/ui/button';
export function pickCard(challenge,selected,digit){
 if(typeof challenge!=='string'||!/^\d{6}$/.test(challenge)||new Set(challenge).size!==6||typeof selected!=='string'||selected.length>=6||!challenge.includes(digit)||digit.length!==1||selected.includes(digit))return selected;
 return selected+digit;
}
const suits=['♠','♥','♦','♣'];
export default function CardLadder({challenge,selected='',disabled=false,onChange,onSubmit}){
 const valid=typeof challenge==='string'&&/^\d{6}$/.test(challenge)&&new Set(challenge).size===6;
 if(!valid)return <p role="alert">This card round could not be loaded. Use Start / Resume.</p>;
 const choose=digit=>{if(disabled)return;const next=pickCard(challenge,selected,digit);if(next===selected)return;onChange(next);if(next.length===6)onSubmit(next);};
 return <div className="space-y-4">
  <p className="text-sm">Build a ladder from lowest to highest. Ace is 1; 10 is highest. Tap every card once.</p>
  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Playing cards">
   {challenge.split('').map(digit=>{const chosen=selected.includes(digit),suit=suits[Number(digit)%4],red=['♥','♦'].includes(suit);return <button key={digit} type="button" aria-label={(digit==='0'?'10':digit==='1'?'Ace':digit)+' '+suit} aria-pressed={chosen} disabled={disabled||chosen} onClick={()=>choose(digit)} className={'relative flex min-h-28 flex-col items-center justify-center rounded-xl border-2 bg-white text-2xl font-bold shadow-sm transition hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 disabled:translate-y-0 disabled:opacity-60 '+(chosen?'border-indigo-500':'border-slate-300')+(red?' text-red-600':' text-slate-900')}>
    <span>{digit==='0'?'10':digit==='1'?'A':digit}</span><span aria-hidden="true">{suit}</span>{chosen&&<span className="absolute right-1 top-1 rounded-full bg-indigo-600 px-1.5 text-xs text-white">{selected.indexOf(digit)+1}</span>}
   </button>;})}
  </div>
  <p role="status" className="text-sm">Your ladder: {selected?selected.split('').map(d=>d==='0'?'10':d==='1'?'A':d).join(' → '):'Choose the lowest card'} ({selected.length}/6)</p>
  <div className="flex gap-2"><Button type="button" variant="outline" disabled={disabled||!selected} onClick={()=>onChange(selected.slice(0,-1))}>Undo</Button><Button type="button" variant="outline" disabled={disabled||!selected} onClick={()=>onChange('')}>Clear ladder</Button></div>
 </div>;
}
