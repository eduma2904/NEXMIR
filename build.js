/* Genera dist/ a partir de los archivos fuente. Uso: node build.js  (requiere: npm i esbuild)
   CSS: se concatena en el mismo orden en que index.html los cargaba y se minifica en un solo archivo.
   JS: cada archivo se minifica por separado (mismo orden y mismo ámbito global que antes). */
const esbuild=require('esbuild'),fs=require('fs'),path=require('path');
const CSS=['styles','layout_refinements','product_polish','tutorial','responsive','study_layout_fix','study_layout_v5_1_14','study_layout_v5_1_15','account_menu','exam_plan','ux_motion','tutorial_v5_1_32','mobile_nav','study_shortcuts','study_clarity','sim_analysis','battle_v5_1_21','arcade'];
const JS=['content_rules','taxonomy','session_manager','app','review_queue','content_admin','plan_rules','product','exam_blueprint','diagnostic_plan','adaptive_features','personalization','dashboard','mascot','focus_rules','focus','ui_refinements','study_resume','study_display','image_controls','interaction_polish','arcade','tutorial','study_performance_fix','account_menu','ux_motion','mobile_nav','study_shortcuts','onboarding_tips','study_clarity','sim_analysis'];
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
const css=CSS.map(n=>`/* ==== ${n}.css ==== */\n`+fs.readFileSync(n+'.css','utf8')).join('\n');
const out=esbuild.transformSync(css,{loader:'css',minify:true,legalComments:'none'});
fs.writeFileSync('dist/nexmir.min.css',out.code);
let before=css.length,after=out.code.length,jb=0,ja=0;
for(const n of JS){
  const src=fs.readFileSync(n+'.js','utf8');
  const r=esbuild.transformSync(src,{loader:'js',minify:true,legalComments:'none',target:'es2019'});
  fs.writeFileSync(`dist/${n}.min.js`,r.code);jb+=src.length;ja+=r.code.length;
}
console.log(`CSS ${(before/1024).toFixed(0)} KB -> ${(after/1024).toFixed(0)} KB (${CSS.length} archivos -> 1)`);
console.log(`JS  ${(jb/1024).toFixed(0)} KB -> ${(ja/1024).toFixed(0)} KB (${JS.length} archivos)`);
fs.writeFileSync('dist/orden_scripts.json',JSON.stringify(JS));
