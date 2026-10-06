/* NEXMIR Focus V1 · reglas puras compartidas por UI y tests */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NexmirFocusRules=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function fastThreshold(median,count){return count>=30?Math.max(4,Number(median||0)*.20):4}
  function shouldWarn(recentFast){
    const a=(recentFast||[]).map(Boolean);
    const last3=a.slice(-3),last6=a.slice(-6);
    return (last3.length===3&&last3.every(Boolean)) || (last6.length>=4&&last6.filter(Boolean).length>=4);
  }
  function requiredValidQuestions(target,activeSeconds){return Math.max(activeSeconds>=600?5:3,Math.ceil(Math.max(1,target||1)*.70))}
  function focusValidity(target,activeSeconds,validQuestions){
    const t=Math.max(1,Number(target||1)),sec=Math.max(0,Number(activeSeconds||0)),q=Math.max(0,Number(validQuestions||0));
    const required=requiredValidQuestions(t,sec);
    return {required,validForXp:sec>=300&&q>=required,validForStreak:sec>=600&&q>=Math.max(5,Math.ceil(t*.70))};
  }
  function focusXp(activeSeconds,isValid=true){
    if(!isValid)return 0;const s=Math.max(0,Number(activeSeconds||0));
    return s>=1500?35:s>=900?25:s>=600?15:s>=300?10:0;
  }
  function focusQuestionTarget(minutes,median,count){
    if(!minutes)return 10;
    const defaults={5:4,10:7,15:10,25:18};
    const limits={5:[3,5],10:[6,8],15:[8,12],25:[15,20]};
    if(count<30||!median)return defaults[minutes]||10;
    const raw=Math.round(minutes*60/Math.max(4,median));
    const [lo,hi]=limits[minutes]||[3,40];
    return clamp(raw,lo,hi);
  }
  function effectiveMastery(score,lastAnsweredAt,now=Date.now()){
    const s=clamp(Number(score||0),0,100);
    if(!lastAnsweredAt)return s;
    const days=Math.max(0,(now-new Date(lastAnsweredAt).getTime())/86400000);
    const penalty=days<=14?0:days<=30?5:days<=60?10:days<=90?15:20;
    return clamp(s-penalty,0,100);
  }
  function masteryLabel(value){const n=Number(value||0);return n<25?'Débil':n<50?'En progreso':n<70?'En consolidación':n<85?'Sólido':'Dominado'}
  function topicMastery(states,totalQuestions,now=Date.now()){
    const rows=(states||[]).filter(Boolean);if(!rows.length||!totalQuestions)return 0;
    const avg=rows.reduce((s,x)=>s+effectiveMastery(x.mastery_score,x.last_valid_answered_at||x.last_answered_at,now),0)/rows.length;
    const coverage=clamp(rows.length/Math.max(1,totalQuestions),0,1);
    return Math.round(avg*(.5+.5*coverage));
  }
  function reviewPriority(row,now=Date.now()){
    if(!row)return 0;
    let score=0;const due=row.next_review_at&&new Date(row.next_review_at).getTime()<=now;
    if(due)score+=50;if(row.last_result===false)score+=30;
    const m=effectiveMastery(row.mastery_score,row.last_valid_answered_at||row.last_answered_at,now);
    if(m<40)score+=20;else if(m<=60)score+=10;
    score+=Math.max(0,Number(row.consecutive_incorrect||0)-1)*10;
    if(due)score+=Math.min(30,Math.max(0,Math.floor((now-new Date(row.next_review_at).getTime())/86400000)));
    return score;
  }
  function levelFromXp(xp){
    const total=Math.max(0,Number(xp||0));
    let level=Math.max(1,Math.floor(Math.sqrt(total/100))+1);
    while(total>=100*level*level)level++;
    while(level>1&&total<100*(level-1)*(level-1))level--;
    const prev=100*(level-1)*(level-1),next=100*level*level;
    return {xp:total,level,prev,next,pct:clamp(((total-prev)/(next-prev))*100,0,100)};
  }
  return {clamp,fastThreshold,shouldWarn,requiredValidQuestions,focusValidity,focusXp,focusQuestionTarget,effectiveMastery,masteryLabel,topicMastery,reviewPriority,levelFromXp};
});
