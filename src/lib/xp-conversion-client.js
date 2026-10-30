const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function pendingConversion(raw){
 if(raw===null)return null;
 let value;try{value=JSON.parse(raw);}catch{throw Error('recovery_record_invalid');}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='action,policy_version,request_reference,xp'||value.action!=='convert'||!uuid(value.request_reference)||!Number.isSafeInteger(value.xp)||value.xp<=0||!Number.isSafeInteger(value.policy_version)||value.policy_version<1)throw Error('recovery_record_invalid');
 return value;
}
export function conversionInput(input,policy){
 if(typeof input!=='string'||!/^\d+$/.test(input))throw Error('invalid_amount');
 const amount=Number(input);
 if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(policy?.input_xp)||policy.input_xp<=0||amount%policy.input_xp!==0)throw Error('invalid_amount');
 return amount;
}
export function confirmedConversion(data,request){
 return !!data&&typeof data.duplicate==='boolean'&&typeof data.points_credited==='string'&&/^[1-9]\d{0,18}$/.test(data.points_credited)&&typeof data.xp_spent==='string'&&data.xp_spent===String(request.xp);
}
export function definitivePolicyChange(error){
 return error?.response?.status===409&&error.response.data?.error==='conversion_policy_changed'&&error.response.data?.retry_with_new_policy===true;
}
