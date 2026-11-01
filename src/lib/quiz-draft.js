const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function newQuizQuestion(){return {text:'',choices:['',''],correct_choice:0};}
export function newQuizDraft(){return {title:'',description:'',provider:'youtube',partner_uuid:'',video_ref:'',questions:[newQuizQuestion()]};}
export function quizDraftForCreate(d){
 const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 if(!d||!text(d.title,200)||typeof d.description!=='string'||d.description.length>10000||!Array.isArray(d.questions)||d.questions.length<1||d.questions.length>30||!['youtube','partner'].includes(d.provider)||typeof d.video_ref!=='string')throw Error('INVALID_QUIZ_DRAFT');
 let reference=d.video_ref.trim(),partner;
 if(d.provider==='youtube'){
  let id=reference;
  if(!/^[A-Za-z0-9_-]{11}$/.test(id)){let u;try{u=new URL(reference);}catch{throw Error('INVALID_QUIZ_DRAFT');}
   if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('INVALID_QUIZ_DRAFT');
   if(u.hostname==='youtu.be')id=u.pathname.slice(1);
   else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))id=u.pathname.startsWith('/embed/')?u.pathname.slice(7):u.searchParams.get('v');
   else throw Error('INVALID_QUIZ_DRAFT');
  }
  if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))throw Error('INVALID_QUIZ_DRAFT');
  reference='https://www.youtube.com/watch?v='+id;
 }else{
  if(!UUID.test(d.partner_uuid||''))throw Error('INVALID_QUIZ_DRAFT');partner=d.partner_uuid.toLowerCase();
  let u;try{u=new URL(reference);}catch{throw Error('INVALID_QUIZ_DRAFT');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||['youtube.com','youtu.be'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('INVALID_QUIZ_DRAFT');reference=u.href;
 }
 const questions=d.questions.map(q=>{
  if(!q||!text(q.text,2000)||!Array.isArray(q.choices)||q.choices.length<2||q.choices.length>6||q.choices.some(c=>!text(c,500))||!Number.isSafeInteger(q.correct_choice)||q.correct_choice<0||q.correct_choice>=q.choices.length)throw Error('INVALID_QUIZ_DRAFT');
  // Never filter choices: doing so can move the stored correct-answer index.
  return {text:q.text.trim(),choices:q.choices.map(c=>c.trim()),correct_choice:q.correct_choice};
 });
 return {title:d.title.trim(),description:d.description,provider:d.provider,...(partner?{partner_uuid:partner}:{}),video_ref:reference,questions};
}
