/* NEXMIR V5.1.19 · reglas compartidas de planes Free y Pro */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.NexmirPlanRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const LIMITS=Object.freeze({
    free:Object.freeze({bank:15,reviews:20,simulations:0,miniSimulations:1,battles:5}),
    pro:Object.freeze({bank:Infinity,reviews:Infinity,simulations:Infinity,miniSimulations:Infinity,battles:Infinity})
  });

  function normalizePlan(value){return String(value||'free').trim().toLowerCase()==='pro'?'pro':'free'}
  function hasUnlimitedAccess(profile={}){return ['admin','moderator'].includes(String(profile.role||'').toLowerCase())||normalizePlan(profile.plan)==='pro'}
  function localDay(value=new Date()){
    const d=value instanceof Date?value:new Date(value);
    return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  }
  function usedToday(kind,data={},now=new Date()){
    const day=localDay(now),sameDay=value=>value&&localDay(value)===day;
    const attempts=Array.isArray(data.attempts)?data.attempts:[];
    const reviews=Array.isArray(data.reviews)?data.reviews:[];
    const simulations=Array.isArray(data.simulations)?data.simulations:[];
    const battles=Array.isArray(data.battles)?data.battles:[];
    if(kind==='bank')return attempts.filter(x=>x.mode==='bank'&&sameDay(x.answered_at)).length;
    if(kind==='reviews')return reviews.filter(x=>sameDay(x.last_reviewed_at)).length;
    if(kind==='simulations')return simulations.filter(x=>sameDay(x.finished_at)&&!(x.mode==='mini'&&Number(x.total||0)<=15)).length;
    if(kind==='miniSimulations')return simulations.filter(x=>sameDay(x.finished_at)&&x.mode==='mini'&&Number(x.total||0)<=15).length;
    if(kind==='battles')return battles.filter(x=>sameDay(x.joined_at)).length;
    return 0;
  }
  function remaining(profile,kind,data={},now=new Date()){
    if(hasUnlimitedAccess(profile))return Infinity;
    const limit=LIMITS.free[kind]??Infinity;
    return limit===Infinity?Infinity:Math.max(0,limit-usedToday(kind,data,now));
  }
  function canStartSimulation(profile,{count,reserveCount=0,miniRemaining=0}={}){
    if(hasUnlimitedAccess(profile))return true;
    return Number(count)===15&&Number(reserveCount)===0&&Number(miniRemaining)>0;
  }
  function sanitizeBattleCode(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}
  function battleInviteUrl(base,code){const url=new URL(base),clean=sanitizeBattleCode(code);url.search='';url.hash='';if(clean)url.searchParams.set('battle',clean);return url.toString()}
  return Object.freeze({LIMITS,normalizePlan,hasUnlimitedAccess,localDay,usedToday,remaining,canStartSimulation,sanitizeBattleCode,battleInviteUrl});
});
