const assert=require('node:assert/strict');
const R=require('../focus_rules.js');
assert.equal(R.fastThreshold(30,30),6);
assert.equal(R.fastThreshold(10,30),4);
assert.equal(R.fastThreshold(99,29),4);
assert.equal(R.shouldWarn([true,true,true]),true);
assert.equal(R.shouldWarn([true,false,true,true,false,true]),true);
assert.equal(R.shouldWarn([true,false,true,false,false,true]),false);
assert.equal(R.requiredValidQuestions(8,600),6);
assert.equal(R.requiredValidQuestions(4,300),3);
assert.ok(R.focusQuestionTarget(10,30,30)>=6&&R.focusQuestionTarget(10,30,30)<=8);
assert.equal(R.effectiveMastery(80,new Date(Date.now()-20*86400000).toISOString()),75);
assert.equal(R.effectiveMastery(80,new Date(Date.now()-40*86400000).toISOString()),70);
assert.equal(R.effectiveMastery(80,new Date(Date.now()-100*86400000).toISOString()),60);
assert.equal(R.topicMastery([{mastery_score:90,last_answered_at:new Date().toISOString()}],5),54); // 20% cobertura => factor .60
assert.deepEqual(R.levelFromXp(0).level,1);
assert.ok(R.levelFromXp(400).level>=3);

// Casos de aceptación de la especificación V1.
assert.equal(R.focusValidity(8,600,6).validForStreak,true);      // 10 min, 6/8 = 75%
assert.equal(R.focusValidity(8,900,0).validForStreak,false);     // pestaña abierta sin estudio no basta
assert.equal(R.focusValidity(10,600,4).validForStreak,false);    // mínimo absoluto 5
assert.equal(R.focusValidity(10,300,7).validForStreak,false);    // Focus de 5 min no mantiene racha
assert.equal(R.focusXp(300,true),10);
assert.equal(R.focusXp(600,true),15);
assert.equal(R.focusXp(900,true),25);
assert.equal(R.focusXp(1500,true),35);
assert.equal(R.focusXp(1500,false),0);
assert.equal(R.masteryLabel(24),'Débil');
assert.equal(R.masteryLabel(49),'En progreso');
assert.equal(R.masteryLabel(69),'En consolidación');
assert.equal(R.masteryLabel(84),'Sólido');
assert.equal(R.masteryLabel(85),'Dominado');
const dueNow=new Date(Date.now()-5*86400000).toISOString();
assert.ok(R.reviewPriority({next_review_at:dueNow,last_result:false,mastery_score:20,consecutive_incorrect:2})>=100);

console.log('NEXMIR Focus rules: OK');
