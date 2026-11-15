import React from 'react';
import {Link} from 'react-router-dom';

const work=[
 {id:'paypal',title:'PayPal withdrawal requests',status:'Manual request workflow implemented · activation requires rate and funding configuration',remaining:'Use the £50 minimum and explicitly configured Points-to-GBP rate. Configure and approve the cash policy and funding budget, deploy the accounting schema, and enable coordinated request/source gates. The queue reserves balances, records manual PayPal payments with unique transaction IDs and flags overdue requests. Processing requests require reconciliation before any replacement payment. Gift cards are deferred.',link:'/admin/paypal-payouts',label:'Open PayPal payout queue (Super Admin)'},
 {id:'core',title:'Core Points and XP',status:'Published · real-member acceptance pending',remaining:'Complete a genuine new-member registration, zero-balance wallet, game and daily-point claims, duplicate retries, partner/watch rewards, mobile checks and account switching. Confirm every expected credit in wallet history.',link:'/games',label:'Open games'},
 {id:'connections',title:'Providers and browser extension',status:'Integration code present · full coverage not signed off',remaining:'Confirm missing provider settings privately, test ordinary-member YouTube/X connections and browser pairing/activity tracking, and verify each promised partner event end to end. Account ownership alone does not verify viewing, likes or follows.',link:'/connected-services',label:'Open connected services'},
 {id:'cash',title:'Cash, withdrawals, Points top-ups and FX',status:'Incomplete / paused',remaining:'The agreed withdrawal minimum is £50. Finish production flows and approve Points-to-money rates, FX handling and funding policies before activation. Connect the providers and verify exact wallet receipts, duplicate handling and recovery. Existing XP/Points have not been assigned a live monetary value by this checklist.'},
 {id:'subscriptions',title:'Front Row paid subscriptions',status:'Prepared changes · live callback/access cutover outstanding',remaining:'Complete verified callback cutover, legacy ownership/entitlement migration, protected media and uncertain-write recovery. Then test genuine purchase, renewal, cancellation, refund and duplicate-event lifecycles.'},
 {id:'rewards',title:'Separately paused reward features',status:'Require their own reviewed activation and acceptance',remaining:'Review policy/content and activate only the intended social-link rewards, rewarded quizzes and XP conversion. Verify first awards, failed attempts where applicable, duplicate-zero outcomes and original wallet history.',link:'/admin/quizzes',label:'Open quiz policy administration'}
];

export default function LaunchRemainingWork(){
 return <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby="remaining-launch-work">
  <div><h2 id="remaining-launch-work" className="font-semibold">Remaining launch work</h2><p className="mt-2 text-sm text-muted-foreground">Engineering checklist updated 11 November 2026. The core site is published; the full launch still needs implementation, private setup and genuine member/provider acceptance.</p></div>
  <div className="grid gap-3 lg:grid-cols-2">{work.map(item=><article key={item.id} className="space-y-2 rounded-lg border p-4">
   <h3 className="font-medium">{item.title}</h3>
   <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{item.status}</p>
   <p className="text-sm">{item.remaining}</p>
   {item.link&&<Link className="inline-block text-sm underline" to={item.link}>{item.label}</Link>}
  </article>)}</div>
 </section>;
}
