import {PARTS,NODES,STAGES,SHIFT,RENT,createState,act,skill,clock,quality,effective,targets,suitable,compatible,hydrateState,faultOfferId,activeJobs,selectedJob} from './game.js';
import {VEHICLES,FAULTS,ELECTRIC_NODES,ADJUST_NODES,vehicleOf,vehicleArt} from './content.js';
import {visitorLook,offerDialogue,resultDialogue,personArt} from './visitors.js';

const SAVE='courier-workshop-pc-v1', CHECKPOINT=SAVE+'-morning';
const app=document.querySelector('#app'), dialog=document.querySelector('#dialog');
const icons={ wrench:'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z', orders:'M8 4h8v3H8z M6 5H4v17h16V5h-2 M8 12h8 M8 17h6', box:'m3 7 9-4 9 4-9 4z M3 7v11l9 4 9-4V7 M12 11v11', bolt:'m13 2-9 12h7l-1 8 10-13h-7z', book:'M4 4h7v17H4z M11 4h9v17h-9 M7 8h1 M14 8h3 M14 12h3', arrow:'M5 12h14 m-5-5 5 5-5 5', clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', check:'m5 12 4 4L20 5', help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', reset:'M4 10a8 8 0 1 1 2 8 M4 4v6h6', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', gear:'M9 3h6l1 4 4 1v7l-4 1-1 5H9l-1-5-4-1V8l4-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0' };
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n]||icons.wrench}"/></svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=type=>`assets/${type === 'wiring' ? 'connector' : type}.svg`;
const money=n=>`${n.toLocaleString('ru-RU')} кр.`;
let state;
try { const saved=JSON.parse(localStorage.getItem(SAVE)); state=saved?.version===1&&Array.isArray(saved.jobs)&&saved.inventory?hydrateState(saved):createState(); } catch { state=createState(); }
let ui={view:'shop',node:'wheel',tool:'visual',filter:'all',wireLeft:null,visit:null,waiting:[]};
let visitTimer;
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;
function toast(text){ const el=document.querySelector('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),4300); }
function persist(){try{localStorage.setItem(SAVE,JSON.stringify(state));}catch{toast('Сохранение недоступно. Оставьте вкладку открытой, чтобы продолжить эту сессию.');}}
function morning(){try{localStorage.setItem(CHECKPOINT,JSON.stringify(state));}catch{}}
if(!localStorage.getItem(CHECKPOINT)) morning();
function dispatch(action){
  try { const day=state.day, oldNotice=state.notice; state=act(state,action); persist(); if(day!==state.day) morning(); render(); if(state.notice!==oldNotice) toast(state.notice); if(state.gameOver) showModal('bankrupt'); return true; }
  catch(error){toast(error.message); return false;}
}
function levelLabel(){return skill(state)===2?'Механика II':'Механика I';}
function due(j){return state.day>j.dueDay?`Просрочен · день ${j.dueDay}`:`До дня ${j.dueDay}, 18:00`;}
function jobTag(j){return j.stage==='part'&&!Object.entries(PARTS).some(([id,p])=>p.category===j.type&&state.inventory[id]>0)?'Нужна деталь':STAGES[j.stage];}
function button(label,action,cls='',attrs=''){return `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;}
function progressPills(j){const steps=['diagnosis','bolts','part','fit','finish','ready']; const idx=j.stage==='wiring'||j.stage==='adjust'?4:steps.indexOf(j.stage); return `<div class="step-pills">${steps.map((_,i)=>`<span class="step-dot ${i===idx?'current':i<idx?'done':''}">${i<idx?'✓':i+1}</span>`).join('')}</div>`;}

function beginVisit(mode,id,arrive=true){
  clearTimeout(visitTimer);
  const person=mode==='story'?{client:'Ника'}:mode==='offer'?state.offers.find(j=>j.id===id):state.jobs.find(j=>j.id===id);
  if(!person)return;
  ui.view='shop';ui.visit={mode,person,line:0,phase:arrive&&!reduceMotion?'arriving':'talking'};render();
  if(ui.visit.phase==='arriving')visitTimer=setTimeout(()=>{if(!ui.visit)return;ui.visit.phase='talking';if(ui.view==='shop')render();},1000);
}
function nextVisitor(){
  const offer=state.offers.find(j=>!ui.waiting.includes(j.id));
  if(offer)beginVisit('offer',offer.id);
  else {ui.visit=null;if(ui.view==='shop')render();}
}
function leaveCounter(text,toWork=false){
  clearTimeout(visitTimer);if(!ui.visit)return;
  ui.visit.phase='leaving';ui.visit.farewell=text;ui.visit.toWork=toWork;render();
  visitTimer=setTimeout(finishDeparture,reduceMotion?0:1000);
}
function finishDeparture(){
  clearTimeout(visitTimer);const toWork=ui.visit?.toWork;ui.visit=null;
  if(ui.view!=='shop')return;
  if(toWork){ui.view='work';render();}else nextVisitor();
}
function shop(){
  const visit=ui.visit,person=visit?.person,offer=visit?.mode==='offer'?state.offers.find(j=>j.id===person.id):null;
  const talking=visit?.phase==='talking';let speech='',actions='',summary='';
  if(visit?.phase==='leaving')speech=visit.farewell;
  else if(visit?.mode==='offer'&&offer){
    const line=offerDialogue(offer)[visit.line];speech=line.text;
    if(talking){
      if(visit.line<2)actions=button(line.reply,'visit-next','primary');
      else actions=button(skill(state)<offer.required?'Нужна механика II':activeJobs(state).length>=2?'Заняты оба места':'Принять заказ','accept','primary',`data-id="${offer.id}" ${skill(state)<offer.required||activeJobs(state).length>=2?'disabled':''}`)+button('Не смогу помочь','decline-visitor','ghost');
      actions+=button('Попросить подождать','hold-visitor','ghost');
    }
    summary=`<div class="counter-contract"><div><span class="eyebrow">${vehicleOf(offer).name} / ${NODES[offer.type]}</span><h3>${esc(offer.title)}</h3></div><div><span>Оплата</span><strong>${money(offer.payment)}</strong></div><div><span>Срок</span><strong>До вечера дня ${offer.dueDay}</strong></div><div><span>Качество</span><strong>Не ниже ${offer.minQuality}</strong></div></div><p class="counter-fineprint">При просрочке, низком качестве или неподходящем апгрейде клиент откажется платить. Отказ до принятия не снижает репутацию.</p>`;
  }else if(visit?.mode==='result'){
    speech=resultDialogue(person);
    if(talking)actions=button(state.story.awaitingChoice?'Выслушать Нику':'До встречи!','visitor-result-next','primary');
    summary=`<div class="counter-outcome ${person.passed?'':'bad'}"><strong>${person.passed?'Работа принята · +'+money(person.payment):'Отказ в оплате · 0 кр.'}</strong><span>${person.passed?`Качество ${person.finalQuality}/100 · +14 опыта · +4 репутации`:esc(person.reasons.join('; '))+' · −8 репутации'}</span></div>`;
  }else if(visit?.mode==='story'){
    speech='А какую покрышку взять потом? Можно срезать через разбитый двор или ехать дальше, зато по ровному асфальту. Что посоветуете?';
    if(talking)actions=button('Лучше сцепление на плохой дороге','story-choice','primary','data-choice="grip"')+button('Больше дальности на городских дорогах','story-choice','ghost','data-choice="range"');
    summary='<p class="counter-fineprint">Ваш совет изменит следующий заказ Ники и подходящий апгрейд.</p>';
  }
  const phase=visit?.phase;
  return `<div class="direction-bar"><span>Направление: <strong>${VEHICLES[state.vehicleId].name}</strong></span>${button('Сменить транспорт / все поломки','nav','small ghost','data-view="fleet"')}</div><div class="main-head"><div><div class="eyebrow">ГОРОДСКАЯ МАСТЕРСКАЯ / ПРИЁМ И ВЫДАЧА</div><h1>Сначала — поговорим.</h1></div><span class="tag green">Дверь открыта</span></div><section class="shop-room" aria-label="Мастерская с прилавком"><img class="room-backdrop" src="assets/workshop.svg" alt="Мастерская: инструменты на стене, рабочий стол и входная дверь"><div class="room-master">${personArt(visitorLook('Ника'),true)}</div><img class="room-counter" src="assets/counter.svg" alt="Прилавок приёма и выдачи заказов">${person?`<div class="room-visitor ${phase==='arriving'?'walk-in':phase==='leaving'?'walk-out':''}" aria-label="Посетитель ${esc(person.client)}">${personArt(visitorLook(person.client))}</div>`:''}${person&&phase!=='arriving'?`<div class="speech-bubble ${phase==='leaving'?'farewell-bubble':''}" role="status"><div class="speech-name">${esc(person.client)} <span>Курьер</span></div><p>${esc(speech)}</p><span class="speech-progress">${visit.mode==='offer'&&phase==='talking'?`Разговор ${visit.line+1} / 3`:'У прилавка'}</span></div>`:''}<div class="room-presence" role="status">${phase==='arriving'?`${esc(person.client)} заходит в мастерскую…`:phase==='leaving'?'Колокольчик у двери звенит на прощание.':person?`${esc(person.client)} · у прилавка`:'Мастерская открыта · ждём посетителей'}</div></section><div class="counter-dialogue"><div class="counter-reply-label">${phase==='arriving'?'Посетитель подходит к прилавку':phase==='leaving'?'До следующей встречи':person?'Ответ мастера':'Заказы и посетители'}</div><div class="counter-actions">${phase==='arriving'?button('Перейти к разговору','skip-arrival','ghost small'):phase==='leaving'?button('Продолжить','finish-departure','ghost small'):person?actions:state.offers.length?button('Позвать следующего посетителя','call-next','primary'):button('Открыть снабжение','nav','primary','data-view="supply"')}${!person&&activeJobs(state).length?button('Вернуться к ремонту','nav','ghost','data-view="work"'):''}</div>${summary}${!person?'<p class="counter-fineprint">Посетителей можно позвать из очереди слева. Разговоры не расходуют рабочее время.</p>':''}</div>`;
}

function fleet(){
  const selected=VEHICLES[state.vehicleId],faults=FAULTS[state.vehicleId];
  return `<div class="main-head"><div><div class="eyebrow">ТРАНСПОРТ / НАПРАВЛЕНИЯ МАСТЕРСКОЙ</div><h1>Что сегодня ремонтируем?</h1></div><span class="tag">6 видов транспорта</span></div><div class="fleet-picker">${Object.entries(VEHICLES).map(([id,v])=>`<button class="fleet-choice ${state.vehicleId===id?'active':''}" data-action="vehicle" data-vehicle="${id}" aria-pressed="${state.vehicleId===id}"><img src="assets/${v.art}.svg" alt=""><span>${v.name}</span></button>`).join('')}</div><div class="note">Выбор направления меняет посетителей и каталог деталей. Уже принятые заказы сохраняются. Для проверки можно позвать клиента с любой поломкой из списка; повторная выдача того же заказа в этот день недоступна.</div><div class="main-head"><div><div class="eyebrow">${state.vehicleId} / 10 ВОЗМОЖНЫХ ПОЛОМОК</div><h2>${selected.name}</h2></div>${button('К прилавку','nav','ghost','data-view="shop"')}</div><div class="fault-list">${faults.map(f=>{
    const id=faultOfferId(state,f),existing=state.jobs.find(j=>j.id===id),declined=state.declinedOffers.includes(id),closed=existing?.status==='closed';
    return `<article class="fault-row"><div><span class="eyebrow">${f.id} · ${NODES[f.node]}</span><h3>${esc(f.title)}</h3><p>${esc(f.complaint)}</p><p class="fault-work"><strong>Работа:</strong> ${esc(f.work)}</p><span class="tiny muted">${f.required===2?'Нужна механика II':'Базовый допуск'} · ${ELECTRIC_NODES.includes(f.node)?'Мультиметр и соединение контактов':ADJUST_NODES.includes(f.node)?'Осмотр и регулировка':'Осмотр и замена'}</span></div>${existing&&!closed?button('Открыть ремонт','select','small',`data-id="${existing.id}"`):button(closed?'Заказ закрыт':declined?'Клиент ушёл':'Позвать посетителя','fault-visit','small',`data-fault="${f.id}" ${closed||declined?'disabled':''}`)}</article>`;
  }).join('')}</div>`;
}

function header(){return `<header class="topbar"><div class="brand"><div class="brand-mark">${icon('wrench')}</div><div><div class="brand-title">Курьерская<span style="color:var(--orange)">.</span></div><div class="eyebrow">Городская мастерская · № 01</div></div></div><div class="stats"><div class="stat"><span>КРЕДИТЫ</span><strong class="money">${money(state.money)}</strong></div><div class="stat rep-stat"><span>РЕПУТАЦИЯ</span><strong>${state.rep}<small class="muted"> / 100</small></strong></div><div class="day-control"><div class="stat"><span>ДЕНЬ ${String(state.day).padStart(2,'0')}</span><strong>${clock(state.minutes)}</strong></div>${button(`${icon('clock')} &nbsp; Завершить день`,'end-day','primary')}</div>${button(icon('help'),'help','icon-button','aria-label="Как играть"')}</div></header>`;}
function sidebar(){
  const jobs=activeJobs(state);
  const navItems=[['shop','orders','Прилавок'],['fleet','orders','Транспорт и работы'],['work','wrench','Верстак'],['supply','box','Снабжение'],['equipment','gear','Оснащение'],['journal','book','Журнал']];
  return `<aside class="sidebar"><nav class="nav" aria-label="Разделы мастерской">${navItems.map(([id,ic,name])=>button(`${icon(ic)} ${name}`,'nav',ui.view===id?'active':'',`data-view="${id}"`)).join('')}</nav>
  <div><div class="section-label"><span>В РАБОТЕ</span><span>${jobs.length}/2</span></div>${jobs.length?jobs.map(j=>`<div class="order-card ${state.selected===j.id?'selected':''}"><div class="row between"><span class="client">${esc(j.client)}</span><span class="tiny mono ${state.day>j.dueDay?'danger':'muted'}">Д${j.dueDay}</span></div><div class="title">${esc(j.title)}</div><span class="tag ${j.stage==='ready'?'green':''}">${jobTag(j)}</span>${button('Открыть заказ','select','small full',`data-id="${j.id}"`)}</div>`).join(''):'<p class="tiny muted">Свободно два места.<br>Примите заказ у прилавка.</p>'}</div>
  <div><div class="section-label"><span>ПОСЕТИТЕЛИ</span><span>${state.offers.length}</span></div>${state.offers.map(j=>`<div class="order-card ${ui.visit?.mode==='offer'&&ui.visit.person.id===j.id?'at-counter':''}"><div class="row between"><span class="client">${esc(j.client)} ${j.storyStep?'↗':''}</span><span class="tiny mono" style="color:var(--orange)">${j.payment} кр.</span></div><div class="title">${esc(j.title)}</div><div class="tiny muted">${ui.waiting.includes(j.id)?'Ждёт вашего ответа':j.kind==='upgrade'?'Апгрейд':'Ремонт'} · ${NODES[j.type]}</div>${button(ui.visit?.mode==='offer'&&ui.visit.person.id===j.id?'Продолжить разговор':'Позвать к прилавку','offer','small full',`data-id="${j.id}"`)}</div>`).join('')||'<p class="tiny muted">Все посетители обслужены.<br>Новые придут завтра.</p>'}</div>
  <div class="skillbox"><div class="row between"><strong style="font-size:12px">${levelLabel()}</strong><span class="tag">${skill(state)===2?'II':'I'}</span></div><div class="progress"><i style="width:${Math.min(100,state.xp/35*100)}%"></i></div><div class="tiny muted mono">${skill(state)===2?'Подвеска открыта':`${state.xp} / 35 опыта до уровня II`}</div><div class="tiny muted" style="margin-top:8px">Электротехника I · базовый допуск</div>${state.story.awaitingChoice?button('Ника ждёт вашего совета','story','small full','style="margin-top:12px"'):''}</div></aside>`;
}

function clipboard(){
  const j=selectedJob(state);
  if(!j) return `<aside class="clipboard"><div class="eyebrow">ЗАПИСКИ МАСТЕРА</div><h2>Небольшой план<br>на большую смену.</h2><div class="divider"></div><div class="spec"><span>Готовых заказов</span><b>${state.completed}</b></div><div class="spec"><span>Отказов в оплате</span><b>${state.refused}</b></div><div class="spec"><span>Аренда</span><b>${RENT} кр. / 3 дня</b></div><p class="quote" style="margin:18px 0">Сначала выясни причину.<br>Потом подбирай деталь.<br>И помни про сроки.</p><div class="divider"></div><div class="tiny muted">Все действия сохраняются в этом браузере. Рабочее время идёт только при выполнении операций.</div>${button('Начать новую попытку','new-game','small ghost full','style="margin-top:18px"')}</aside>`;
  const q=j.part?quality(j):null;
  const done=[j.diagnosed,j.bolts.every(v=>v===3),!!j.part,j.stage==='ready'];
  return `<aside class="clipboard"><div class="row between"><div class="eyebrow">ЗАКАЗ / ${esc(j.id.toUpperCase())}</div><span class="tag">${j.kind==='upgrade'?'АПГРЕЙД':'РЕМОНТ'}</span></div><div class="row" style="margin-top:12px"><div class="badge">${esc(j.client[0])}</div><div><strong>${esc(j.client)}</strong><div class="tiny muted">${vehicleOf(j).name} · городской маршрут</div></div></div><h2>${esc(j.title)}</h2><p class="quote">${esc(j.complaint)}</p><div class="divider"></div><div class="spec"><span>Оплата</span><b>${money(j.payment)}</b></div><div class="spec"><span>Срок</span><b class="${state.day>j.dueDay?'danger':''}">День ${j.dueDay} · 18:00</b></div><div class="spec"><span>Нужно качество</span><b>≥ ${j.minQuality}</b></div><div class="spec"><span>Допуск</span><b>${ELECTRIC_NODES.includes(j.type)?'Электромонтаж · ':''}${j.required===2?'Механика II':'Базовый'}</b></div><div class="divider"></div><div class="stack">${['Диагностика','Доступ к узлу','Замена компонента','Работа завершена'].map((name,i)=>`<div class="row tiny" style="color:${done[i]?'#4e714f':'#8d9882'}"><span style="width:15px">${done[i]?'✓':'○'}</span>${name}</div>`).join('')}</div><div class="divider"></div><div class="eyebrow">ТЕКУЩЕЕ КАЧЕСТВО</div><div class="quality"><strong>${q??'—'}</strong><div style="flex:1"><div class="progress ${q!==null&&q<j.minQuality?'bad':''}"><i style="width:${q||0}%"></i></div><div class="tiny muted" style="margin-top:5px">${q===null?'После выбора детали':q>=j.minQuality?'Соответствует условию':'Ниже условия клиента'}</div></div></div>${j.kind==='upgrade'&&j.part?`<div class="tiny" style="color:${suitable(j,j.part)?'#527547':'#a34f3a'}">${suitable(j,j.part)?'✓ Апгрейд подходит маршруту':'! Апгрейд не подходит маршруту'}</div>`:''}${button('Выдать заказ','deliver','success full',`${j.stage!=='ready'?'disabled':''} style="margin-top:15px"`)}${j.stage==='ready'&&[...ELECTRIC_NODES,...ADJUST_NODES].includes(j.type)?button('Исправить настройку · 15 мин','rework','small full','style="margin-top:8px"'):''}${j.stage==='ready'?button('Заменить деталь · 15 мин','change-part','small ghost full','style="margin-top:7px"'):''}${button('Отменить заказ','cancel','small danger full','style="margin-top:13px"')}</aside>`;
}

function diag(j){return `<div class="board"><div class="scene"><img class="scooter-image" src="${vehicleArt(j)}" alt="${vehicleOf(j).name}"></div><div class="board-toolbar"><span>${j.vehicleId||'ES'} · ${vehicleOf(j).name}</span><span class="tag">Одна основная неисправность</span></div></div><div class="diagnostic-nodes">${vehicleOf(j).nodes.map(key=>button(`${ui.node===key?'●':'○'} ${NODES[key]}`,'node',ui.node===key?'active':'',`data-node="${key}"`)).join('')}</div><div class="instructions"><strong>Выберите узел и инструмент проверки.</strong><p>Каждая проверка занимает 15 игровых минут. После диагностики появится описание нужной работы.</p></div><div class="diagnostic-footer"><div class="tool-choices">${button(`${icon('eye')} Осмотр`,'diag-tool',ui.tool==='visual'?'active':'',`data-tool="visual"`)}${button(`${icon('bolt')} Мультиметр`,'diag-tool',ui.tool==='meter'?'active':'',`data-tool="meter"`)}</div>${button('Проверить · 15 мин','diagnose','primary')}</div>${j.tests.slice(-2).map(t=>`<div class="test-result">${esc(t.message)}</div>`).join('')}`;}

function moduleBoard(j){
  let content='';
  if(j.stage==='bolts') content=`<div class="board"><div class="bench"><span class="bench-label">${NODES[j.type].toUpperCase()} / СНЯТИЕ КРЕПЛЕНИЙ</span><img class="part-art" src="${art(j.type)}" alt="${NODES[j.type]}">${j.bolts.map((n,i)=>button(`<b>${n===3?'✓':'⊕'}</b><span>${n===3?'СНЯТ':`${n}/3`}</span>`,'bolt',`bolt ${n===3?'done':''}`,`data-index="${i}" aria-label="Крепление ${i+1}, ${n} из 3" ${n===3?'disabled':''}`)).join('')}<span class="corner">ДЕТАЛИ ОСТАЮТСЯ В ЛОТКЕ</span></div><div class="board-toolbar">${progressPills(j)}<span class="tag">5 мин / крепление</span></div></div><div class="instructions"><strong>Освободите три крепления.</strong><p>Нажмите на каждое три раза — ключ повернётся, а крепление окажется в лотке.</p></div>`;
  if(j.stage==='part') {
    const parts=Object.entries(PARTS).filter(([id])=>compatible(j,id));
    content=`<div class="board"><div class="bench" style="min-height:215px"><span class="bench-label">УЗЕЛ ОТКРЫТ / ПОДБОР ДЕТАЛИ</span><img class="part-art" style="height:160px" src="${art(j.type)}" alt="Снятый компонент"></div><div class="board-toolbar">${progressPills(j)}<span class="tag">Установка · 30 мин</span></div></div><div class="instructions"><strong>Выберите совместимый компонент со склада.</strong><p>Обратите внимание на состояние и задачу клиента. Заказанные детали придут завтра.</p></div><div class="choices">${parts.map(([id,p])=>`<button class="part-choice ${suitable(j,id)?'suggested':''}" data-action="install" data-part="${id}" ${!state.inventory[id]?'disabled':''}><img src="assets/${p.art}.svg" alt=""><div><strong>${p.name}</strong><span class="muted">Качество ${p.quality} · на складе ${state.inventory[id]||0}</span><span class="muted">${p.label}</span>${j.kind==='upgrade'?`<span class="tiny" style="color:${suitable(j,id)?'var(--green)':'var(--red)'}">${suitable(j,id)?'Подходит задаче':'Не соответствует задаче'}</span>`:''}</div></button>`).join('')}</div>${button(`${icon('box')} Заказать детали`,'nav','ghost',`data-view="supply"`)}`;
  }
  if(j.stage==='fit') content=`<div class="board"><div class="bench"><span class="bench-label">СОВМЕЩЕНИЕ / ${PARTS[j.part].name.toUpperCase()}</span><div class="fit-target"></div><img class="part-art art-fit" src="${art(j.type)}" alt="Выбранная деталь над посадочным местом"></div><div class="board-toolbar">${progressPills(j)}<span class="tag">10 мин</span></div></div><div class="instructions"><strong>Совместите модуль с посадочным местом.</strong><p>Выбранная деталь совместима по размеру. Подтвердите установку в отмеченный контур.</p></div>${button(`${icon('arrow')} Установить модуль · 10 мин`,'fit','primary')}`;
  return content;
}

function wiring(j){
  const order=['C','A','B'];
  return `<div class="wire-board"><span class="label">СОЕДИНЕНИЯ</span><svg viewBox="0 0 600 280" preserveAspectRatio="none">${j.wirePairs.map(p=>{const y=55+['A','B','C'].indexOf(p)*80, r=55+order.indexOf(p)*80;return `<path d="M65 ${y} C260 ${y} 340 ${r} 535 ${r}" fill="none" stroke="${{A:'#c68a4e',B:'#6a9e89',C:'#a29d5f'}[p]}" stroke-width="6" stroke-linecap="round"/>`;}).join('')}</svg>${['A','B','C'].map((p,i)=>button(`${p} ●`,'wire-left',`port left ${ui.wireLeft===p?'active':''} ${j.wirePairs.includes(p)?'done':''}`,`style="top:${(55+i*80)/280*100}%" data-port="${p}" aria-label="Левый контакт ${p}" ${j.wirePairs.includes(p)?'disabled':''}`)).join('')}${order.map((p,i)=>button(`● ${p}`,'wire-right',`port right ${j.wirePairs.includes(p)?'done':''}`,`style="top:${(55+i*80)/280*100}%" data-port="${p}" aria-label="Правый контакт ${p}" ${j.wirePairs.includes(p)?'disabled':''}`)).join('')}</div><div class="instructions"><strong>Соедините пары с одинаковыми обозначениями.</strong><p>Сначала левый контакт, затем правый. Ошибка пары: −7 качества и 5 минут. Это условная игровая схема.</p></div><div class="row between"><span class="muted mono tiny">Соединено ${j.wirePairs.length}/3 · ошибок ${j.wireErrors}</span>${button('Зафиксировать · 30 мин','commit-wire','primary',j.wirePairs.length!==3?'disabled':'')}</div>`;
}

function adjust(j){
  const e=effective(j.adjustA,j.adjustB),t=targets(j);
  return `<div class="gauge-card"><div class="eyebrow" style="color:#718366">РЕГУЛИРОВКА / ${NODES[j.type].toUpperCase()} / ДВА СВЯЗАННЫХ ПАРАМЕТРА</div>${[['a','Центровка',j.adjustA,e.a,t.a],['b','Натяжение',j.adjustB,e.b,t.b]].map(([id,name,value,eff,target])=>`<div class="gauge"><div class="gauge-head"><strong>${name}</strong><output id="out-${id}">${eff.toFixed(1)} / цель ${target-6}–${target+6}</output></div><div class="gauge-track"><span class="target-band" style="left:${target-6}%;width:12%"></span><i id="needle-${id}" class="gauge-needle" style="left:${Math.max(0,Math.min(100,eff))}%"></i></div><input id="adjust-${id}" type="range" min="0" max="100" step="1" value="${value}" aria-label="${name}"></div>`).join('')}<div id="adjust-result" class="adjust-readout">${Math.abs(e.a-t.a)<=6&&Math.abs(e.b-t.b)<=6?'Оба параметра в рабочей области':'Совместите оба указателя с зелёными областями'}</div></div><div class="instructions"><strong>Найдите баланс двух регулировок.</strong><p>Изменение одного параметра слегка влияет на другой. Можно закончить с плохой настройкой, но клиент увидит результат.</p></div>${button('Применить настройку · 30 мин','commit-adjust','primary')}`;
}

function work(){
  const j=selectedJob(state);
  if(!j) return `<div class="main-head"><div><div class="eyebrow">РАБОЧЕЕ МЕСТО / 01</div><h1>Добро пожаловать в смену.</h1></div><span class="tag green">Верстак свободен</span></div><div class="board"><div class="scene"><img class="scooter-image" src="${vehicleArt({vehicleId:state.vehicleId})}" alt="${VEHICLES[state.vehicleId].name}"><span class="scene-caption">ОДНА МАСТЕРСКАЯ. КАЖДЫЙ ЗАКАЗ ИМЕЕТ ЗНАЧЕНИЕ.</span></div><div class="board-toolbar"><span>${state.vehicleId} · ${VEHICLES[state.vehicleId].name}</span><span class="tag">Ручной ремонт</span></div></div><div class="empty-work"><h2>${state.completed?'Следующий клиент уже ждёт.':'Сначала — первый заказ.'}</h2><p>Примите заказ у прилавка, найдите неисправность и верните курьера на маршрут.</p>${state.offers.length?button(`Посмотреть заказ ${esc(state.offers[0].client)} ${icon('arrow')}`,'offer','primary',`data-id="${state.offers[0].id}"`):button('Открыть снабжение','nav','primary','data-view="supply"')}</div><div class="note">${icon('clock')} &nbsp; Рабочее время расходуется только на действия. Детали приходят утром следующего дня.</div>`;
  const body=j.stage==='diagnosis'?diag(j):['bolts','part','fit'].includes(j.stage)?moduleBoard(j):j.stage==='wiring'?wiring(j):j.stage==='adjust'?adjust(j):readyBoard(j);
  return `<div class="main-head"><div><div class="eyebrow">${esc(j.client.toUpperCase())} / ${vehicleOf(j).name} / ${j.kind==='upgrade'?'АПГРЕЙД':'РЕМОНТ'}</div><h1>${STAGES[j.stage]}</h1></div><span class="tag ${state.day>j.dueDay?'red':'orange'}">${due(j)}</span></div>${body}`;
}
function readyBoard(j){
  const good=quality(j)>=j.minQuality&&suitable(j,j.part)&&state.day<=j.dueDay;
  return `<div class="board"><div class="scene"><img class="scooter-image" src="${vehicleArt(j)}" alt="Собранный транспорт: ${vehicleOf(j).name}"><span class="ready-stamp">${good?'ГОТОВО К МАРШРУТУ':'ЕСТЬ ЗАМЕЧАНИЯ'}</span></div><div class="board-toolbar">${progressPills(j)}<span class="tag">Качество ${quality(j)} / 100</span></div></div><div class="instructions"><strong>${good?'Условия заказа выполнены. Можно выдавать.':'Проверьте условия перед выдачей.'}</strong><p>${state.day>j.dueDay?'Срок уже пропущен. Клиент откажется платить.':quality(j)<j.minQuality?'Качество ниже требуемого: можно изменить деталь или повторить настройку.':!suitable(j,j.part)?'Выбранный апгрейд не решает задачу клиента. Можно заменить деталь.':'Итог рассчитан по вашим действиям. Отдельной проверки после ремонта нет.'}</p></div>${j.kind==='upgrade'?`<div class="stats-grid">${[['Дальность','range',3],['Нагрузка','load',2],['Комфорт','comfort',3],['Сцепление','grip',2]].map(([name,key,base])=>`<div class="vehicle-stat">${name}<b>${base} → ${base+(PARTS[j.part].effect[key]||0)}</b></div>`).join('')}</div>`:''}${button('Выдать заказ клиенту','deliver',good?'success':'primary')}`;
}

function supply(){
  const filters=[['all','Все детали'],...Object.entries(NODES).filter(([id])=>VEHICLES[state.vehicleId].nodes.includes(id))];
  const items=Object.entries(PARTS).filter(([,p])=>(p.vehicles||(p.category==='shock'?['ES','MP','EM','EB']:['ES'])).includes(state.vehicleId)&&(ui.filter==='all'||p.category===ui.filter));
  return `<div class="main-head"><div><div class="eyebrow">ТЕРМИНАЛ МАСТЕРСКОЙ</div><h1>Детали для следующего заказа.</h1></div><span class="tag">Доставка: день ${state.day+1}</span></div><div class="note">Детали поступят после завершения дня. На складе — ваши запасы; установленные в заказ детали уже списаны.</div>${state.incoming.length?`<div class="delivery"><strong>В пути: ${state.incoming.length}</strong><div class="tiny muted" style="margin-top:5px">${state.incoming.map(x=>`${PARTS[x.part].name} · Д${x.day}`).join(' / ')}</div></div>`:''}<div class="filter-tabs">${filters.map(([id,label])=>button(label,'filter',`small ${ui.filter===id?'active':''}`,`data-filter="${id}"`)).join('')}</div><div class="catalog">${items.map(([id,p])=>`<article class="catalog-card"><img src="assets/${p.art}.svg" alt=""><div><div class="row between"><span class="tag ${p.used?'':'green'}">${p.used?'ВОССТАНОВЛЕНО':'НОВОЕ'}</span><span class="tiny mono muted">В наличии: ${state.inventory[id]||0}</span></div><h3>${p.name}</h3><p class="muted">${p.label}<br>Качество ${p.quality}/100</p>${button(`Заказать · ${money(p.price)}`,'buy-part','small',`data-part="${id}" ${state.money<p.price?'disabled':''}`)}</div></article>`).join('')}</div>`;
}
function equipment(){return `<div class="main-head"><div><div class="eyebrow">РУЧНЫЕ ИНСТРУМЕНТЫ</div><h1>Навык открывает возможности.</h1></div><span class="tag">Без автоматизации</span></div><div class="equipment">${[['wrench','Механический комплект','Корпуса, крепёж, колёса и базовая регулировка.','М I'],['bolt','Электромонтажный комплект','Подготовленные разъёмы и участки проводки.','Э I'],['eye','Мультиметр','Поиск неисправности электрических соединений.','Э I'],['gear','Подъёмная стойка','Удержание транспорта во время работы.','М I']].map(([ic,name,desc,level])=>`<article class="equipment-card"><div class="big-icon">${icon(ic)}</div><h3>${name}</h3><p>${desc}</p><span class="tag green">${level} · есть в мастерской</span></article>`).join('')}<article class="equipment-card" style="border-color:var(--orange)"><div class="big-icon">${icon('wrench')}</div><h3>Динамометрический ключ</h3><p>Открывает ручные работы с подвеской. Нужны механика II и сам инструмент.</p>${state.torque?'<span class="tag green">М II · инструмент получен</span>':button(skill(state)<2?'Откроется на механике II':'Получить · 120 кр.','buy-tool','primary small',skill(state)<2?'disabled':'')}</article></div><div class="note">За принятый клиентом заказ: +14 опыта. Механика II открывается на 35 опыте. Инструменты не выполняют работу за мастера.</div>`;}
function journal(){return `<div class="main-head"><div><div class="eyebrow">ИСТОРИЯ МАСТЕРСКОЙ</div><h1>Что произошло за смену.</h1></div>${button(icon('reset'),'new-game','icon-button','aria-label="Новая попытка"')}</div><div class="journal">${state.log.map(x=>`<div class="journal-item"><time>ДЕНЬ ${x.day}<br>${x.time}</time><div>${esc(x.message)}</div></div>`).join('')}</div>`;}
function render(){app.innerHTML=`<div class="app">${header()}<div class="layout ${['shop','fleet'].includes(ui.view)?'shop-layout':''}">${sidebar()}<main class="main ${ui.view==='shop'?'shop-main':''}">${({shop,fleet,work,supply,equipment,journal})[ui.view]()}</main>${['shop','fleet'].includes(ui.view)?'':clipboard()}</div><footer class="bottom"><span><i class="save-dot"></i>Сохранено в браузере · 2D / PC</span><span>До конца смены: ${Math.floor((SHIFT-state.minutes)/60)} ч ${(SHIFT-state.minutes)%60} мин · аренда в конце дня ${state.day+(3-state.day%3)%3}</span></footer></div>`;}

function closeModal(){dialog.close();}
function showModal(type,id){
  let content='';
  if(type==='endday') {
    const dueNow=activeJobs(state).filter(j=>j.dueDay<=state.day);
    content=`<div class="eyebrow">ЗАКРЫТИЕ МАСТЕРСКОЙ</div><h2>Завершить день ${state.day}?</h2><p>Незаконченные заказы сохранятся. Утром придут заказанные детали и новые клиенты.</p>${dueNow.length?`<div class="outcome-card bad">После перехода дня будут просрочены: ${dueNow.map(j=>esc(j.client)).join(', ')}.</div>`:''}${state.day%3===0?`<p>Аренда сегодня: <strong>${money(RENT)}</strong>. На счету ${money(state.money)}.</p>`:'<p class="tiny">Оставшееся рабочее время не переносится.</p>'}<div class="row">${button('Вернуться к работе','close','ghost')}${button('Да, завершить день','confirm-day','primary')}</div>`;
  }
  if(type==='cancel') { const j=selectedJob(state); if(!j)return; content=`<div class="eyebrow">ОТМЕНА ЗАКАЗА</div><h2>Вернуть транспорт ${esc(j.client)}?</h2><p>Оплаты не будет. Репутация снизится на 3.${j.part?' Установленная деталь вернётся на склад. Снятие займёт 15 минут.':''}</p><div class="row">${button('Продолжить ремонт','close','ghost')}${button('Отменить заказ','confirm-cancel','primary')}</div>`; }
  if(type==='help') content=`<div class="eyebrow">КОРОТКО ОБ ИГРЕ</div><h2>От прилавка — к верстаку.</h2><p>1. Дождитесь посетителя у прилавка. Реплики появляются в спич-баблах; ответы мастера — под сценой.<br>2. Обсудите условия и примите заказ, попросите подождать или откажитесь без потери репутации.<br>3. Найдите поломку осмотром или мультиметром.<br>4. Снимите крепления, выберите деталь, соедините контакты или выполните регулировку.<br>5. Выдайте заказ до срока — клиент вернётся к прилавку.</p><div class="outcome-card">Если нет детали, закажите её в снабжении и завершите день. Начальные детали уже на складе.</div><p>Разговоры и анимации бесплатны по времени. Механика II открывается после 35 опыта. Каждые три дня нужно оплатить 120 кредитов аренды. Ремонт и принятые заказы сохраняются автоматически.</p><div class="row">${button('Понятно, за работу','close','primary')}</div>`;
  if(type==='newgame') content=`<div class="eyebrow">НОВАЯ ПОПЫТКА</div><h2>Начать с первого дня?</h2><p>Текущий прогресс этой вкладки будет заменён новым сохранением.</p><div class="row">${button('Сохранить текущую игру','close','ghost')}${button('Начать заново','confirm-new','primary')}</div>`;
  if(type==='bankrupt') content=`<div class="eyebrow">ПОПЫТКА ЗАВЕРШЕНА</div><h2>Не хватило на аренду.</h2><p>Можно повторить этот день с утреннего сохранения или начать с первого дня. Полученные в неудачной попытке результаты не переносятся.</p><div class="stack">${button('Повторить день с утра','restore-day','primary')}${button('Новая попытка','confirm-new')}</div>`;
  dialog.innerHTML=content; if(!dialog.open)dialog.showModal();
}

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action]'); if(!el||el.disabled)return;
  const a=el.dataset.action;
  if(a==='vehicle'){clearTimeout(visitTimer);ui.visit=null;ui.waiting=[];ui.filter='all';if(dispatch({type:'SET_VEHICLE',vehicleId:el.dataset.vehicle})){ui.view='fleet';render();}return;}
  if(a==='fault-visit'){if(dispatch({type:'REQUEST_FAULT',faultId:el.dataset.fault})){const fault=FAULTS[state.vehicleId].find(f=>f.id===el.dataset.fault);beginVisit('offer',faultOfferId(state,fault));}return;}
  if(a==='nav'){ui.view=el.dataset.view;if(ui.view==='shop'&&!ui.visit){if(state.story.awaitingChoice)beginVisit('story');else nextVisitor();}else render();return;}
  if(a==='close'){closeModal();return;}
  if(a==='offer'){if(ui.visit?.mode==='offer'&&ui.visit.person.id===el.dataset.id&&ui.visit.phase!=='leaving'){ui.view='shop';render();}else beginVisit('offer',el.dataset.id);return;}
  if(a==='visit-next'){if(ui.visit?.mode==='offer'&&ui.visit.phase==='talking'){ui.visit.line=Math.min(2,ui.visit.line+1);render();}return;}
  if(a==='skip-arrival'){clearTimeout(visitTimer);if(ui.visit){ui.visit.phase='talking';render();}return;}
  if(a==='call-next'){ui.waiting=[];nextVisitor();return;}
  if(a==='finish-departure'){finishDeparture();return;}
  if(a==='hold-visitor'){if(ui.visit?.mode==='offer'){ui.waiting.push(ui.visit.person.id);leaveCounter('Хорошо, я подожду. Позовите, когда сможете заняться моим заказом.');}return;}
  if(a==='decline-visitor'){if(ui.visit?.mode==='offer'&&ui.visit.phase==='talking'&&dispatch({type:'DECLINE',id:ui.visit.person.id}))leaveCounter('Понятно. Тогда поищу другую мастерскую. До свидания.');return;}
  if(a==='accept'){if(ui.visit?.mode!=='offer'||ui.visit.phase!=='talking'||ui.visit.line!==2)return;if(dispatch({type:'ACCEPT',id:el.dataset.id})){ui.node='wheel';ui.tool='visual';closeModal();leaveCounter('Договорились! Оставляю транспорт у вас. Вернусь за ним к сроку.',true);}return;}
  if(a==='select'){ui.view='work';ui.wireLeft=null;dispatch({type:'SELECT',jobId:el.dataset.id});return;}
  if(a==='node'){ui.node=el.dataset.node;render();return;}
  if(a==='diag-tool'){ui.tool=el.dataset.tool;render();return;}
  if(a==='diagnose'){dispatch({type:'DIAG',node:ui.node,tool:ui.tool});return;}
  if(a==='bolt'){dispatch({type:'BOLT',index:Number(el.dataset.index)});return;}
  if(a==='install'){dispatch({type:'INSTALL',part:el.dataset.part});return;}
  if(a==='fit'){dispatch({type:'FIT'});return;}
  if(a==='wire-left'){ui.wireLeft=el.dataset.port;render();return;}
  if(a==='wire-right'){if(!ui.wireLeft){toast('Сначала выберите левый контакт.');return;}const left=ui.wireLeft;ui.wireLeft=null;dispatch({type:'WIRE',left,right:el.dataset.port});return;}
  if(a==='commit-wire'){dispatch({type:'COMMIT_WIRE'});return;}
  if(a==='commit-adjust'){dispatch({type:'COMMIT_ADJUST'});return;}
  if(a==='rework'){ui.wireLeft=null;dispatch({type:'REWORK'});return;}
  if(a==='change-part'){dispatch({type:'CHANGE_PART'});return;}
  if(a==='deliver'){const id=state.selected;if(dispatch({type:'DELIVER'}))beginVisit('result',id);return;}
  if(a==='visitor-result-next'){if(state.story.awaitingChoice)beginVisit('story',null,false);else leaveCounter('До встречи! Удачной смены.');return;}
  if(a==='cancel'){showModal('cancel');return;}
  if(a==='confirm-cancel'){if(dispatch({type:'CANCEL'}))closeModal();return;}
  if(a==='filter'){ui.filter=el.dataset.filter;render();return;}
  if(a==='buy-part'){dispatch({type:'BUY_PART',part:el.dataset.part});return;}
  if(a==='buy-tool'){dispatch({type:'BUY_TOOL'});return;}
  if(a==='end-day'){showModal('endday');return;}
  if(a==='confirm-day'){if(dispatch({type:'END_DAY'})&&!state.gameOver){closeModal();ui.waiting=[];if(state.story.awaitingChoice)beginVisit('story');else{ui.view='shop';nextVisitor();}}return;}
  if(a==='story'){beginVisit('story');return;}
  if(a==='story-choice'){if(dispatch({type:'STORY_CHOICE',choice:el.dataset.choice})){closeModal();leaveCounter('Спасибо за совет! В следующий раз приду за подходящей покрышкой.');}return;}
  if(a==='help'){showModal('help');return;}
  if(a==='new-game'){showModal('newgame');return;}
  if(a==='confirm-new'){clearTimeout(visitTimer);state=createState();ui.view='shop';ui.visit=null;ui.waiting=[];ui.wireLeft=null;persist();morning();closeModal();nextVisitor();toast('Новая смена. Первый посетитель уже идёт к прилавку.');return;}
  if(a==='restore-day'){try{const saved=JSON.parse(localStorage.getItem(CHECKPOINT));if(saved?.version!==1||saved.gameOver)throw new Error();state=hydrateState(saved);persist();closeModal();ui.waiting=[];ui.view='shop';if(state.story.awaitingChoice)beginVisit('story');else nextVisitor();toast('День восстановлен с утреннего сохранения.');}catch{toast('Утреннее сохранение недоступно. Начните новую попытку.');}return;}
});
document.addEventListener('input',e=>{
  if(!e.target.matches('#adjust-a,#adjust-b'))return;
  try{
    const a=Number(document.querySelector('#adjust-a').value),b=Number(document.querySelector('#adjust-b').value);
    state=act(state,{type:'ADJUST_VALUE',a,b});persist();
    const j=selectedJob(state),v=effective(a,b),t=targets(j);
    for(const k of ['a','b']){document.querySelector(`#out-${k}`).textContent=`${v[k].toFixed(1)} / цель ${t[k]-6}–${t[k]+6}`;document.querySelector(`#needle-${k}`).style.left=`${Math.max(0,Math.min(100,v[k]))}%`;}
    document.querySelector('#adjust-result').textContent=Math.abs(v.a-t.a)<=6&&Math.abs(v.b-t.b)<=6?'Оба параметра в рабочей области':'Совместите оба указателя с зелёными областями';
  }catch(error){toast(error.message);}
});
render();persist();if(state.gameOver)showModal('bankrupt');else if(state.story.awaitingChoice)beginVisit('story');else nextVisitor();
