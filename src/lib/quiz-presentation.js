export function unwrapQuizResponse(value){
 for(let i=0;i<4;i++){
  if(value?.ok===false)throw Error('Quiz service unavailable');
  if(value?.ok===true&&value.data!==undefined){value=value.data;continue;}
  return value;
 }
 throw Error('Invalid quiz response');
}
export function quizList(value,key){
 const data=unwrapQuizResponse(value);
 if(Array.isArray(data))return data;
 const rows=data?.[key]??data?.items;
 if(!Array.isArray(rows))throw Error('Invalid quiz list');
 return rows;
}
export function quizGrade(value){
 const data=unwrapQuizResponse(value);
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const score=Number(data.score_correct??data.score??data.correct),total=Number(data.question_count??data.total??data.total_questions);
 if(!Number.isSafeInteger(score)||!Number.isSafeInteger(total)||total<1||total>30||score<0||score>total)return null;
 return {score,total,percentage:Math.round(score*100/total)};
}
export function quizMedia(quiz){
 const reference=quiz?.video_reference||quiz?.video_ref;
 if(typeof reference!=='string')return null;
 if(quiz.provider==='partner'){
  try{const url=new URL(reference);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;return {type:'partner',url:url.href};}catch{return null;}
 }
 if(quiz.provider&&quiz.provider!=='youtube')return null;
 let id=reference;
 if(!/^[A-Za-z0-9_-]{11}$/.test(id)){
  try{
   const url=new URL(reference);
   if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
   if(url.hostname==='youtu.be')id=url.pathname.slice(1);
   else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))id=url.pathname.startsWith('/embed/')?url.pathname.slice(7):url.searchParams.get('v');
   else return null;
  }catch{return null;}
 }
 if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return null;
 return {type:'youtube',url:'https://www.youtube-nocookie.com/embed/'+id};
}
