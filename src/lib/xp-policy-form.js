export function xpPolicyUpdate({policy,inputXp,outputPoints,enabled}){
 const whole=value=>typeof value==='string'&&/^[1-9]\d{0,9}$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)<=1000000000;
 if(!whole(inputXp)||!whole(outputPoints)||typeof enabled!=='boolean'||!policy||typeof policy.configured!=='boolean')throw Error('invalid_policy');
 if(policy.configured&&(!Number.isSafeInteger(policy.version)||policy.version<1))throw Error('invalid_policy');
 return {action:'update',expected_version:policy.configured?policy.version:0,input_xp:Number(inputXp),output_points:Number(outputPoints),enabled:policy.configured?enabled:false};
}
