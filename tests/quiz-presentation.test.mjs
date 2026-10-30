import test from 'node:test';
import assert from 'node:assert/strict';
import {quizList,quizGrade,quizMedia} from '../src/lib/quiz-presentation.js';
test('actual Linux grade fields survive Base44 success envelopes and replay responses',()=>{
 const result=quizGrade({ok:true,data:{ok:true,score_correct:2,question_count:3,already_submitted:true}});
 assert.deepEqual(result,{score:2,total:3,percentage:67});
 assert.deepEqual(quizGrade({score_correct:0,question_count:2}),{score:0,total:2,percentage:0});
});
test('history grades and malformed scores never fabricate successful results',()=>{
 assert.deepEqual(quizGrade({score_correct:3,question_count:3}),{score:3,total:3,percentage:100});
 for(const row of [{score_correct:4,question_count:3},{score_correct:-1,question_count:3},{score_correct:1,question_count:0},{},null])assert.equal(quizGrade(row),null);
 assert.throws(()=>quizGrade({ok:false,error:'private'}));
});
test('quiz arrays and keyed question lists are unwrapped; error and malformed lists are rejected',()=>{
 const rows=[{id:'question'}];assert.deepEqual(quizList({ok:true,data:{questions:rows}},'questions'),rows);assert.deepEqual(quizList({ok:true,data:rows},'quizzes'),rows);
 assert.throws(()=>quizList({ok:false},'quizzes'));assert.throws(()=>quizList({questions:{}},'questions'));
});
test('YouTube full URLs and legacy ids produce only a validated privacy-enhanced embed',()=>{
 for(const ref of ['kCEoDU1UjUw','https://www.youtube.com/watch?v=kCEoDU1UjUw','https://youtu.be/kCEoDU1UjUw'])assert.deepEqual(quizMedia({provider:'youtube',video_ref:ref}),{type:'youtube',url:'https://www.youtube-nocookie.com/embed/kCEoDU1UjUw'});
});
test('foreign hosts, unsafe protocols and credential-bearing URLs never become media embeds',()=>{
 for(const ref of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=kCEoDU1UjUw','https://name@youtube.com/watch?v=kCEoDU1UjUw','https://youtube.com:8443/watch?v=kCEoDU1UjUw'])assert.equal(quizMedia({provider:'youtube',video_ref:ref}),null);
});
test('partner videos are external links and cannot be mistaken for YouTube',()=>{
 assert.deepEqual(quizMedia({provider:'partner',video_reference:'https://partner.example/video'}),{type:'partner',url:'https://partner.example/video'});
 assert.equal(quizMedia({provider:'partner',video_reference:'javascript:alert(1)'}),null);
});
