(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STORAGE_KEY = 'kirani_story_math_final_v1';
  const SCENES = ['cover','warmup','zoomBreak','lesson','practice','finalCheck','finish'];
  const MAJOR = ['warmup','lesson','practice','finalCheck','finish'];

  const freshState = () => ({
    scene: 'cover', warmIndex: 0, lessonGroup: 0, lessonIndex: 0,
    practiceIndex: 0, finalIndex: 0, records: {}, history: []
  });

  let state = freshState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = Object.assign(freshState(), JSON.parse(raw));
  } catch (_) {}

  function save(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    updateProgress();
  }

  function rec(key){
    if (!state.records[key]) state.records[key] = {
      structure_attempted:false, structure_correct:false,
      calculation_attempted:false, calculation_correct:false,
      wrong_count:0, hint_level:0, passed_by_teacher:false,
      mastered:false, parallel_unlocked:false, parallel_active:false,
      parallel_solved:false, extras:{}
    };
    return state.records[key];
  }

  function wrong(key){ const r=rec(key); r.wrong_count += 1; save(); return r.wrong_count; }
  function structureOK(key){ const r=rec(key); r.structure_attempted=true; r.structure_correct=true; save(); }
  function calculationOK(key){ const r=rec(key); r.calculation_attempted=true; r.calculation_correct=true; save(); }
  function mastered(key, flags={structure:true, calculation:true}){
    const r=rec(key);
    if (flags.structure){r.structure_attempted=true;r.structure_correct=true;}
    if (flags.calculation){r.calculation_attempted=true;r.calculation_correct=true;}
    r.mastered=true; r.passed_by_teacher=false; r.parallel_unlocked=true; save();
  }
  function setAttempt(key, field){ const r=rec(key); r[field]=true; save(); }

  function setFeedback(id, msg='', kind=''){
    const el=$(id); if(!el) return;
    el.className='feedback'+(kind?' '+kind:''); el.textContent=msg;
  }
  function toast(msg){
    const el=$('toast'); el.textContent=msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),1800);
  }
  function exact(v, target){
    if (v === null || v === undefined) return false;
    const n=Number(String(v).trim().replace(',','.')); return Number.isFinite(n) && Math.abs(n-target)<1e-9;
  }
  function normExpr(v){
    return String(v||'').toLowerCase()
      .replace(/[×x·]/g,'*').replace(/[÷:]/g,'/').replace(/[−–—]/g,'-')
      .replace(/\s+/g,'').replace(/\[/g,'(').replace(/\]/g,')');
  }
  function exprMatches(v, accepted){
    const n=normExpr(v); return accepted.some(a=>n===normExpr(a));
  }
  function esc(s){ return String(s).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c])); }
  function inputExpr(id,label='Expression'){
    return `<label class="field-label"><span>${label}</span><input id="${id}" class="expression-input" autocomplete="off" aria-label="${label}"></label>`;
  }
  function inputNum(id,label='Answer',suffix=''){
    return `<label class="field-label"><span>${label}</span><div class="answer-line" style="margin:0"><input id="${id}" class="answer-input" inputmode="decimal" autocomplete="off">${suffix?`<b class="answer-suffix">${suffix}</b>`:''}</div></label>`;
  }
  function routine(){
    return `<div class="read-build-banner"><div><b>READ</b><small>What is happening?</small></div><div><b>BUILD</b><small>Turn it into math.</small></div><div><b>SOLVE</b><small>Calculate.</small></div><div><b>CHECK</b><small>Does it fit?</small></div></div>`;
  }
  function story(text, compact=false){ return `<div class="story-card${compact?' compact':''}">${text}</div>`; }
  function choiceGrid(id, options, cls=''){
    return `<div id="${id}" class="choice-grid ${cls}">${options.map(o=>`<button class="choice-btn" type="button" data-value="${esc(o.value)}">${o.html||esc(o.label||o.value)}</button>`).join('')}</div>`;
  }
  function allSelected(set, expected){ return set.size===expected.length && expected.every(x=>set.has(x)); }

  function snapshot(){ return {scene:state.scene,warmIndex:state.warmIndex,lessonGroup:state.lessonGroup,lessonIndex:state.lessonIndex,practiceIndex:state.practiceIndex,finalIndex:state.finalIndex}; }
  function pushHistory(){
    state.history = state.history || [];
    state.history.push(snapshot()); if(state.history.length>80) state.history.shift(); save();
  }
  function restoreSnapshot(s){
    if(!s) return;
    state.scene=s.scene; state.warmIndex=s.warmIndex; state.lessonGroup=s.lessonGroup; state.lessonIndex=s.lessonIndex; state.practiceIndex=s.practiceIndex; state.finalIndex=s.finalIndex; save(); renderCurrent();
  }
  function goScene(id, push=true){
    if(push) pushHistory(); state.scene=id; save(); renderCurrent();
  }

  function renderCurrent(){
    SCENES.forEach(id=>$(id)?.classList.toggle('active', id===state.scene));
    $('teacherPass').disabled = ['cover','zoomBreak','finish'].includes(state.scene);
    if(state.scene==='warmup') renderWarm();
    if(state.scene==='lesson') renderLesson();
    if(state.scene==='practice') renderPractice();
    if(state.scene==='finalCheck') renderFinal();
    if(state.scene==='finish') renderFinish();
    updateProgress(); window.scrollTo({top:0,behavior:'instant'});
  }

  function updateProgress(){
    const dots=$('progressDots'); if(!dots) return;
    if(!dots.children.length) dots.innerHTML=MAJOR.map(()=>'<i></i>').join('');
    const idx=MAJOR.indexOf(state.scene);
    const doneMajor = {
      warmup: Array.from({length:5},(_,i)=>rec(`warm:${i}`)).every(r=>r.mastered||r.passed_by_teacher),
      lesson: lessonGroups.every((g,gi)=>g.tasks.every((_,ti)=>{const r=rec(`lesson:${gi}:${ti}`);return r.mastered||r.passed_by_teacher;})),
      practice: Array.from({length:8},(_,i)=>{const r=rec(`practice:${i}`);return r.mastered||r.passed_by_teacher;}).every(Boolean),
      finalCheck: Array.from({length:2},(_,i)=>{const r=rec(`final:${i}`);return r.mastered||r.passed_by_teacher;}).every(Boolean),
      finish: state.scene==='finish'
    };
    $$('#progressDots i').forEach((d,i)=>d.classList.toggle('done',doneMajor[MAJOR[i]]||idx>i));
    let frac=0;
    if(state.scene==='warmup') frac=(state.warmIndex)/5*0.2;
    else if(state.scene==='zoomBreak') frac=.2;
    else if(state.scene==='lesson') frac=.2 + ((state.lessonGroup + state.lessonIndex/Math.max(1,lessonGroups[state.lessonGroup].tasks.length))/lessonGroups.length)*.4;
    else if(state.scene==='practice') frac=.6 + state.practiceIndex/8*.2;
    else if(state.scene==='finalCheck') frac=.8 + state.finalIndex/2*.18;
    else if(state.scene==='finish') frac=1;
    $('progressFill').style.width=`${Math.max(0,Math.min(1,frac))*100}%`;
  }

  function statusRestore(key,nextId,feedbackId){
    const r=rec(key); const next=$(nextId);
    if(r.mastered){ if(next) next.disabled=false; setFeedback(feedbackId,'Previously completed. You can review it or continue.','good'); }
    else if(r.passed_by_teacher){ if(next) next.disabled=false; setFeedback(feedbackId,'Passed by teacher — not counted as mastery.','info'); }
  }

  function nextWarm(){
    if(state.warmIndex<4){pushHistory();state.warmIndex++;save();renderWarm();}
    else goScene('zoomBreak');
  }
  function nextLesson(){
    const g=lessonGroups[state.lessonGroup];
    if(state.lessonIndex<g.tasks.length-1){pushHistory();state.lessonIndex++;save();renderLesson();}
    else if(state.lessonGroup<lessonGroups.length-1){pushHistory();state.lessonGroup++;state.lessonIndex=0;save();renderLesson();}
    else goScene('practice');
  }
  function nextPractice(){
    if(state.practiceIndex<7){pushHistory();state.practiceIndex++;save();renderPractice();}
    else goScene('finalCheck');
  }
  function nextFinal(){
    if(state.finalIndex<1){pushHistory();state.finalIndex++;save();renderFinal();}
    else goScene('finish');
  }

  function currentKey(){
    if(state.scene==='warmup') return `warm:${state.warmIndex}`;
    if(state.scene==='lesson') return `lesson:${state.lessonGroup}:${state.lessonIndex}`;
    if(state.scene==='practice') return `practice:${state.practiceIndex}`;
    if(state.scene==='finalCheck') return `final:${state.finalIndex}`;
    return null;
  }
  function teacherPass(){
    const key=currentKey(); if(!key) return;
    const r=rec(key);
    // PASS moves on without awarding mastery. If the activity was already mastered,
    // preserve that earlier evidence instead of erasing it during a later review.
    if(!r.mastered) r.passed_by_teacher=true;
    const lessonId = state.scene==='lesson' ? lessonGroups[state.lessonGroup]?.tasks[state.lessonIndex]?.id : null;
    const hasParallel = state.scene==='practice' || (state.scene==='lesson' && ['family-1','family-2'].includes(lessonId));
    // Phase-1 policy: an intentional teacher PASS may unlock the specified parallel retry,
    // but the retry never changes the original mastery record.
    if(hasParallel) r.parallel_unlocked=true;
    save();
    toast('Passed by teacher — no mastery awarded.');
    if(state.scene==='warmup') nextWarm();
    else if(state.scene==='lesson') nextLesson();
    else if(state.scene==='practice') nextPractice();
    else if(state.scene==='finalCheck') nextFinal();
  }

  // ---------- WARMING UP ----------
  const warmHints = [
    ['30% means 3 groups of 10%. What is 10% of 240?','10% of 240 = 24. Now find 3 × 24.'],
    ['Division and multiplication have the same priority. Which comes first from the left?','Start with 18 ÷ 3.'],
    ['÷ and × have equal priority. Read from left to right.','Start with 48 ÷ 6.'],
    ['What changes from the starting amount?','Start 325 → 78 leave → ? remain.'],
    ['What gives the total number of pencils before any are handed out?','Build 7 × 18 first, but keep the final operation for yourself.']
  ];
  function hintFor(key, feedbackId, list){
    const r=rec(key); r.hint_level=Math.min(list.length,r.hint_level+1); save();
    setFeedback(feedbackId,list[Math.max(0,r.hint_level-1)],'info');
  }

  function renderWarm(){
    const i=state.warmIndex,key=`warm:${i}`,root=$('warmContent');
    $('warmCounter').textContent=`${i+1} / 5`; $('warmNext').disabled=true; setFeedback('warmFeedback');
    const tag=['PERCENTAGE SPIRAL','BODMAS','LEFT-TO-RIGHT','STORY OPERATION','EXPRESSION ONLY'][i]; $('warmTag').textContent=tag;
    if(i===0){
      root.innerHTML=`${routine()}<div class="question-focus"><p>Find</p><div class="big-math">30% of 240</div></div><div class="answer-line"><input id="w0" class="answer-input" inputmode="numeric" aria-label="answer"></div><button id="w0check" class="primary-btn inline-check" type="button">Check</button>`;
      $('w0check').onclick=()=>{setAttempt(key,'calculation_attempted'); if(exact($('w0').value,72)){mastered(key,{structure:false,calculation:true});$('warmNext').disabled=false;setFeedback('warmFeedback','72. Percentage memory is ready.','good');}else{wrong(key);setFeedback('warmFeedback',rec(key).wrong_count>1?'10% of 240 = 24. Now calculate 3 × 24.':'Not yet — 30% is 3 groups of 10%.','bad');}};
    } else if(i===1){
      root.innerHTML=`${routine()}<div class="question-focus"><p>Calculate</p><div class="big-math">36 − 18 ÷ 3 × 4</div></div><div class="stage-box"><h4>1 · Which operation happens first?</h4>${choiceGrid('w1choice',[{value:'18/3',label:'18 ÷ 3'},{value:'3*4',label:'3 × 4'},{value:'36-18',label:'36 − 18'}],'three')}</div><div id="w1calc" class="stage-box locked" style="margin-top:10px"><h4>2 · Calculate the final result</h4><div class="answer-line"><input id="w1" class="answer-input" inputmode="numeric"></div><button id="w1check" class="primary-btn inline-check" type="button">Check result</button></div>`;
      let ok=rec(key).structure_correct; if(ok)$('w1calc').classList.remove('locked');
      $$('.choice-btn',$('w1choice')).forEach(b=>b.onclick=()=>{setAttempt(key,'structure_attempted');if(b.dataset.value==='18/3'){structureOK(key);ok=true;$$('.choice-btn',$('w1choice')).forEach(x=>{x.disabled=true;x.classList.toggle('correct',x===b);});$('w1calc').classList.remove('locked');setFeedback('warmFeedback','Correct first move. Keep going left-to-right through ÷ and ×.','good');}else{wrong(key);b.classList.add('wrong');setTimeout(()=>b.classList.remove('wrong'),450);setFeedback('warmFeedback',rec(key).wrong_count>1?'Start with 18 ÷ 3.':'Division and multiplication have equal priority. Read from the left.','bad');}});
      $('w1check').onclick=()=>{setAttempt(key,'calculation_attempted');if(!ok){setFeedback('warmFeedback','Choose the first operation before calculating.','info');return;}if(exact($('w1').value,12)){mastered(key);$('warmNext').disabled=false;setFeedback('warmFeedback','Route and calculation both work.','good');}else{wrong(key);setFeedback('warmFeedback','Your first move works. Check the calculation: 18 ÷ 3 = 6, then 6 × 4.','bad');}};
    } else if(i===2){
      root.innerHTML=`${routine()}<div class="question-focus"><p>Which operation happens first?</p><div class="big-math">48 ÷ 6 × 3</div></div>${choiceGrid('w2choice',[{value:'48/6',label:'48 ÷ 6'},{value:'6*3',label:'6 × 3'}])}<div id="w2calc" class="stage-box locked" style="margin-top:12px"><h4>Now calculate</h4><div class="answer-line"><input id="w2" class="answer-input" inputmode="numeric"></div><button id="w2check" class="primary-btn inline-check" type="button">Check result</button></div>`;
      let ok=rec(key).structure_correct;if(ok)$('w2calc').classList.remove('locked');
      $$('.choice-btn',$('w2choice')).forEach(b=>b.onclick=()=>{if(b.dataset.value==='48/6'){structureOK(key);ok=true;$$('.choice-btn',$('w2choice')).forEach(x=>{x.disabled=true;x.classList.toggle('correct',x===b);});$('w2calc').classList.remove('locked');setFeedback('warmFeedback','Yes — equal priority means left-to-right.','good');}else{wrong(key);setFeedback('warmFeedback',rec(key).wrong_count>1?'Follow the expression from left to right: 48 ÷ 6 first.':'÷ and × are equal priority.','bad');}});
      $('w2check').onclick=()=>{if(!ok){setFeedback('warmFeedback','Find the first move first.','info');return;}if(exact($('w2').value,24)){mastered(key);$('warmNext').disabled=false;setFeedback('warmFeedback','24. Left-to-right check complete.','good');}else{wrong(key);setFeedback('warmFeedback','48 ÷ 6 = 8. Continue with 8 × 3.','bad');}};
    } else if(i===3){
      root.innerHTML=`${routine()}${story('A library has <strong>325 books</strong> on a display. During the day, <strong>78 books are borrowed</strong>.<br><br>How many books remain?')}<div class="stage-box" style="margin-top:12px"><h4>1 · What operation represents what happens?</h4>${choiceGrid('w3choice',[{value:'+',label:'+'},{value:'-',label:'−'},{value:'*',label:'×'},{value:'/',label:'÷'}],'four')}</div><div id="w3calc" class="stage-box locked" style="margin-top:10px"><h4>2 · Calculate</h4><div class="answer-line"><input id="w3" class="answer-input" inputmode="numeric"></div><button id="w3check" class="primary-btn inline-check" type="button">Check</button></div>`;
      let ok=rec(key).structure_correct;if(ok)$('w3calc').classList.remove('locked');
      $$('.choice-btn',$('w3choice')).forEach(b=>b.onclick=()=>{if(b.dataset.value==='-'){structureOK(key);ok=true;$$('.choice-btn',$('w3choice')).forEach(x=>{x.disabled=true;x.classList.toggle('correct',x===b);});$('w3calc').classList.remove('locked');setFeedback('warmFeedback','The amount gets smaller. Now calculate.','good');}else{wrong(key);setFeedback('warmFeedback',rec(key).wrong_count>1?'Start with 325. Then 78 books leave.':'What changes from the starting amount?','bad');}});
      $('w3check').onclick=()=>{if(!ok){setFeedback('warmFeedback','Choose the operation first.','info');return;}if(exact($('w3').value,247)){mastered(key);$('warmNext').disabled=false;setFeedback('warmFeedback','Good structure and calculation.','good');}else{wrong(key);setFeedback('warmFeedback','Your operation is correct. Recalculate 325 − 78.','bad');}};
    } else {
      root.innerHTML=`${routine()}${story('<strong>DO NOT SOLVE YET.</strong><br><br>There are <strong>7 boxes</strong> with <strong>18 pencils in each box</strong>. Then <strong>25 pencils are handed out</strong>.<br><br>Write one expression that represents the story.')}<div class="stage-box" style="margin-top:14px">${inputExpr('w4','Expression only')}<button id="w4check" class="primary-btn inline-check" type="button">Check expression</button></div>`;
      $('w4check').onclick=()=>{setAttempt(key,'structure_attempted');if(exprMatches($('w4').value,['7*18-25','18*7-25'])){mastered(key,{structure:true,calculation:false});$('warmNext').disabled=false;setFeedback('warmFeedback','Expression built. Stop there — no solving needed.','good');}else{wrong(key);setFeedback('warmFeedback',rec(key).wrong_count>1?'First chunk: 7 × 18. What happens after that?':'What gives the total number of pencils before any are handed out?','bad');}};
    }
    $('warmHint').onclick=()=>hintFor(key,'warmFeedback',warmHints[i]);
    $('warmNext').onclick=nextWarm; statusRestore(key,'warmNext','warmFeedback');
  }

  // ---------- LESSON DEFINITIONS ----------
  const lessonGroups = [
    {name:'Story → Expression',small:'4 meanings + combined structures',tag:'STORY → EXPRESSION',tasks:['core-add','core-sub','core-mul','core-div','combined-a','combined-b','combined-c']},
    {name:'Story Strip',small:'scaffold fades A → B → C',tag:'STORY STRIP',tasks:['strip-a','strip-b','strip-c']},
    {name:'Guided → Parallel',small:'transfer with less support',tag:'GUIDED → PARALLEL',tasks:['family-1','family-2']},
    {name:'Story Lab',small:'meaning puzzles + Error Lab',tag:'STORY LAB',tasks:['irrelevant','same-numbers','builder-1','builder-2','error-1','error-2']},
    {name:'TKA Operations Lab',small:'3 levels + response variety',tag:'TKA OPERATIONS',tasks:['tka-l1','tka-l2','tka-l3','tka-h1','tka-h2','tka-h3','tka-h4','tka-h5','tka-h6']}
  ];
  // replace string task ids with descriptors so progress map remains simple
  lessonGroups.forEach(g=>g.tasks=g.tasks.map(id=>({id})));

  const lessonHints = {
    'core-add':['Are two amounts joining, or is something leaving?','135 and 48 join.'],
    'core-sub':['What is the starting whole? What leaves?','Start at 210, remove 67.'],
    'core-mul':['What quantity repeats? How many equal groups?','14 is repeated 9 times.'],
    'core-div':['What is being shared? How many equal groups?','156 is split into 12 equal groups.'],
    'combined-a':['What total exists before 15 oranges can be eaten?','Build 6 × 8 first, then remove 15.'],
    'combined-b':['Put the two team totals together before sharing.','48 + 36 first, then divide by 7.'],
    'combined-c':['Find the books on the five shelves before adding the extras.','5 × 26 first, then add 14.'],
    'strip-a':['Before anything is used, how many stickers are there?','First build the total with 7 × 18.'],
    'strip-b':['Can you share the remainder before you know how many tokens remain?','Total → remove → share.'],
    'strip-c':['What amount exists before 32 beads can be used?','Total → subtract 32 → divide by 4.'],
    'family-1':['Find the starting total first.','8 shelves × 25 books, then subtract 36.'],
    'family-2':['The story has three events.','Total first: 6 × 20, then remove 12, then share by 9.'],
    'irrelevant':['Which number does not describe the juice-carton count?','Would changing the number of teachers change how many cartons arrived or were sold?'],
    'same-numbers':['Describe what happens before looking at the numbers.','Story A builds equal groups then shares; Story B builds equal groups then removes.'],
    'builder-1':['What creates the starting total?','Four equal groups of 27 come first.'],
    'builder-2':['Build the total before anything is lost.','5 × 18 → subtract 10 → share by 4.'],
    'error-1':['Are 5 and 18 two separate amounts, or 5 equal groups of 18?','18 + 18 + 18 + 18 + 18 represents the baskets.'],
    'error-2':['What does “shared equally among 8” mean?','Find each student’s share first: 72 ÷ 8.'],
    'tka-l1':['Berapa jumlah seluruh siswa?','Jumlah siswa → jumlah buku → kardus.'],
    'tka-l2':['Informasi mana yang benar-benar diperlukan?','Jumlah guru tidak mengubah 36 botol yang sudah disebutkan langsung.'],
    'tka-l3':['Cari jumlah seluruh kartu terlebih dahulu.','7 × 28 adalah langkah pertama.'],
    'tka-h1':['Cari jumlah awal semua bola.','6 × 15 → kurangi 18 → bagi 6.'],
    'tka-h2':['Bangun jumlah awal sebelum memilih jawaban.','5 × 36 → kurangi 24 → bagi 6.'],
    'tka-h3':['Periksa pernyataan sesuai urutan cerita.','Mulai dengan 6 × 20 = 120.'],
    'tka-h4':['24 harus dikurangi dari jumlah seluruh botol sebelum dibagi.','Jumlah seluruh botol adalah 120.'],
    'tka-h5':['Cari jumlah seluruh siswa terlebih dahulu.','(24 + 30 + 36) membentuk jumlah siswa.'],
    'tka-h6':['Operasi pertama harus membentuk jumlah semua snack.','5 × 28 → −20 → ÷10.']
  };

  function renderLessonTabs(){
    const nav=$('lessonTabs'); nav.innerHTML=lessonGroups.map((g,gi)=>{
      const statuses=g.tasks.map((_,ti)=>rec(`lesson:${gi}:${ti}`));
      const done=statuses.every(r=>r.mastered||r.passed_by_teacher);
      const partial=statuses.some(r=>r.mastered||r.passed_by_teacher);
      return `<button type="button" class="lesson-tab ${gi===state.lessonGroup?'active ':''}${done?'done':partial?'partial':''}" data-gi="${gi}">${gi+1}. ${g.name}<small>${g.small}</small></button>`;
    }).join('');
    $$('.lesson-tab',nav).forEach(b=>b.onclick=()=>{const gi=Number(b.dataset.gi);if(gi===state.lessonGroup)return;pushHistory();state.lessonGroup=gi;state.lessonIndex=0;save();renderLesson();});
  }
  function renderSubtaskPills(){
    const g=lessonGroups[state.lessonGroup];
    return `<div class="subtask-strip">${g.tasks.map((_,ti)=>{const r=rec(`lesson:${state.lessonGroup}:${ti}`);return `<span class="subtask-pill ${ti===state.lessonIndex?'active':r.mastered?'done':r.passed_by_teacher?'passed':''}">${ti+1}</span>`;}).join('')}</div>`;
  }

  function simpleModelLesson(key, cfg){
    const root=$('lessonContent'), r=rec(key);
    root.innerHTML=`${renderSubtaskPills()}${routine()}${story(cfg.story)}<div class="stage-box" style="margin-top:12px"><h4>1 · Identify the story structure</h4>${choiceGrid('lmStruct',cfg.choices||[
      {value:'join',label:'Combine / total'},{value:'leave',label:'Decrease / left'},{value:'repeat',label:'Equal groups'},{value:'share',label:'Sharing / group size'}
    ],'four')}</div><div id="lmBuild" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><h4>2 · Build the math, then solve</h4><div class="field-grid">${inputExpr('lmExpr','Expression')}${inputNum('lmAns','Answer',cfg.suffix||'')}</div><button id="lmCheck" class="primary-btn inline-check" type="button">Check model + answer</button></div>`;
    $$('.choice-btn',$('lmStruct')).forEach(b=>b.onclick=()=>{setAttempt(key,'structure_attempted'); if(b.dataset.value===cfg.correctStructure){structureOK(key);$$('.choice-btn',$('lmStruct')).forEach(x=>{x.disabled=true;x.classList.toggle('correct',x===b);});$('lmBuild').classList.remove('locked');setFeedback('lessonFeedback',cfg.structureGood||'Good structure. Build the expression now.','good');}else{const wc=wrong(key);b.classList.add('wrong');setTimeout(()=>b.classList.remove('wrong'),400);setFeedback('lessonFeedback',wc>1?cfg.hints[1]:cfg.hints[0],'bad');}});
    $('lmCheck').onclick=()=>{setAttempt(key,'calculation_attempted');const e=exprMatches($('lmExpr').value,cfg.accept),a=exact($('lmAns').value,cfg.answer);if(e)structureOK(key);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','Model and calculation both work.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','Your model works. Keep it — only the arithmetic needs a retry.','bad');}else{wrong(key);setFeedback('lessonFeedback','The numbers are from the story, but the mathematical structure needs a different route.','bad');}};
  }

  function expressionAnswerLesson(key,cfg){
    const root=$('lessonContent');root.innerHTML=`${renderSubtaskPills()}${routine()}${story(cfg.story)}${cfg.note?`<div class="info-strip" style="margin-top:10px">${cfg.note}</div>`:''}<div class="stage-box" style="margin-top:12px"><h4>Build the complete model</h4><div class="field-grid">${inputExpr('laExpr','Expression')}${inputNum('laAns','Answer',cfg.suffix||'')}</div><button id="laCheck" class="primary-btn inline-check" type="button">Check</button></div>`;
    $('laCheck').onclick=()=>{setAttempt(key,'structure_attempted');setAttempt(key,'calculation_attempted');const e=exprMatches($('laExpr').value,cfg.accept),a=exact($('laAns').value,cfg.answer);if(e)structureOK(key);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback',cfg.good||'Good model.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','Your route works. Check the calculation.','bad');}else{wrong(key);setFeedback('lessonFeedback',rec(key).wrong_count>1?cfg.hints[1]:cfg.hints[0],'bad');}};
  }

  function setupOrderBuilder({poolId,outId,checkId,items,correct,key,onCorrect,feedbackId='lessonFeedback',wrongMsg}){
    let placed=[];
    const pool=$(poolId),out=$(outId);
    function draw(){
      pool.innerHTML=items.map((it,idx)=>placed.includes(idx)?'':`<button type="button" class="order-token" data-idx="${idx}">${it.label}</button>`).join('');
      out.innerHTML=placed.map(idx=>`<button type="button" class="order-token" data-remove="${idx}">${items[idx].label}</button>`).join('');
      out.classList.toggle('empty',placed.length===0);
      $$('[data-idx]',pool).forEach(b=>b.onclick=()=>{placed.push(Number(b.dataset.idx));draw();});
      $$('[data-remove]',out).forEach(b=>b.onclick=()=>{placed=placed.filter(x=>x!==Number(b.dataset.remove));draw();});
    }
    draw();
    $(checkId).onclick=()=>{setAttempt(key,'structure_attempted');const vals=placed.map(i=>items[i].value);if(vals.length===correct.length&&correct.every((v,j)=>vals[j]===v)){structureOK(key);setFeedback(feedbackId,'Order works. Continue with the mathematics.','good');onCorrect(vals);}else{wrong(key);setFeedback(feedbackId,rec(key).wrong_count>1?'The total must exist before anything can be removed or shared.':wrongMsg,'bad');}};
  }

  function setupExpressionBuilder({poolId,outId,checkId,tokens,accepted,key,onCorrect,feedbackId='lessonFeedback'}){
    let placed=[];
    const pool=$(poolId),out=$(outId);
    function draw(){
      // Each visual card can be used once. Duplicate symbols that are genuinely needed
      // (for example the two + cards in the TKA builder) exist as separate token indices.
      pool.innerHTML=tokens.map((t,i)=>placed.includes(i)?'':`<button type="button" class="builder-token" data-add="${i}">${esc(t)}</button>`).join('');
      out.innerHTML=placed.map((i,p)=>`<button type="button" class="builder-token" data-pos="${p}">${esc(tokens[i])}</button>`).join('');
      out.classList.toggle('empty',placed.length===0);
      $$('[data-add]',pool).forEach(b=>b.onclick=()=>{placed.push(Number(b.dataset.add));draw();});
      $$('[data-pos]',out).forEach(b=>b.onclick=()=>{placed.splice(Number(b.dataset.pos),1);draw();});
    }
    draw();
    $(checkId).onclick=()=>{setAttempt(key,'structure_attempted');const s=placed.map(i=>tokens[i]).join('');if(exprMatches(s,accepted)){structureOK(key);onCorrect(s);setFeedback(feedbackId,'Expression structure works.','good');}else{wrong(key);setFeedback(feedbackId,rec(key).wrong_count>1?'Build the starting total first.':'Build the math first — do not simply use every card.','bad');}};
  }

  function renderLesson(){
    renderLessonTabs();
    const g=lessonGroups[state.lessonGroup], id=g.tasks[state.lessonIndex].id, key=`lesson:${state.lessonGroup}:${state.lessonIndex}`;
    $('lessonTag').textContent=g.tag; $('lessonCounter').textContent=`${state.lessonIndex+1} / ${g.tasks.length}`; $('lessonNext').disabled=true; $('lessonParallel').hidden=true; $('lessonParallel').innerHTML=''; setFeedback('lessonFeedback');
    const root=$('lessonContent'); root.innerHTML='';

    if(id==='core-add') simpleModelLesson(key,{story:'Maya has <strong>135 stickers</strong>. Her friend gives her <strong>48 more</strong>.<br><br>How many stickers does Maya have now?',correctStructure:'join',accept:['135+48','48+135'],answer:183,hints:lessonHints[id],structureGood:'Two amounts join. Now build the expression.'});
    else if(id==='core-sub') simpleModelLesson(key,{story:'A box contains <strong>210 paper clips</strong>. <strong>67 are used</strong>.<br><br>How many remain?',correctStructure:'leave',accept:['210-67'],answer:143,hints:lessonHints[id],structureGood:'Start with the whole, then remove what is used.'});
    else if(id==='core-mul') simpleModelLesson(key,{story:'There are <strong>9 trays</strong> with <strong>14 cups on each tray</strong>.<br><br>How many cups are there altogether?',correctStructure:'repeat',accept:['9*14','14*9'],answer:126,hints:lessonHints[id],structureGood:'14 repeats in 9 equal groups.'});
    else if(id==='core-div') simpleModelLesson(key,{story:'<strong>156 cards</strong> are shared equally among <strong>12 students</strong>.<br><br>How many cards does each student get?',correctStructure:'share',accept:['156/12'],answer:13,hints:lessonHints[id],structureGood:'The total is split into 12 equal groups.'});
    else if(id==='combined-a') expressionAnswerLesson(key,{story:'Six bags contain <strong>8 oranges each</strong>. Then <strong>15 oranges are eaten</strong>.<br><br>How many oranges are left?',accept:['6*8-15','8*6-15'],answer:33,hints:lessonHints[id],note:'The final word “left” does not tell us the starting total. Build the total first.'});
    else if(id==='combined-b') expressionAnswerLesson(key,{story:'Team Red collected <strong>48 tokens</strong> and Team Blue collected <strong>36 tokens</strong>. They put all the tokens together and share them equally among <strong>7 players</strong>.<br><br>How many tokens does each player get?',accept:['(48+36)/7','(36+48)/7'],answer:12,hints:lessonHints[id],note:'Combine the two team amounts before the sharing step.'});
    else if(id==='combined-c') expressionAnswerLesson(key,{story:'Five shelves hold <strong>26 books each</strong>. The teacher places <strong>14 extra books</strong> on a table.<br><br>How many books are there altogether?',accept:['5*26+14','26*5+14'],answer:144,hints:lessonHints[id]});
    else if(id==='strip-a') renderStripA(key);
    else if(id==='strip-b') renderStripB(key);
    else if(id==='strip-c') renderStripC(key);
    else if(id==='family-1') renderFamily1(key);
    else if(id==='family-2') renderFamily2(key);
    else if(id==='irrelevant') renderIrrelevantLesson(key);
    else if(id==='same-numbers') renderSameNumbersLesson(key);
    else if(id==='builder-1') renderBuilderLesson(key,1);
    else if(id==='builder-2') renderBuilderLesson(key,2);
    else if(id==='error-1') renderErrorLesson(key,1);
    else if(id==='error-2') renderErrorLesson(key,2);
    else if(id.startsWith('tka-')) renderTKALesson(key,id);

    $('lessonHint').onclick=()=>hintFor(key,'lessonFeedback',lessonHints[id]||['Build the math first.']);
    $('lessonNext').onclick=nextLesson; statusRestore(key,'lessonNext','lessonFeedback');
    renderLessonParallel(key,id);
  }

  function renderStripA(key){
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}<div class="event-strip"><div class="event-card"><strong>Card 1</strong><br>7 bags · 18 stickers in each bag</div><div class="event-arrow">↓</div><div class="event-card"><strong>Card 2</strong><br>21 stickers are used for prizes</div><div class="event-arrow">↓</div><div class="event-card"><strong>Card 3</strong><br>The rest are shared equally among 5 classes</div></div><div class="stage-box"><h4>Convert each story card into a mathematical action</h4><div class="field-grid three"><label class="field-label"><span>Card 1</span><select id="sa1" class="mini-select"><option value="">Choose</option><option>7 × 18</option><option>7 + 18</option><option>18 ÷ 7</option></select></label><label class="field-label"><span>Card 2</span><select id="sa2" class="mini-select"><option value="">Choose</option><option>− 21</option><option>+ 21</option><option>÷ 21</option></select></label><label class="field-label"><span>Card 3</span><select id="sa3" class="mini-select"><option value="">Choose</option><option>÷ 5</option><option>× 5</option><option>− 5</option></select></label></div><button id="saRoute" class="ghost-btn inline-check" type="button">Check route</button></div><div id="saBuild" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><h4>Expression + answer</h4><div class="field-grid">${inputExpr('saExpr')}${inputNum('saAns','Stickers per class')}</div><button id="saCheck" class="primary-btn inline-check" type="button">Check</button></div>`;
    $('saRoute').onclick=()=>{if($('sa1').value==='7 × 18'&&$('sa2').value==='− 21'&&$('sa3').value==='÷ 5'){structureOK(key);$('saBuild').classList.remove('locked');setFeedback('lessonFeedback','The story route is correct: total → remove → share.','good');}else{wrong(key);setFeedback('lessonFeedback',rec(key).wrong_count>1?'First route card: 7 × 18. Keep correct cards and repair the rest.':'Map each story event to an operation.','bad');}};
    $('saCheck').onclick=()=>{if(!rec(key).structure_correct){setFeedback('lessonFeedback','Build the route first.','info');return;}const e=exprMatches($('saExpr').value,['(7*18-21)/5','(18*7-21)/5']),a=exact($('saAns').value,21);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','21 stickers per class. Scaffold A complete.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','The expression works. Check the arithmetic.','bad');}else{wrong(key);setFeedback('lessonFeedback','Use the route you already built to write one expression.','bad');}};
  }

  function renderStripB(key){
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}${story('A game club has <strong>9 packs of 14 tokens</strong>. <strong>18 tokens are set aside</strong> for the final round. The rest are <strong>shared equally among 6 teams</strong>.')}<div class="stage-box" style="margin-top:12px"><h4>Arrange the story events</h4><div id="sbPool" class="order-pool"></div><div id="sbOut" class="order-output empty"></div><button id="sbOrderCheck" class="ghost-btn inline-check" type="button">Check event order</button></div><div id="sbMath" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><h4>Convert the ordered story to math</h4><div id="sbMathPool" class="order-pool"></div><div id="sbMathOut" class="order-output empty"></div><div class="answer-line"><input id="sbAns" class="answer-input" inputmode="numeric"><b class="answer-suffix">tokens/team</b></div><button id="sbCheck" class="primary-btn inline-check" type="button">Check math route + answer</button></div>`;
    let eventsOK=false;
    setupOrderBuilder({poolId:'sbPool',outId:'sbOut',checkId:'sbOrderCheck',key,items:[
      {value:'share',label:'Share the remainder among 6 teams'},{value:'total',label:'Find the total from 9 packs of 14'},{value:'remove',label:'Set aside 18 tokens'}],correct:['total','remove','share'],wrongMsg:'Can you share the remainder before you know how many tokens remain?',onCorrect:()=>{eventsOK=true;$('sbMath').classList.remove('locked');}});
    if(r.structure_correct){eventsOK=true;$('sbMath').classList.remove('locked');}
    setupOrderBuilder({poolId:'sbMathPool',outId:'sbMathOut',checkId:'sbCheck',key,items:[{value:'div',label:'÷ 6'},{value:'mul',label:'9 × 14'},{value:'sub',label:'− 18'}],correct:['mul','sub','div'],wrongMsg:'Convert the story in the same order: total → remove → share.',onCorrect:()=>{if(!eventsOK)return; if(exact($('sbAns').value,18)){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','18 tokens per team. Event order and math route both work.','good');}else{setAttempt(key,'calculation_attempted');wrong(key);setFeedback('lessonFeedback','The route works. Check the final calculation: 126 − 18 = 108, then share.','bad');}}});
  }

  function renderStripC(key){
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}${story('During art club, the teacher has <strong>8 packets containing 16 beads each</strong>. <strong>32 beads are used</strong> to decorate a poster. The remaining beads are packed equally into <strong>4 jars</strong>.<br><br>How many beads go into each jar?')}<div class="stage-box" style="margin-top:12px"><h4>Build the three-step route</h4><div id="scPool" class="order-pool"></div><div id="scOut" class="order-output empty"></div><button id="scRoute" class="ghost-btn inline-check" type="button">Check route</button></div><div id="scSolve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><div class="field-grid">${inputExpr('scExpr')}${inputNum('scAns','Beads per jar')}</div><button id="scCheck" class="primary-btn inline-check" type="button">Check model + answer</button></div>`;
    setupOrderBuilder({poolId:'scPool',outId:'scOut',checkId:'scRoute',key,items:[{value:'div',label:'÷ 4'},{value:'sub',label:'− 32'},{value:'mul',label:'8 × 16'},{value:'add',label:'+ 32'}],correct:['mul','sub','div'],wrongMsg:'What happens first in the story mathematically?',onCorrect:()=>{$('scSolve').classList.remove('locked');}});
    $('scCheck').onclick=()=>{if(!rec(key).structure_correct){setFeedback('lessonFeedback','Build the route first.','info');return;}const e=exprMatches($('scExpr').value,['(8*16-32)/4','(16*8-32)/4']),a=exact($('scAns').value,24);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','24 beads per jar. The scaffold is now mostly gone.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','Your model works. Check the arithmetic.','bad');}else{wrong(key);setFeedback('lessonFeedback','Use the route you built: total → remove → share.','bad');}};
  }

  function renderFamily1(key){
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}${story('A school library has <strong>8 shelves</strong> with <strong>25 books on each shelf</strong>. During the week, <strong>36 books are borrowed</strong>.<br><br>How many books remain in the library?')}<div class="stage-grid"><div class="stage-box"><h4>1 · Starting total</h4>${inputExpr('f1first','First expression chunk')}<button id="f1firstCheck" class="ghost-btn inline-check" type="button">Check first chunk</button></div><div id="f1fullBox" class="stage-box ${r.structure_correct?'':'locked'}"><h4>2 · Complete model</h4>${inputExpr('f1expr','Full expression')}${inputNum('f1ans','Books remaining')}<button id="f1check" class="primary-btn inline-check" type="button">Check</button></div></div>`;
    $('f1firstCheck').onclick=()=>{if(exprMatches($('f1first').value,['8*25','25*8'])){structureOK(key);$('f1fullBox').classList.remove('locked');setFeedback('lessonFeedback','Starting total found. What changes after that?','good');}else{wrong(key);setFeedback('lessonFeedback','Find the starting total from equal shelves first.','bad');}};
    $('f1check').onclick=()=>{const e=exprMatches($('f1expr').value,['8*25-36','25*8-36']),a=exact($('f1ans').value,164);if(e)structureOK(key);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','164 books. Guided problem complete — a parallel version is now available.','good');renderLessonParallel(key,'family-1');}else if(e){wrong(key);setFeedback('lessonFeedback','Your model works. Check 200 − 36.','bad');}else{wrong(key);setFeedback('lessonFeedback','Keep the starting total, then represent the borrowed books.','bad');}};
  }

  function renderFamily2(key){
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}${story('Six boxes contain <strong>20 markers each</strong>. <strong>12 markers are damaged</strong>. The remaining markers are shared equally among <strong>9 tables</strong>.<br><br>How many markers does each table receive?')}<div class="stage-grid three"><div class="stage-box"><h4>1 · Total markers</h4>${inputNum('f2a','Result')}<button id="f2aCheck" class="ghost-btn inline-check" type="button">Check</button></div><div id="f2bBox" class="stage-box locked"><h4>2 · After damaged markers</h4>${inputNum('f2b','Result')}<button id="f2bCheck" class="ghost-btn inline-check" type="button">Check</button></div><div id="f2cBox" class="stage-box locked"><h4>3 · Share among tables</h4>${inputNum('f2c','Markers/table')}<button id="f2cCheck" class="primary-btn inline-check" type="button">Check</button></div></div>`;
    let aok=r.structure_correct,bok=false;
    if(aok)$('f2bBox').classList.remove('locked');
    $('f2aCheck').onclick=()=>{if(exact($('f2a').value,120)){aok=true;structureOK(key);$('f2bBox').classList.remove('locked');setFeedback('lessonFeedback','Total = 120. Keep that correct step.','good');}else{wrong(key);setFeedback('lessonFeedback','Six equal groups of 20 form the total.','bad');}};
    $('f2bCheck').onclick=()=>{if(!aok&&!rec(key).structure_correct)return;if(exact($('f2b').value,108)){bok=true;$('f2cBox').classList.remove('locked');setFeedback('lessonFeedback','108 remain. Now share.','good');}else{wrong(key);setFeedback('lessonFeedback','The total step stays correct. Only recalculate 120 − 12.','bad');}};
    $('f2cCheck').onclick=()=>{if(!bok){setFeedback('lessonFeedback','Complete the earlier story events first.','info');return;}if(exact($('f2c').value,12)){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','12 markers per table. Earlier correct steps stayed locked in.','good');renderLessonParallel(key,'family-2');}else{wrong(key);setFeedback('lessonFeedback','Your route is correct. Only the final division needs a retry.','bad');}};
  }

  function renderLessonParallel(key,id){
    if(!['family-1','family-2'].includes(id)) return;
    const r=rec(key),zone=$('lessonParallel');
    if(!(r.mastered||r.parallel_unlocked)){zone.hidden=true;return;}
    zone.hidden=false;
    if(!r.parallel_active){zone.innerHTML=`<div class="parallel-launch"><p><strong>Parallel transfer check:</strong> new context, same mathematical structure, less support.</p><button id="lpLaunch" class="ghost-btn" type="button">Try Parallel Problem</button></div>`;$('lpLaunch').onclick=()=>{r.parallel_active=true;save();renderLessonParallel(key,id);};return;}
    if(r.parallel_solved){zone.innerHTML='<div class="success-strip">Parallel problem completed. Original mastery remains separate.</div>';return;}
    if(id==='family-1'){
      zone.innerHTML=`<div class="parallel-panel"><h4>Parallel — reduced support</h4>${story('A craft room has <strong>6 trays</strong> with <strong>32 coloured pencils on each tray</strong>. Students use <strong>47 pencils</strong> for a project.<br><br>How many coloured pencils are left?',true)}<div class="field-grid" style="margin-top:10px">${inputExpr('lpExpr')}${inputNum('lpAns','Answer')}</div><button id="lpCheck" class="ghost-btn inline-check" type="button">Check parallel</button><div id="lpFeedback" class="feedback"></div></div>`;
      $('lpCheck').onclick=()=>{const e=exprMatches($('lpExpr').value,['6*32-47','32*6-47']),a=exact($('lpAns').value,145);if(e&&a){r.parallel_solved=true;save();renderLessonParallel(key,id);}else if(e)setFeedback('lpFeedback','The expression works. Check the arithmetic.','bad');else setFeedback('lpFeedback','Build the starting total before subtracting.','bad');};
    }else{
      zone.innerHTML=`<div class="parallel-panel"><h4>Parallel — reduced support</h4>${story('Seven cartons contain <strong>18 juice boxes each</strong>. <strong>14 juice boxes are reserved</strong> for teachers. The rest are shared equally among <strong>8 teams</strong>.<br><br>How many juice boxes does each team receive?',true)}<div class="field-grid" style="margin-top:10px">${inputExpr('lpExpr')}${inputNum('lpAns','Answer')}</div><button id="lpCheck" class="ghost-btn inline-check" type="button">Check parallel</button><div id="lpFeedback" class="feedback"></div></div>`;
      $('lpCheck').onclick=()=>{const e=exprMatches($('lpExpr').value,['(7*18-14)/8','(18*7-14)/8']),a=exact($('lpAns').value,14);if(e&&a){r.parallel_solved=true;save();renderLessonParallel(key,id);}else if(e)setFeedback('lpFeedback','Your route works. Check the remaining arithmetic.','bad');else setFeedback('lpFeedback','Start with the total in all equal groups.','bad');};
    }
  }

  function renderIrrelevantLesson(key){
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}${story('The canteen receives <strong>6 boxes of 24 juice cartons</strong>. There are <strong>18 teachers</strong> at school today. During morning break, <strong>30 juice cartons are sold</strong>.<br><br>How many juice cartons remain?')}<div class="stage-box" style="margin-top:12px"><h4>1 · Click the irrelevant numerical clue</h4><div id="irrClues" class="clue-grid"><button class="clue-btn" data-v="6">6 boxes</button><button class="clue-btn" data-v="24">24 per box</button><button class="clue-btn" data-v="18">18 teachers</button><button class="clue-btn" data-v="30">30 sold</button></div><div id="irrConstruct" class="evidence-box hidden"><p><strong>No more option cycling.</strong> Type the two numbers that create the starting carton total.</p><div class="field-grid">${inputNum('irrStartA','Number of boxes')}${inputNum('irrStartB','Cartons per box')}</div><button id="irrNumberCheck" class="ghost-btn inline-check" type="button">Check evidence</button></div></div><div id="irrSolve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><div class="field-grid">${inputExpr('irrExpr')}${inputNum('irrAns','Cartons remaining')}</div><button id="irrCheck" class="primary-btn inline-check" type="button">Check</button></div>`;
    function unlock(){structureOK(key);$('irrSolve').classList.remove('locked');$$('.clue-btn',$('irrClues')).forEach(b=>b.disabled=true);setFeedback('lessonFeedback','18 teachers is irrelevant to the juice-carton count. Now build the math.','good');}
    $$('.clue-btn',$('irrClues')).forEach(b=>b.onclick=()=>{if(b.dataset.v==='18'){b.classList.add('correct');unlock();}else{b.classList.add('wrong');const wc=wrong(key);setTimeout(()=>b.classList.remove('wrong'),450);setFeedback('lessonFeedback','Would changing this number change the number of juice cartons?','bad');if(wc>=2){$$('.clue-btn',$('irrClues')).forEach(x=>x.disabled=true);$('irrConstruct').classList.remove('hidden');setFeedback('lessonFeedback','No more cycling through choices. Type the irrelevant number instead.','info');}}});
    $('irrNumberCheck').onclick=()=>{const a=Number($('irrStartA').value),b=Number($('irrStartB').value);if((a===6&&b===24)||(a===24&&b===6)){unlock();setFeedback('lessonFeedback','6 and 24 create the starting carton total. The 18-teacher clue is irrelevant.','good');}else{wrong(key);setFeedback('lessonFeedback','The starting total comes from the number of boxes and cartons in each box.','bad');}};
    $('irrCheck').onclick=()=>{const e=exprMatches($('irrExpr').value,['6*24-30','24*6-30']),a=exact($('irrAns').value,114);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','114 cartons remain. You filtered the story before calculating.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','The model works. Recalculate 144 − 30.','bad');}else{wrong(key);setFeedback('lessonFeedback','Use only the facts that change the carton count.','bad');}};
  }

  function renderSameNumbersLesson(key){
    $('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}<div class="same-number-header"><span class="number-chip">8</span><span class="number-chip">24</span><span class="number-chip">6</span></div><div class="story-pair"><article><h4>Story A</h4>${story('Eight boxes contain <strong>24 snacks each</strong>. All the snacks are shared equally among <strong>6 tables</strong>.',true)}<label class="field-label" style="margin-top:10px"><span>Choose the expression</span><select id="snAExpr" class="mini-select"><option value="">Choose</option><option value="(8*24)/6">(8 × 24) ÷ 6</option><option value="6*24-8">6 × 24 − 8</option></select></label>${inputNum('snAAns','Answer')}</article><article><h4>Story B</h4>${story('Six boxes contain <strong>24 snacks each</strong>. During the event, <strong>8 snacks are eaten</strong>.',true)}<label class="field-label" style="margin-top:10px"><span>Choose the expression</span><select id="snBExpr" class="mini-select"><option value="">Choose</option><option value="(8*24)/6">(8 × 24) ÷ 6</option><option value="6*24-8">6 × 24 − 8</option></select></label>${inputNum('snBAns','Answer')}</article></div><button id="snCheck" class="primary-btn inline-check" type="button">Check both stories</button>`;
    $('snCheck').onclick=()=>{const ea=$('snAExpr').value==='(8*24)/6',eb=$('snBExpr').value==='6*24-8',aa=exact($('snAAns').value,32),ab=exact($('snBAns').value,136);if(ea&&eb)structureOK(key);if(ea&&eb&&aa&&ab){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','Same numbers. Different story. Different math.','good');}else if(ea&&eb){wrong(key);setFeedback('lessonFeedback','Both models work. Check one or both calculations.','bad');}else{wrong(key);setFeedback('lessonFeedback','Do not match by numbers only. Read what happens to the snacks.','bad');}};
  }

  function renderBuilderLesson(key,n){
    const cfg=n===1?{story:'Four crates contain <strong>27 bottles each</strong>. Then <strong>16 bottles are sold</strong>.<br><br>Build the expression.',tokens:['4','27','16','×','−','+','÷'],accept:['4*27-16','27*4-16'],answer:92}:{story:'Five packs contain <strong>18 markers each</strong>. <strong>10 markers are lost</strong>. The rest are shared equally among <strong>4 groups</strong>.<br><br>Build the expression.',tokens:['5','18','10','4','×','−','÷','+','(',')'],accept:['(5*18-10)/4','(18*5-10)/4'],answer:20};
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}${story(cfg.story)}<div class="stage-box" style="margin-top:12px"><h4>Expression Builder</h4><div id="ebPool" class="builder-pool"></div><div id="ebOut" class="builder-output empty"></div><div class="builder-controls"><button id="ebClear" class="ghost-btn" type="button">Clear</button><button id="ebBuildCheck" class="ghost-btn" type="button">Check expression</button></div></div><div id="ebSolve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px">${inputNum('ebAns','Final answer')}<button id="ebCheck" class="primary-btn inline-check" type="button">Check answer</button></div>`;
    setupExpressionBuilder({poolId:'ebPool',outId:'ebOut',checkId:'ebBuildCheck',tokens:cfg.tokens,accepted:cfg.accept,key,onCorrect:()=>{$('ebSolve').classList.remove('locked');}});
    $('ebClear').onclick=()=>{renderLesson();};
    $('ebCheck').onclick=()=>{if(!rec(key).structure_correct){setFeedback('lessonFeedback','Build the expression first.','info');return;}if(exact($('ebAns').value,cfg.answer)){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','Expression and calculation both work.','good');}else{wrong(key);setFeedback('lessonFeedback','The expression works. Keep it and check the arithmetic.','bad');}};
  }

  function renderErrorLesson(key,n){
    const cfg=n===1?{story:'Five baskets contain <strong>18 apples each</strong>. Then <strong>20 apples are sold</strong>.',bad:'5 + 18 − 20',wrongOp:'+',replacement:'×',accept:['5*18-20','18*5-20'],answer:70,why:'18 apples is repeated in each of 5 baskets.'}:{story:'<strong>72 stickers</strong> are shared equally among <strong>8 students</strong>. Then each student receives <strong>3 extra stickers</strong>.',bad:'72 − 8 + 3',wrongOp:'-',replacement:'÷',accept:['72/8+3'],answer:12,why:'72 stickers are split into 8 equal groups first.'};
    const r=rec(key);$('lessonContent').innerHTML=`${renderSubtaskPills()}${routine()}${story(cfg.story)}<div class="stage-box" style="margin-top:12px"><h4>A student writes:</h4><div class="question-focus"><div class="equation-display">${cfg.bad}</div></div><p class="center muted">Which operator causes the modelling error?</p>${choiceGrid('errOp',[{value:'+',label:'+'},{value:'-',label:'−'},{value:'*',label:'×'},{value:'/',label:'÷'}],'four')}<div id="errRepair" class="evidence-box ${r.structure_correct?'':'hidden'}"><p><strong>Repair the full expression.</strong></p>${inputExpr('errExpr')}${inputNum('errAns','Final answer')}<button id="errCheck" class="primary-btn inline-check" type="button">Check repair</button></div></div>`;
    $$('.choice-btn',$('errOp')).forEach(b=>b.onclick=()=>{if(b.dataset.value===cfg.wrongOp){structureOK(key);$$('.choice-btn',$('errOp')).forEach(x=>{x.disabled=true;x.classList.toggle('correct',x===b);});$('errRepair').classList.remove('hidden');setFeedback('lessonFeedback',`${cfg.why} Replace ${cfg.wrongOp} with ${cfg.replacement}.`,'good');}else{wrong(key);setFeedback('lessonFeedback','Find the first place where the story and the written operation disagree.','bad');}});
    $('errCheck').onclick=()=>{const e=exprMatches($('errExpr').value,cfg.accept),a=exact($('errAns').value,cfg.answer);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','Logic break repaired and calculation checked.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','The repaired model works. Check the arithmetic.','bad');}else{wrong(key);setFeedback('lessonFeedback',cfg.why,'bad');}};
  }

  function renderTKALesson(key,id){
    const root=$('lessonContent'),r=rec(key);
    if(id==='tka-l1'){
      root.innerHTML=`${renderSubtaskPills()}${routine()}${story('Perpustakaan sekolah akan membagikan buku latihan kepada tiga kelas. Kelas A terdiri atas <strong>27 siswa</strong>, Kelas B <strong>33 siswa</strong>, dan Kelas C <strong>30 siswa</strong>. Setiap siswa menerima <strong>4 buku</strong>. Satu kardus berisi <strong>30 buku</strong>.<br><br><strong>Berapa kardus buku yang diperlukan?</strong>')}<div class="stage-box" style="margin-top:12px"><h4>Urutkan rute</h4><div id="tl1Pool" class="order-pool"></div><div id="tl1Out" class="order-output empty"></div><button id="tl1Route" class="ghost-btn inline-check" type="button">Periksa rute</button></div><div id="tl1Solve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><div class="field-grid">${inputExpr('tl1Expr','Ekspresi')}${inputNum('tl1Ans','Jawaban','kardus')}</div><button id="tl1Check" class="primary-btn inline-check">Periksa</button></div>`;
      setupOrderBuilder({poolId:'tl1Pool',outId:'tl1Out',checkId:'tl1Route',key,items:[{value:'boxes',label:'÷ 30 buku/kardus'},{value:'students',label:'27 + 33 + 30'},{value:'books',label:'× 4 buku/siswa'}],correct:['students','books','boxes'],wrongMsg:'Kuantitas apa yang harus diketahui sebelum jumlah buku dapat dicari?',onCorrect:()=>{$('tl1Solve').classList.remove('locked');}});
      $('tl1Check').onclick=()=>{const e=exprMatches($('tl1Expr').value,['((27+33+30)*4)/30','(27+33+30)*4/30']),a=exact($('tl1Ans').value,12);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','12 kardus. Rute multistep lengkap.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','Modelnya sudah benar. Periksa hitungannya.','bad');}else{wrong(key);setFeedback('lessonFeedback','Urutkan jumlah siswa → jumlah buku → kardus.','bad');}};
    } else if(id==='tka-l2'){
      root.innerHTML=`${renderSubtaskPills()}${routine()}${story('Untuk sebuah kegiatan sekolah tersedia <strong>8 kardus</strong>, masing-masing berisi <strong>24 botol air</strong>. Acara tersebut didampingi oleh <strong>5 guru</strong>. Sebanyak <strong>36 botol</strong> diletakkan di meja guru. Sisa botol air dibagikan sama banyak ke <strong>6 pos siswa</strong>.<br><br><strong>Berapa botol air yang diterima setiap pos siswa?</strong>')}<div class="stage-box" style="margin-top:12px"><h4>Tandai setiap angka: diperlukan atau tidak?</h4><div id="relGrid" class="relevance-grid"></div><button id="relCheck" class="ghost-btn inline-check">Periksa informasi</button></div><div id="relSolve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><div class="field-grid">${inputExpr('relExpr','Ekspresi')}${inputNum('relAns','Jawaban','botol/pos')}</div><button id="relSolveCheck" class="primary-btn inline-check">Periksa</button></div>`;
      const facts=[['8','need'],['24','need'],['5','no'],['36','need'],['6','need']]; const choices={};
      $('relGrid').innerHTML=facts.map(([n])=>`<div class="relevance-row" data-n="${n}"><b>${n}</b><button data-v="need">Diperlukan</button><button data-v="no">Tidak perlu</button></div>`).join('');
      $$('.relevance-row').forEach(row=>$$('button',row).forEach(b=>b.onclick=()=>{$$('button',row).forEach(x=>x.classList.toggle('selected',x===b));choices[row.dataset.n]=b.dataset.v;}));
      $('relCheck').onclick=()=>{const ok=facts.every(([n,v])=>choices[n]===v);if(ok){structureOK(key);$$('.relevance-row').forEach(row=>row.classList.add('correct'));$('relSolve').classList.remove('locked');setFeedback('lessonFeedback','5 guru tidak diperlukan karena 36 botol untuk meja guru sudah diberikan langsung.','good');}else{wrong(key);$$('.relevance-row').forEach(row=>{const f=facts.find(([n])=>n===row.dataset.n);if(choices[row.dataset.n]&&choices[row.dataset.n]!==f[1])row.classList.add('wrong');});setFeedback('lessonFeedback','Jika jumlah guru berubah, apakah jumlah botol yang ditempatkan di meja guru berubah? Teks sudah memberi 36 botol.','bad');}};
      $('relSolveCheck').onclick=()=>{const e=exprMatches($('relExpr').value,['(8*24-36)/6','(24*8-36)/6']),a=exact($('relAns').value,26);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','26 botol per pos. Informasi sudah difilter dengan benar.','good');}else if(e){wrong(key);setFeedback('lessonFeedback','Modelnya benar. Periksa hitungannya.','bad');}else{wrong(key);setFeedback('lessonFeedback','Gunakan hanya 8, 24, 36, dan 6.','bad');}};
    } else if(id==='tka-l3'){
      root.innerHTML=`${renderSubtaskPills()}${routine()}${story('Sebuah klub memiliki <strong>7 paket kartu</strong>, setiap paket berisi <strong>28 kartu</strong>. Sebanyak <strong>28 kartu</strong> disimpan sebagai cadangan. Sisa kartu dibagikan sama rata kepada <strong>8 kelompok</strong>.<br><br><strong>Berapa kartu yang diterima setiap kelompok?</strong>')}<div class="stage-box" style="margin-top:12px"><h4>Bangun rute sebelum opsi jawaban terbuka</h4><div id="tl3Pool" class="order-pool"></div><div id="tl3Out" class="order-output empty"></div><button id="tl3Route" class="ghost-btn inline-check">Periksa rute</button></div><div id="tl3MCQ" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><h4>Pilih jawaban</h4>${choiceGrid('tl3Choices',[{value:'14',label:'14'},{value:'18',label:'18'},{value:'21',label:'21'},{value:'24',label:'24'}],'four')}<div id="tl3Construct" class="evidence-box hidden">${inputNum('tl3Direct','Hitung langsung')}<button id="tl3DirectCheck" class="ghost-btn inline-check">Periksa hasil</button></div></div>`;
      setupOrderBuilder({poolId:'tl3Pool',outId:'tl3Out',checkId:'tl3Route',key,items:[{value:'sub',label:'− 28'},{value:'div',label:'÷ 8'},{value:'mul',label:'7 × 28'}],correct:['mul','sub','div'],wrongMsg:'Cari jumlah seluruh kartu terlebih dahulu.',onCorrect:()=>{$('tl3MCQ').classList.remove('locked');}});
      $$('.choice-btn',$('tl3Choices')).forEach(b=>b.onclick=()=>{if(b.dataset.value==='21'){mastered(key);$('lessonNext').disabled=false;$$('.choice-btn',$('tl3Choices')).forEach(x=>{x.disabled=true;x.classList.toggle('correct',x===b);});setFeedback('lessonFeedback','21 kartu per kelompok. Opsi baru terbuka setelah rute dibangun.','good');}else{const wc=wrong(key);b.classList.add('wrong');if(wc>=2){$$('.choice-btn',$('tl3Choices')).forEach(x=>x.disabled=true);$('tl3Construct').classList.remove('hidden');setFeedback('lessonFeedback','Jangan lanjut menebak opsi. Hitung hasilnya langsung dari rute yang sudah benar.','info');}else setFeedback('lessonFeedback','Rute sudah ada. Hitung 196 − 28, lalu bagi 8.','bad');}});
      $('tl3DirectCheck').onclick=()=>{if(exact($('tl3Direct').value,21)){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','21 kartu per kelompok.','good');}else{wrong(key);setFeedback('lessonFeedback','Hitung 196 − 28, lalu bagi 8.','bad');}};
    } else if(id==='tka-h1'){
      root.innerHTML=`${renderSubtaskPills()}${story('Enam keranjang berisi <strong>15 bola</strong> pada setiap keranjang. <strong>18 bola</strong> digunakan untuk latihan. Sisa bola dibagikan sama banyak ke <strong>6 kelompok</strong>.<br><br>Berapa bola yang diterima setiap kelompok?')}<div class="stage-box" style="margin-top:12px"><div class="field-grid">${inputExpr('h1Expr','Rute / ekspresi')}${inputNum('h1Ans','Jawaban')}</div><button id="h1Check" class="primary-btn inline-check">Periksa</button></div>`;
      $('h1Check').onclick=()=>{const e=exprMatches($('h1Expr').value,['(6*15-18)/6','(15*6-18)/6']),a=exact($('h1Ans').value,12);if(e&&a){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','12 bola per kelompok.','good');}else if(e){structureOK(key);wrong(key);setFeedback('lessonFeedback','Rutenya benar. Periksa hitungannya.','bad');}else{wrong(key);setFeedback('lessonFeedback','Cari jumlah awal semua bola terlebih dahulu.','bad');}};
    } else if(id==='tka-h2'){
      root.innerHTML=`${renderSubtaskPills()}${story('Lima kardus berisi <strong>36 buku tulis</strong> per kardus. Sebanyak <strong>24 buku tulis</strong> dibagikan kepada guru. Sisanya dibagi sama rata ke <strong>6 rak</strong>.<br><br>Berapa buku tulis yang diletakkan pada setiap rak?')}<div class="stage-box" style="margin-top:12px"><h4>Tulis dua bagian rute sebelum opsi terbuka</h4><div class="field-grid">${inputExpr('h2a','Bagian 1')}${inputExpr('h2b','Bagian 2')}</div><button id="h2Route" class="ghost-btn inline-check">Periksa rute</button></div><div id="h2ChoicesBox" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px">${choiceGrid('h2Choices',[{value:'24',label:'A. 24'},{value:'25',label:'B. 25'},{value:'26',label:'C. 26'},{value:'27',label:'D. 27'}],'four')}<div id="h2Construct" class="evidence-box hidden">${inputNum('h2Direct','Hitung langsung')}<button id="h2DirectCheck" class="ghost-btn inline-check">Periksa hasil</button></div></div>`;
      $('h2Route').onclick=()=>{if(exprMatches($('h2a').value,['5*36','36*5'])&&exprMatches($('h2b').value,['-24','180-24'])){structureOK(key);$('h2ChoicesBox').classList.remove('locked');setFeedback('lessonFeedback','Rute awal benar. Sekarang selesaikan pembagian ke 6 rak.','good');}else{wrong(key);setFeedback('lessonFeedback','Bangun jumlah awal, lalu kurangi 24 sebelum membagi.','bad');}};
      $$('.choice-btn',$('h2Choices')).forEach(b=>b.onclick=()=>{if(b.dataset.value==='26'){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','C. 26.','good');}else{const wc=wrong(key);if(wc>=2){$$('.choice-btn',$('h2Choices')).forEach(x=>x.disabled=true);$('h2Construct').classList.remove('hidden');setFeedback('lessonFeedback','Jangan lanjut menebak opsi. Hitung 156 ÷ 6 secara langsung.','info');}else setFeedback('lessonFeedback','156 buku tersisa sebelum dibagi ke 6 rak.','bad');}});
      $('h2DirectCheck').onclick=()=>{if(exact($('h2Direct').value,26)){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','26 buku tulis per rak.','good');}else{wrong(key);setFeedback('lessonFeedback','156 buku dibagi rata ke 6 rak.','bad');}};
    } else if(id==='tka-h3') renderTFTask({root,key,lesson:true,context:'Enam kotak berisi <strong>20 minuman</strong> pada setiap kotak. Sebanyak <strong>18 minuman</strong> disimpan untuk panitia. Sisanya dibagikan sama rata kepada <strong>6 kelas</strong>.',statements:[['Jumlah minuman mula-mula adalah 120.','T'],['Setelah 18 minuman disimpan, tersisa 108 minuman.','F'],['Setiap kelas menerima 17 minuman.','T']],evidenceLabel:'Tulis banyak minuman yang tersisa setelah 18 disimpan.',evidence:102});
    else if(id==='tka-h4'){
      root.innerHTML=`${renderSubtaskPills()}${story('Empat kardus berisi <strong>30 botol</strong> per kardus. Sebanyak <strong>24 botol</strong> digunakan. Sisa botol dibagi rata ke <strong>8 rak</strong>.<br><br>Pilih semua ekspresi yang benar untuk mencari banyak botol per rak.')}<div id="mcma" class="mcma-grid"><button class="mcma-option" data-v="A">A. (4 × 30 − 24) ÷ 8</button><button class="mcma-option" data-v="B">B. 4 × 30 − (24 ÷ 8)</button><button class="mcma-option" data-v="C">C. (120 − 24) ÷ 8</button><button class="mcma-option" data-v="D">D. 4 × (30 − 24) ÷ 8</button></div><div class="evidence-box">${inputNum('mcmaAns','Nilai akhir')}<button id="mcmaCheck" class="primary-btn inline-check">Periksa pilihan + nilai</button></div>`;
      const selected=new Set();$$('.mcma-option',$('mcma')).forEach(b=>b.onclick=()=>{selected.has(b.dataset.v)?selected.delete(b.dataset.v):selected.add(b.dataset.v);b.classList.toggle('selected',selected.has(b.dataset.v));});
      $('mcmaCheck').onclick=()=>{const s=allSelected(selected,['A','C']),a=exact($('mcmaAns').value,12);if(s)structureOK(key);if(s&&a){mastered(key);$('lessonNext').disabled=false;$$('.mcma-option',$('mcma')).forEach(b=>b.classList.toggle('correct',['A','C'].includes(b.dataset.v)));setFeedback('lessonFeedback','A dan C benar; nilai akhirnya 12.','good');}else if(s){wrong(key);setFeedback('lessonFeedback','Pilihan ekspresinya benar. Periksa nilai akhirnya.','bad');}else{wrong(key);setFeedback('lessonFeedback','24 harus dikurangi dari jumlah seluruh botol sebelum membagi ke 8 rak.','bad');}};
    } else if(id==='tka-h5'){
      root.innerHTML=`${renderSubtaskPills()}${story('Tiga kelas terdiri atas <strong>24</strong>, <strong>30</strong>, dan <strong>36 siswa</strong>. Setiap siswa mendapat <strong>2 lembar latihan</strong>. Satu map dapat memuat <strong>15 lembar</strong>.<br><br>Bangun satu ekspresi untuk mencari banyak map yang diperlukan.')}<div class="stage-box" style="margin-top:12px"><div id="h5Pool" class="builder-pool"></div><div id="h5Out" class="builder-output empty"></div><button id="h5Build" class="ghost-btn inline-check">Periksa ekspresi</button></div><div id="h5Solve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px">${inputNum('h5Ans','Jumlah map')}<button id="h5Check" class="primary-btn inline-check">Periksa</button></div>`;
      setupExpressionBuilder({poolId:'h5Pool',outId:'h5Out',checkId:'h5Build',tokens:['(','24','+','30','+','36',')','×','2','÷','15','−'],accepted:['((24+30+36)*2)/15','(24+30+36)*2/15'],key,onCorrect:()=>{$('h5Solve').classList.remove('locked');}});
      $('h5Check').onclick=()=>{if(!rec(key).structure_correct){setFeedback('lessonFeedback','Bangun ekspresinya terlebih dahulu.','info');return;}if(exact($('h5Ans').value,12)){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','12 map.','good');}else{wrong(key);setFeedback('lessonFeedback','Model sudah benar. Hitung 90 × 2, lalu bagi 15.','bad');}};
    } else if(id==='tka-h6'){
      root.innerHTML=`${renderSubtaskPills()}${story('Lima kotak berisi <strong>28 snack</strong> per kotak. <strong>20 snack</strong> diberikan kepada tamu. Sisanya dimasukkan sama rata ke <strong>10 keranjang</strong>.')}<div class="stage-box" style="margin-top:12px"><div id="h6Pool" class="order-pool"></div><div id="h6Out" class="order-output empty"></div><button id="h6Route" class="ghost-btn inline-check">Periksa urutan</button></div><div id="h6Solve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px">${inputNum('h6Ans','Snack per keranjang')}<button id="h6Check" class="primary-btn inline-check">Periksa</button></div>`;
      setupOrderBuilder({poolId:'h6Pool',outId:'h6Out',checkId:'h6Route',key,items:[{value:'div',label:'÷ 10'},{value:'mul',label:'5 × 28'},{value:'sub',label:'− 20'}],correct:['mul','sub','div'],wrongMsg:'Operasi pertama harus membentuk jumlah semua snack.',onCorrect:()=>{$('h6Solve').classList.remove('locked');}});
      $('h6Check').onclick=()=>{if(!rec(key).structure_correct){setFeedback('lessonFeedback','Urutkan langkahnya terlebih dahulu.','info');return;}if(exact($('h6Ans').value,12)){mastered(key);$('lessonNext').disabled=false;setFeedback('lessonFeedback','12 snack per keranjang.','good');}else{wrong(key);setFeedback('lessonFeedback','Rutenya benar. Hitung 140 − 20, lalu bagi 10.','bad');}};
    }
  }

  function renderTFTask({root,key,lesson=false,context,statements,evidenceLabel,evidence,practice=false}){
    const prefix=lesson?'lesson':'practice';
    root.innerHTML=`${lesson?renderSubtaskPills():''}${story(context)}<table class="tf-table" style="margin-top:12px"><thead><tr><th>Pernyataan</th><th>Benar / Salah</th></tr></thead><tbody>${statements.map((s,i)=>`<tr><td>${s[0]}</td><td><div class="tf-choice" data-row="${i}"><button type="button" data-v="T">Benar</button><button type="button" data-v="F">Salah</button></div></td></tr>`).join('')}</tbody></table><div class="evidence-box">${inputNum(`${prefix}TfEvidence`,evidenceLabel)}<button id="${prefix}TfCheck" class="primary-btn inline-check">Periksa semua</button></div>`;
    const selected={};$$('.tf-choice',root).forEach(row=>$$('button',row).forEach(b=>b.onclick=()=>{$$('button',row).forEach(x=>x.classList.toggle('selected',x===b));selected[row.dataset.row]=b.dataset.v;}));
    $(`${prefix}TfCheck`).onclick=()=>{const all=statements.every((_,i)=>selected[i]!==undefined);if(!all){setFeedback(`${prefix}Feedback`,'Jawab semua pernyataan sebelum memeriksa.','info');return;}const matrix=statements.every((s,i)=>selected[i]===s[1]),ev=exact($(`${prefix}TfEvidence`).value,evidence);if(matrix)structureOK(key);if(matrix&&ev){mastered(key);$(lesson?'lessonNext':'practiceNext').disabled=false;setFeedback(`${prefix}Feedback`,'Semua pernyataan dan bukti hitung benar.','good');if(practice)renderPracticeParallel(key,state.practiceIndex);}else{wrong(key);setFeedback(`${prefix}Feedback`,rec(key).wrong_count>1?'Mulai dari jumlah awal, lalu ikuti urutan cerita.':'Periksa kembali total awal atau pengurangannya.','bad');}};
  }

  // ---------- PRACTICE ----------
  const practiceLabels=['Expression only','Expression → solve','Irrelevant clue','Same numbers','Error Lab','Cambridge story','TKA three-step','TKA True/False'];
  const practiceHints=[
    ['What is the total before 18 are saved?','Build 9 × 14 first, then remove 18.'],
    ['Work inside the brackets first.','7 × 18 = 126.'],
    ['Which number would not change the number of books?','The opening time does not affect the book count.'],
    ['Describe what happens in Story A before looking at the numbers.','Story A begins with equal groups; Story B begins with sharing.'],
    ['15 markers appears in every pack.','Eight equal groups of 15 means multiplication.'],
    ['Find how many sandwiches existed before the break.','7 × 18, then subtract 39.'],
    ['Cari jumlah seluruh buku sebelum ada yang disimpan.','6 × 25 → kurangi 30 → bagi 8.'],
    ['Periksa pernyataan sesuai urutan cerita.','Mulai dengan 9 × 16.']
  ];

  function renderPracticeNav(){
    const nav=$('practiceNavigator');nav.innerHTML=practiceLabels.map((l,i)=>{const r=rec(`practice:${i}`);return `<button type="button" class="challenge-dot ${i===state.practiceIndex?'active':''} ${r.mastered?'done':r.passed_by_teacher?'passed':''}" data-i="${i}" title="${esc(l)}">${i+1}</button>`;}).join('');
    $$('.challenge-dot',nav).forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i);if(i===state.practiceIndex)return;pushHistory();state.practiceIndex=i;save();renderPractice();});
  }

  function renderPractice(){
    renderPracticeNav(); const i=state.practiceIndex,key=`practice:${i}`;
    $('practiceTag').textContent=`INDEPENDENT ${i+1} · ${practiceLabels[i].toUpperCase()}`;$('practiceCounter').textContent=`${i+1} / 8`;$('practiceNext').disabled=true;setFeedback('practiceFeedback');$('practiceParallel').hidden=true;$('practiceParallel').innerHTML='';
    if(i===0) practice1(key); else if(i===1) practice2(key); else if(i===2) practice3(key); else if(i===3) practice4(key); else if(i===4) practice5(key); else if(i===5) practice6(key); else if(i===6) practice7(key); else practice8(key);
    $('practiceHint').onclick=()=>hintFor(key,'practiceFeedback',practiceHints[i]); $('practiceNext').onclick=nextPractice;statusRestore(key,'practiceNext','practiceFeedback');renderPracticeParallel(key,i);
  }

  function practice1(key){
    $('practiceContent').innerHTML=`${story('Nine trays hold <strong>14 cupcakes each</strong>. <strong>18 cupcakes</strong> are saved for the teachers.<br><br><strong>Do not solve.</strong> Write an expression for the number of cupcakes left for students.')}<div class="stage-box" style="margin-top:12px">${inputExpr('p1Expr','Expression only')}<button id="p1Check" class="primary-btn inline-check">Check expression</button></div>`;
    $('p1Check').onclick=()=>{if(exprMatches($('p1Expr').value,['9*14-18','14*9-18'])){mastered(key,{structure:true,calculation:false});$('practiceNext').disabled=false;setFeedback('practiceFeedback','Expression correct. No calculation required.','good');renderPracticeParallel(key,0);}else{wrong(key);setFeedback('practiceFeedback',rec(key).wrong_count>1?'First chunk: 9 × 14.':'What total exists before 18 are saved?','bad');}};
  }
  function practice2(key){
    $('practiceContent').innerHTML=`<div class="question-focus"><p>Calculate</p><div class="big-math">(7 × 18 − 14) ÷ 8</div><div class="answer-line"><input id="p2Ans" class="answer-input" inputmode="numeric"></div><button id="p2Check" class="primary-btn inline-check">Check</button></div>`;
    $('p2Check').onclick=()=>{if(exact($('p2Ans').value,14)){mastered(key,{structure:false,calculation:true});$('practiceNext').disabled=false;setFeedback('practiceFeedback','14.','good');renderPracticeParallel(key,1);}else{wrong(key);setFeedback('practiceFeedback',rec(key).wrong_count>1?'7 × 18 = 126.':'Check the bracketed part first.','bad');}};
  }
  function practice3(key){
    const r=rec(key);$('practiceContent').innerHTML=`${story('A book fair receives <strong>6 boxes of 32 books</strong>. The fair is open for <strong>4 hours</strong>. During the first session, <strong>48 books are sold</strong>.<br><br>How many books remain?')}<div class="stage-box" style="margin-top:12px"><h4>Mark the irrelevant clue</h4><div id="p3Clues" class="clue-grid"><button class="clue-btn" data-v="6">6 boxes</button><button class="clue-btn" data-v="32">32 books/box</button><button class="clue-btn" data-v="4">4 hours</button><button class="clue-btn" data-v="48">48 sold</button></div><div id="p3Construct" class="evidence-box hidden"><p><strong>No more option cycling.</strong> Type the two numbers that create the starting book total.</p><div class="field-grid">${inputNum('p3StartA','Number of boxes')}${inputNum('p3StartB','Books per box')}</div><button id="p3ConstructCheck" class="ghost-btn inline-check">Check evidence</button></div></div><div id="p3Solve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><div class="field-grid">${inputExpr('p3Expr')}${inputNum('p3Ans','Books remaining')}</div><button id="p3Check" class="primary-btn inline-check">Check</button></div>`;
    function p3Unlock(msg='4 hours does not change the book count.'){structureOK(key);$$('.clue-btn',$('p3Clues')).forEach(x=>x.disabled=true);$('p3Solve').classList.remove('locked');setFeedback('practiceFeedback',msg,'good');}
    $$('.clue-btn',$('p3Clues')).forEach(b=>b.onclick=()=>{if(b.dataset.v==='4'){b.classList.add('correct');p3Unlock();}else{const wc=wrong(key);b.classList.add('wrong');setTimeout(()=>b.classList.remove('wrong'),400);if(wc>=2){$$('.clue-btn',$('p3Clues')).forEach(x=>x.disabled=true);$('p3Construct').classList.remove('hidden');setFeedback('practiceFeedback','No more cycling through clues. Show which two numbers make the starting total.','info');}else setFeedback('practiceFeedback','If this number changed, would the answer change?','bad');}});
    $('p3ConstructCheck').onclick=()=>{const a=Number($('p3StartA').value),b=Number($('p3StartB').value);if((a===6&&b===32)||(a===32&&b===6))p3Unlock('6 and 32 create the starting total. The 4-hour clue is irrelevant.');else{wrong(key);setFeedback('practiceFeedback','The starting total comes from equal boxes and books per box.','bad');}};
    $('p3Check').onclick=()=>{const e=exprMatches($('p3Expr').value,['6*32-48','32*6-48']),a=exact($('p3Ans').value,144);if(e&&a){mastered(key);$('practiceNext').disabled=false;setFeedback('practiceFeedback','144 books remain.','good');renderPracticeParallel(key,2);}else if(e){wrong(key);setFeedback('practiceFeedback','Your model works. Check 192 − 48.','bad');}else{wrong(key);setFeedback('practiceFeedback','Use only the facts that change the book count.','bad');}};
  }
  function practice4(key){
    $('practiceContent').innerHTML=`<div class="same-number-header"><span class="number-chip">5</span><span class="number-chip">24</span><span class="number-chip">6</span></div><div class="story-pair"><article><h4>Story A</h4>${story('Five boxes contain <strong>24 cards each</strong>. The cards are shared equally among <strong>6 teams</strong>.',true)}<label class="field-label"><span>Expression</span><select id="p4eA" class="mini-select"><option value="">Choose</option><option value="(5*24)/6">(5 × 24) ÷ 6</option><option value="24/6+5">24 ÷ 6 + 5</option></select></label>${inputNum('p4aA','Answer')}</article><article><h4>Story B</h4>${story('<strong>24 cards</strong> are shared equally among <strong>6 students</strong>. Then each student gets <strong>5 extra cards</strong>.',true)}<label class="field-label"><span>Expression</span><select id="p4eB" class="mini-select"><option value="">Choose</option><option value="(5*24)/6">(5 × 24) ÷ 6</option><option value="24/6+5">24 ÷ 6 + 5</option></select></label>${inputNum('p4aB','Answer')}</article></div><button id="p4Check" class="primary-btn inline-check">Check both</button>`;
    $('p4Check').onclick=()=>{const e=$('p4eA').value==='(5*24)/6'&&$('p4eB').value==='24/6+5',a=exact($('p4aA').value,20)&&exact($('p4aB').value,9);if(e)structureOK(key);if(e&&a){mastered(key);$('practiceNext').disabled=false;setFeedback('practiceFeedback','20 vs 9. Same numbers, different story.','good');renderPracticeParallel(key,3);}else if(e){wrong(key);setFeedback('practiceFeedback','Both models work. Check the calculations.','bad');}else{wrong(key);setFeedback('practiceFeedback','The same numbers can represent different actions.','bad');}};
  }
  function practice5(key){
    const r=rec(key);$('practiceContent').innerHTML=`${story('Eight packs contain <strong>15 markers each</strong>. <strong>24 markers</strong> are used.')}<div class="stage-box" style="margin-top:12px"><h4>A student writes</h4><div class="question-focus"><div class="equation-display">8 + 15 − 24</div></div><p class="center">Find the modelling error.</p>${choiceGrid('p5Op',[{value:'+',label:'+'},{value:'-',label:'−'},{value:'*',label:'×'},{value:'/',label:'÷'}],'four')}<div id="p5Repair" class="evidence-box ${r.structure_correct?'':'hidden'}">${inputExpr('p5Expr','Repaired expression')}${inputNum('p5Ans','Answer')}<button id="p5Check" class="primary-btn inline-check">Check repair</button></div></div>`;
    $$('.choice-btn',$('p5Op')).forEach(b=>b.onclick=()=>{if(b.dataset.value==='+'){structureOK(key);$('p5Repair').classList.remove('hidden');setFeedback('practiceFeedback','15 repeats in every pack, so the first operation should be multiplication.','good');}else{wrong(key);setFeedback('practiceFeedback','Which operator fails to represent eight equal groups of 15?','bad');}});
    $('p5Check').onclick=()=>{const e=exprMatches($('p5Expr').value,['8*15-24','15*8-24']),a=exact($('p5Ans').value,96);if(e&&a){mastered(key);$('practiceNext').disabled=false;setFeedback('practiceFeedback','Model repaired: 96 markers remain.','good');renderPracticeParallel(key,4);}else if(e){wrong(key);setFeedback('practiceFeedback','The repaired model works. Check the arithmetic.','bad');}else{wrong(key);setFeedback('practiceFeedback','Eight equal groups of 15 means multiplication.','bad');}};
  }
  function practice6(key){
    $('practiceContent').innerHTML=`${story('The school canteen prepares <strong>7 trays with 18 sandwiches on each tray</strong>. During the first break, <strong>39 sandwiches are sold</strong>.<br><br>How many sandwiches remain?')}<div class="stage-box" style="margin-top:12px"><div class="field-grid">${inputExpr('p6Expr')}${inputNum('p6Ans','Sandwiches remaining')}</div><button id="p6Check" class="primary-btn inline-check">Check</button></div>`;
    $('p6Check').onclick=()=>{const e=exprMatches($('p6Expr').value,['7*18-39','18*7-39']),a=exact($('p6Ans').value,87);if(e)structureOK(key);if(e&&a){mastered(key);$('practiceNext').disabled=false;setFeedback('practiceFeedback','87 sandwiches remain.','good');renderPracticeParallel(key,5);}else if(e){wrong(key);setFeedback('practiceFeedback','Your model works. Keep it — only arithmetic needs repair.','bad');}else{wrong(key);setFeedback('practiceFeedback','Find how many sandwiches existed before the break.','bad');}};
  }
  function practice7(key){
    const r=rec(key);$('practiceContent').innerHTML=`${story('Terdapat <strong>6 kardus</strong>, masing-masing berisi <strong>25 buku latihan</strong>. Sebanyak <strong>30 buku</strong> disimpan sebagai cadangan. Sisa buku dibagikan sama rata kepada <strong>8 kelompok</strong>.<br><br>Berapa buku yang diterima setiap kelompok?')}<div class="stage-box" style="margin-top:12px"><div id="p7Pool" class="order-pool"></div><div id="p7Out" class="order-output empty"></div><button id="p7Route" class="ghost-btn inline-check">Periksa rute</button></div><div id="p7Solve" class="stage-box ${r.structure_correct?'':'locked'}" style="margin-top:10px"><div class="field-grid">${inputExpr('p7Expr','Ekspresi')}${inputNum('p7Ans','Jawaban')}</div><button id="p7Check" class="primary-btn inline-check">Periksa</button></div>`;
    setupOrderBuilder({poolId:'p7Pool',outId:'p7Out',checkId:'p7Route',key,feedbackId:'practiceFeedback',items:[{value:'div',label:'÷ 8'},{value:'sub',label:'− 30'},{value:'mul',label:'6 × 25'}],correct:['mul','sub','div'],wrongMsg:'Operasi pertama harus membentuk jumlah seluruh buku.',onCorrect:()=>{$('p7Solve').classList.remove('locked');}});
    $('p7Check').onclick=()=>{const e=exprMatches($('p7Expr').value,['(6*25-30)/8','(25*6-30)/8']),a=exact($('p7Ans').value,15);if(e&&a){mastered(key);$('practiceNext').disabled=false;setFeedback('practiceFeedback','15 buku per kelompok.','good');renderPracticeParallel(key,6);}else if(e){wrong(key);setFeedback('practiceFeedback','Modelnya benar. Periksa hitungannya.','bad');}else{wrong(key);setFeedback('practiceFeedback','Gunakan rute yang sudah dibangun.','bad');}};
  }
  function practice8(key){
    renderTFTask({root:$('practiceContent'),key,context:'Sembilan kantong berisi <strong>16 jeruk</strong> pada setiap kantong. Sebanyak <strong>24 jeruk</strong> diberikan kepada guru. Sisanya dibagikan sama rata kepada <strong>10 meja siswa</strong>.',statements:[['Jumlah jeruk mula-mula adalah 144.','T'],['Setelah 24 jeruk diberikan, tersisa 128 jeruk.','F'],['Setiap meja menerima 12 jeruk.','T']],evidenceLabel:'Berapa sisa jeruk setelah 24 diberikan?',evidence:120,practice:true});
  }

  function renderPracticeParallel(key,i){
    const r=rec(key),zone=$('practiceParallel');if(!(r.mastered||r.parallel_unlocked)){zone.hidden=true;return;}zone.hidden=false;
    if(!r.parallel_active){zone.innerHTML=`<div class="parallel-launch"><p><strong>Parallel retry:</strong> same structure, new numbers/context. It does not replace the original mastery record.</p><button id="ppLaunch" class="ghost-btn">Try Parallel Retry</button></div>`;$('ppLaunch').onclick=()=>{r.parallel_active=true;save();renderPracticeParallel(key,i);};return;}
    if(r.parallel_solved){zone.innerHTML='<div class="success-strip">Parallel retry completed.</div>';return;}
    const data=[
      {story:'Seven boxes contain <strong>16 juice packs each</strong>. <strong>20 juice packs</strong> are reserved. Write the expression only.',type:'expr',accept:['7*16-20','16*7-20']},
      {story:'Calculate <strong>(8 × 16 − 16) ÷ 7</strong>.',type:'num',answer:16},
      {story:'A stall has <strong>7 trays of 25 badges</strong>. There are <strong>3 posters</strong> behind the stall. <strong>35 badges</strong> are sold. How many badges remain?',type:'irrelevant',irrelevant:3,accept:['7*25-35','25*7-35'],answer:140},
      {type:'same'},
      {story:'Six crates contain <strong>22 bottles each</strong>. <strong>12 bottles</strong> break. Incorrect model: <strong>6 + 22 − 12</strong>. Repair it and solve.',type:'exprnum',accept:['6*22-12','22*6-12'],answer:120},
      {story:'Eight boxes contain <strong>16 muffins each</strong>. <strong>29 muffins</strong> are sold. How many remain?',type:'exprnum',accept:['8*16-29','16*8-29'],answer:99},
      {story:'Terdapat <strong>7 kardus</strong>, masing-masing berisi <strong>24 buku</strong>. <strong>24 buku</strong> disimpan sebagai cadangan. Sisanya dibagikan sama rata kepada <strong>9 kelompok</strong>.',type:'exprnum',accept:['(7*24-24)/9','(24*7-24)/9'],answer:16},
      {type:'tf'}
    ][i];
    if(data.type==='expr') zone.innerHTML=`<div class="parallel-panel">${story(data.story,true)}${inputExpr('ppExpr','Expression only')}<button id="ppCheck" class="ghost-btn inline-check">Check parallel</button><div id="ppFeedback" class="feedback"></div></div>`;
    else if(data.type==='num') zone.innerHTML=`<div class="parallel-panel">${story(data.story,true)}${inputNum('ppAns','Answer')}<button id="ppCheck" class="ghost-btn inline-check">Check parallel</button><div id="ppFeedback" class="feedback"></div></div>`;
    else if(data.type==='irrelevant') zone.innerHTML=`<div class="parallel-panel">${story(data.story,true)}<div class="field-grid three">${inputNum('ppIr','Irrelevant number')}${inputExpr('ppExpr','Expression')}${inputNum('ppAns','Answer')}</div><button id="ppCheck" class="ghost-btn inline-check">Check parallel</button><div id="ppFeedback" class="feedback"></div></div>`;
    else if(data.type==='exprnum') zone.innerHTML=`<div class="parallel-panel">${story(data.story,true)}<div class="field-grid">${inputExpr('ppExpr','Expression')}${inputNum('ppAns','Answer')}</div><button id="ppCheck" class="ghost-btn inline-check">Check parallel</button><div id="ppFeedback" class="feedback"></div></div>`;
    else if(data.type==='same') zone.innerHTML=`<div class="parallel-panel"><h4>Same numbers: 8, 18, 6</h4>${story('Story A: Eight boxes contain 18 stickers each. All stickers are shared among 6 classes.<br><br>Story B: 18 stickers are shared among 6 students, then each student gets 8 more.',true)}<div class="field-grid">${inputExpr('ppExprA','Story A expression')}${inputNum('ppAnsA','A answer')}${inputExpr('ppExprB','Story B expression')}${inputNum('ppAnsB','B answer')}</div><button id="ppCheck" class="ghost-btn inline-check">Check parallel</button><div id="ppFeedback" class="feedback"></div></div>`;
    else zone.innerHTML=`<div class="parallel-panel">${story('Delapan kotak berisi <strong>18 botol</strong> per kotak. <strong>24 botol</strong> disimpan. Sisanya dibagi sama rata kepada <strong>8 meja</strong>.',true)}<p>A. Jumlah awal 144. &nbsp; B. Setelah 24 disimpan, tersisa 118. &nbsp; C. Setiap meja mendapat 15.</p><div class="field-grid three"><label class="field-label"><span>A (B/S)</span><input id="ppA" class="field-input"></label><label class="field-label"><span>B (B/S)</span><input id="ppB" class="field-input"></label><label class="field-label"><span>C (B/S)</span><input id="ppC" class="field-input"></label></div>${inputNum('ppAns','Sisa setelah 24 disimpan')}<button id="ppCheck" class="ghost-btn inline-check">Check parallel</button><div id="ppFeedback" class="feedback"></div></div>`;
    $('ppCheck').onclick=()=>{
      let ok=false;
      if(data.type==='expr') ok=exprMatches($('ppExpr').value,data.accept);
      else if(data.type==='num') ok=exact($('ppAns').value,data.answer);
      else if(data.type==='irrelevant') ok=exact($('ppIr').value,3)&&exprMatches($('ppExpr').value,data.accept)&&exact($('ppAns').value,data.answer);
      else if(data.type==='exprnum') ok=exprMatches($('ppExpr').value,data.accept)&&exact($('ppAns').value,data.answer);
      else if(data.type==='same') ok=exprMatches($('ppExprA').value,['(8*18)/6','8*18/6'])&&exact($('ppAnsA').value,24)&&exprMatches($('ppExprB').value,['18/6+8'])&&exact($('ppAnsB').value,11);
      else {const clean=x=>String(x||'').trim().toLowerCase(); ok=['b','benar','true','t'].includes(clean($('ppA').value))&&['s','salah','false','f'].includes(clean($('ppB').value))&&['b','benar','true','t'].includes(clean($('ppC').value))&&exact($('ppAns').value,120);}
      if(ok){r.parallel_solved=true;save();renderPracticeParallel(key,i);}else setFeedback('ppFeedback','Not yet — use the same structure as the original task.','bad');
    };
  }

  // ---------- FINAL CHECK ----------
  const finalHints=[
    ['What is the number of students brought by the six classes?','Build the class total first. Then account for helpers and students who leave.','First chunk: 6 × 28.'],
    ['Urutkan informasi: jumlah siswa → jumlah kupon → cadangan → amplop.','Cari jumlah seluruh siswa terlebih dahulu.','First chunk: (24 + 28 + 32).']
  ];
  function renderFinalNav(){const nav=$('finalNavigator');nav.innerHTML=[0,1].map(i=>{const r=rec(`final:${i}`);return `<button class="challenge-dot ${i===state.finalIndex?'active':''} ${r.mastered?'done':r.passed_by_teacher?'passed':''}" data-i="${i}">${i+1}</button>`;}).join('');$$('.challenge-dot',nav).forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i);if(i===state.finalIndex)return;pushHistory();state.finalIndex=i;save();renderFinal();});}
  function renderFinal(){
    renderFinalNav();const i=state.finalIndex,key=`final:${i}`,r=rec(key);$('finalTag').textContent=`FINAL ${i+1}`;$('finalCounter').textContent=`${i+1} / 2`;$('finalNext').disabled=true;setFeedback('finalFeedback');
    const cfg=i===0?{story:'Six classes bring <strong>28 students each</strong> to a science fair. <strong>12 student helpers</strong> from the science club also join. After the morning session, <strong>30 students leave</strong>.<br><br>How many students remain at the fair?',accept:['6*28+12-30','28*6+12-30'],answer:150,label:'students'}:{story:'Sebuah kegiatan museum diikuti oleh tiga kelompok siswa: <strong>24 siswa</strong>, <strong>28 siswa</strong>, dan <strong>32 siswa</strong>. Setiap siswa mendapat <strong>3 kupon aktivitas</strong>. Sebanyak <strong>36 kupon</strong> disimpan sebagai cadangan. Sisa kupon dimasukkan ke dalam amplop, masing-masing berisi <strong>18 kupon</strong>.<br><br>Berapa amplop yang dapat diisi penuh?',accept:['(((24+28+32)*3)-36)/18','((24+28+32)*3-36)/18'],answer:12,label:'amplop'};
    $('finalContent').innerHTML=`${story(cfg.story)}<div class="score-board"><div class="score-card ${r.structure_correct?'earned':'pending'}"><strong>STRUCTURE</strong><b>${r.structure_correct?'1':'—'}</b><span>mathematical model</span></div><div class="score-card ${r.calculation_correct?'earned':'pending'}"><strong>CALCULATION</strong><b>${r.calculation_correct?'1':'—'}</b><span>arithmetic result</span></div></div><div class="stage-box"><div class="field-grid">${inputExpr('finalExpr','Your model / expression')}${inputNum('finalAns','Final answer',cfg.label)}</div><button id="finalCheckBtn" class="primary-btn inline-check">Submit both</button></div><div id="finalHintPanel" class="info-strip hidden" style="margin-top:12px"></div>`;
    $('finalCheckBtn').onclick=()=>{setAttempt(key,'structure_attempted');setAttempt(key,'calculation_attempted');const e=exprMatches($('finalExpr').value,cfg.accept),a=exact($('finalAns').value,cfg.answer);if(e)structureOK(key);if(e&&a)calculationOK(key);if(!e&&a){rec(key).extras.final_value_correct=true;save();}if(e&&a){mastered(key);$('finalNext').disabled=false;setFeedback('finalFeedback','Structure 1/1 · Calculation 1/1.','good');renderFinal();}else if(e&&!a){wrong(key);setFeedback('finalFeedback','STRUCTURE 1/1. Keep the model — only the calculation needs a retry.','bad');renderFinalScoreOnly();}else if(!e&&a){wrong(key);setFeedback('finalFeedback','The final value is correct, but STRUCTURE is not yet demonstrated, so CALCULATION is not scored yet. Build a sensible model.','bad');renderFinalScoreOnly();}else{wrong(key);setFeedback('finalFeedback','The model and calculation both need another look. Build the math first.','bad');renderFinalScoreOnly();}};
    function renderFinalScoreOnly(){const rr=rec(key);$$('.score-card',$('finalContent')).forEach((c,idx)=>{const earned=idx===0?rr.structure_correct:rr.calculation_correct;c.classList.toggle('earned',earned);c.classList.toggle('pending',!earned);c.querySelector('b').textContent=earned?'1':'—';});}
    $('finalHint').onclick=()=>{const rr=rec(key);rr.hint_level=Math.min(3,rr.hint_level+1);save();const p=$('finalHintPanel');p.classList.remove('hidden');p.textContent=finalHints[i][rr.hint_level-1];};
    $('finalNext').onclick=nextFinal;statusRestore(key,'finalNext','finalFeedback');
  }

  // ---------- FINISH ----------
  function countRecords(prefix){const rs=Object.entries(state.records).filter(([k])=>k.startsWith(prefix));return {mastered:rs.filter(([,r])=>r.mastered).length,passed:rs.filter(([,r])=>r.passed_by_teacher).length,total:rs.length};}
  function renderFinish(){
    const w=countRecords('warm:'),l=countRecords('lesson:'),p=countRecords('practice:'),f=countRecords('final:');
    $('finishSummary').innerHTML=`<div class="summary-card"><b>${w.mastered}/5</b><span>Warm-up mastery</span></div><div class="summary-card"><b>${l.mastered}</b><span>Lesson activities mastered</span></div><div class="summary-card"><b>${p.mastered}/8</b><span>Independent mastery</span></div><div class="summary-card"><b>${f.mastered}/2</b><span>Final checks mastered</span></div><div class="summary-card"><b>${w.passed+l.passed+p.passed+f.passed}</b><span>Teacher passes</span></div><div class="summary-card"><b>${Object.values(state.records).filter(r=>r.parallel_solved).length}</b><span>Parallel retries solved</span></div>`;
  }

  // ---------- GLOBAL EVENTS ----------
  $('startLesson').onclick=()=>goScene('warmup');
  $('breakContinue').onclick=()=>goScene('lesson');
  $('teacherPass').onclick=teacherPass;
  $('homeBtn').onclick=()=>goScene('cover');
  $('backBtn').onclick=()=>{const h=state.history||[];if(h.length){const s=h.pop();state.history=h;save();restoreSnapshot(s);}else if(state.scene!=='cover'){state.scene='cover';save();renderCurrent();}};
  $$('.section-menu-card').forEach(b=>b.onclick=()=>{const target=b.dataset.sectionTarget;pushHistory();state.scene=target;if(target==='warmup')state.warmIndex=0;if(target==='lesson'){state.lessonGroup=0;state.lessonIndex=0;}if(target==='practice')state.practiceIndex=0;if(target==='finalCheck')state.finalIndex=0;save();renderCurrent();});
  $('finishMenu').onclick=()=>goScene('cover');
  $('restartSession').onclick=()=>{if(confirm('Start a fresh Kirani session? This clears this lesson’s local progress.')){state=freshState();save();renderCurrent();}};

  renderCurrent();
})();
