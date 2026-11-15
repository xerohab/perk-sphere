import React from 'react';
import PaypalPayoutPanel from '@/components/perk/PaypalPayoutPanel';
import PageHeader from '@/components/perk/PageHeader';
export default function AdminPaypalPayouts(){return <div className="space-y-6"><PageHeader title="PayPal payouts" description="Review withdrawal requests and reconcile manual payments."/><PaypalPayoutPanel admin/></div>;}
