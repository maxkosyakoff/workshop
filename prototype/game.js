export const SHIFT = 600;
export const RENT = 120;
export const PARTS = {
  tire_road: { name:'Дорожная покрышка', category:'wheel', price:70, quality:92, effect:{range:1, grip:0}, label:'Дальность +1', art:'wheel' },
  tire_grip: { name:'Цепкая покрышка', category:'wheel', price:90, quality:92, effect:{range:-1, grip:2}, label:'Сцепление +2 · дальность −1', art:'wheel' },
  tire_used: { name:'Восстановленная покрышка', category:'wheel', price:40, quality:78, effect:{range:0, grip:0}, label:'Базовые характеристики', art:'wheel', used:true },
  pads: { name:'Тормозные колодки', category:'brake', price:45, quality:92, effect:{}, label:'Новый комплект', art:'brake' },
  pads_used: { name:'Восстановленный тормозной модуль', category:'brake', price:25, quality:72, effect:{}, label:'Учитывайте порог качества', art:'brake', used:true },
  connector: { name:'Комплект проводки', category:'wiring', price:35, quality:92, effect:{}, label:'Разъём и готовый участок', art:'connector' },
  connector_used: { name:'Восстановленный разъём', category:'wiring', price:20, quality:78, effect:{}, label:'Для обычных заказов', art:'connector', used:true },
  shock: { name:'Городской амортизатор', category:'shock', price:130, quality:92, effect:{comfort:1, load:0}, label:'Комфорт +1', art:'shock' },
  shock_cargo: { name:'Грузовой амортизатор', category:'shock', price:155, quality:92, effect:{comfort:-1, load:2}, label:'Нагрузка +2 · комфорт −1', art:'shock' }
};
export const NODES = { wheel:'Колесо', brake:'Тормоз', wiring:'Проводка', shock:'Подвеска' };
export const STAGES = { diagnosis:'Диагностика', bolts:'Разборка', part:'Выбор детали', fit:'Установка', wiring:'Соединение', adjust:'Регулировка', ready:'Готово к выдаче' };

export function skill(state) { return state.xp >= 35 ? 2 : 1; }
export function clock(minutes) { const t = 480 + minutes; return `${String(Math.floor(t / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`; }
export function quality(job) { return Math.max(0, Math.round((PARTS[job.part]?.quality || 0) - (job.wireErrors || 0) * 7 - (job.adjustPenalty || 0))); }
export function effective(a, b) { return { a:a + (b-50)*0.24, b:b - (a-50)*0.18 }; }
export function targets(job) { return { a:46 + (job.seed % 3)*4, b:54 + (job.seed % 2)*6 }; }
export function suitable(job, partId) {
  const p = PARTS[partId];
  if (!p || p.category !== job.type) return false;
  if (job.kind !== 'upgrade') return true;
  return job.goal === 'grip' ? (p.effect.grip || 0) >= 2 : job.goal === 'range' ? (p.effect.range || 0) >= 1 : (p.effect.load || 0) >= 2;
}
export function activeJobs(state) { return state.jobs.filter(j => j.status !== 'closed'); }
export function selectedJob(state) { return state.jobs.find(j => j.id === state.selected && j.status !== 'closed'); }

function log(s, message) { s.notice = message; s.log.unshift({ day:s.day, time:clock(s.minutes), message }); s.log = s.log.slice(0, 35); }
function spend(s, minutes) { if (s.minutes + minutes > SHIFT) throw new Error('Сегодня не хватает времени. Завершите день — работа сохранится.'); s.minutes += minutes; }
function ready(job) { job.stage = 'ready'; job.status = 'ready'; }
function requiredSkill(type) { return type === 'shock' ? 2 : 1; }

function makeOffer(s, i, type, extras = {}) {
  const seed = s.day * 7 + i;
  const clients = ['Ника','Борис','Тим','Лев','Ася','Марат'];
  const text = {
    wheel:['Колесо теряет давление','Заметил повреждение шины после доставки. Нужна исправная покрышка.'],
    brake:['Тормоз цепляет диск','На остановках тормоз работает неровно. Проверьте узел и настройте его.'],
    wiring:['Пропадает питание','После неровностей контакт исчезает. Проверьте проводку.'],
    shock:['Подвеска просела','С грузом задняя часть самоката проседает. Нужен исправный модуль.']
  };
  const [title, complaint] = text[type];
  return { id:`d${s.day}-${i}`, client:clients[(seed+i)%clients.length], type, title, complaint,
    kind:'repair', payment:{wheel:170,brake:160,wiring:160,shock:290}[type], minQuality: i === 1 ? 85 : 75,
    dueDay:s.day+1, seed, required:requiredSkill(type), ...extras };
}
export function offersForDay(s) {
  const types = s.day === 1 ? ['wheel','brake','wiring'] : s.day % 2 ? ['wiring','wheel','shock'] : ['brake','wiring','shock'];
  const result = types.map((t,i) => makeOffer(s,i,t));
  const n = s.story.stage;
  if (!activeJobs(s).some(j => j.storyStep) && !s.story.awaitingChoice && n < 3) {
    result[0] = n === 0 ? makeOffer(s,0,'wheel',{client:'Ника',storyStep:1})
      : n === 1 ? makeOffer(s,0,'wheel',{client:'Ника',storyStep:2,kind:'upgrade',goal:s.story.choice || 'grip',
          title:'Покрышка под мой маршрут',complaint:s.story.choice === 'range' ? 'Послушала ваш совет: хочу больше дальности на городских дорогах.' : 'На маршруте много плохого покрытия. Хочу лучшее сцепление.',payment:220,minQuality:85})
      : makeOffer(s,0,'brake',{client:'Ника',storyStep:3,title:'Последний заказ перед большим маршрутом',payment:190});
  }
  if (skill(s) >= 2) result.push(makeOffer(s,3,'shock',{kind:'upgrade',goal:'load',title:'Подвеска для тяжёлой сумки',complaint:'Нужна грузоподъёмность. С небольшим снижением комфорта согласен.',payment:340,minQuality:85}));
  return result;
}
export function createState() {
  const s = { version:1, day:1, minutes:0, money:420, rep:50, xp:0, torque:false,
    inventory:{tire_road:1,tire_grip:0,tire_used:1,pads:1,pads_used:0,connector:1,connector_used:1,shock:0,shock_cargo:0},
    incoming:[], jobs:[], selected:null, offers:[], log:[], story:{stage:0,choice:null,awaitingChoice:false}, completed:0, refused:0, gameOver:false };
  s.offers = offersForDay(s);
  log(s,'Мастерская открыта. Выберите первый заказ — на складе уже есть основные детали.');
  return s;
}

export function act(state, action) {
  const s = structuredClone(state);
  if (s.gameOver) throw new Error('Попытка завершена. Загрузите начало дня или начните заново.');
  let j = s.jobs.find(x => x.id === (action.jobId || s.selected));
  const live = () => { if (!j || j.status === 'closed') throw new Error('Выберите действующий заказ.'); return j; };
  switch(action.type) {
    case 'SELECT': live(); s.selected = j.id; break;
    case 'ACCEPT': {
      const o = s.offers.find(x => x.id === action.id);
      if (!o) throw new Error('Это предложение больше недоступно.');
      if (activeJobs(s).length >= 2) throw new Error('Оба места заняты. Сначала закройте один заказ.');
      if (skill(s) < o.required) throw new Error('Для этой работы нужна механика II.');
      s.offers = s.offers.filter(x => x.id !== o.id);
      j = {...o,status:'active',stage:'diagnosis',tests:[],bolts:[0,0,0],part:null,wirePairs:[],wireErrors:0,adjustPenalty:0,adjustA:25,adjustB:80};
      s.jobs.push(j); s.selected = j.id; log(s,`Принят заказ: ${j.client} · ${j.title}. Срок: день ${j.dueDay}.`); break;
    }
    case 'DIAG': {
      live(); if (j.stage !== 'diagnosis') throw new Error('Диагностика уже завершена.');
      spend(s,15);
      const rightTool = action.tool === (action.node === 'wiring' ? 'meter' : 'visual');
      const hit = rightTool && action.node === j.type;
      const message = !rightTool ? 'Для этой проверки нужен другой инструмент.' : hit
        ? {wheel:'На покрышке обнаружено повреждение. Требуется замена.',brake:'Обнаружен износ колодок и нарушение регулировки.',wiring:'Повреждено соединение. Нужен комплект проводки.',shock:'Амортизатор неисправен. Требуется замена модуля.'}[j.type]
        : `${NODES[action.node]}: неисправность не обнаружена.`;
      j.tests.push({node:action.node,message,hit});
      if (hit) { j.stage = 'bolts'; j.diagnosed = true; }
      log(s,message); break;
    }
    case 'BOLT': {
      live(); if (j.stage !== 'bolts' || !Number.isInteger(action.index) || action.index < 0 || action.index > 2) throw new Error('Это крепление сейчас недоступно.');
      if (j.bolts[action.index] >= 3) break;
      if (j.bolts[action.index] === 2) spend(s,5);
      j.bolts[action.index]++;
      if (j.bolts.every(n => n === 3)) { j.stage = 'part'; log(s,'Крепления сняты. Выберите совместимую деталь со склада.'); }
      break;
    }
    case 'INSTALL': {
      live(); if (j.stage !== 'part') throw new Error('Сначала снимите крепления.');
      const p = PARTS[action.part];
      if (!p || p.category !== j.type) throw new Error('Деталь не подходит к этому узлу.');
      if (!(s.inventory[action.part] > 0)) throw new Error('Детали нет на складе. Закажите её в снабжении.');
      if (j.type === 'shock' && !s.torque) throw new Error('Для подвески нужен динамометрический ключ. Откройте оснащение.');
      spend(s,30); s.inventory[action.part]--; j.part = action.part; j.stage = 'fit'; log(s,`Выбрана деталь: ${p.name}.`); break;
    }
    case 'FIT': {
      live(); if (j.stage !== 'fit') throw new Error('Нет детали для установки.');
      spend(s,10);
      if (j.type === 'wiring') j.stage = 'wiring';
      else if (j.type === 'brake' || j.type === 'shock') j.stage = 'adjust';
      else ready(j);
      log(s,j.stage === 'ready' ? 'Модуль установлен. Заказ готов к выдаче.' : 'Модуль установлен. Завершите работу с узлом.'); break;
    }
    case 'WIRE': {
      live(); if (j.stage !== 'wiring') throw new Error('Соединения сейчас недоступны.');
      if (!['A','B','C'].includes(action.left) || !['A','B','C'].includes(action.right)) throw new Error('Выберите два контакта.');
      if (j.wirePairs.includes(action.left)) break;
      if (action.left === action.right) j.wirePairs.push(action.left);
      else { spend(s,5); j.wireErrors++; log(s,'Неверная пара. Совместите одинаковые обозначения. Качество снизилось на 7.'); }
      break;
    }
    case 'COMMIT_WIRE': live(); if (j.stage !== 'wiring' || j.wirePairs.length !== 3) throw new Error('Соедините все три пары.'); spend(s,30); ready(j); log(s,'Все контакты соединены. Заказ готов к выдаче.'); break;
    case 'ADJUST_VALUE': live(); if (j.stage !== 'adjust') throw new Error('Регулировка недоступна.'); j.adjustA = Math.max(0,Math.min(100,Number(action.a))); j.adjustB = Math.max(0,Math.min(100,Number(action.b))); if (!Number.isFinite(j.adjustA+j.adjustB)) throw new Error('Некорректная настройка.'); break;
    case 'COMMIT_ADJUST': {
      live(); if (j.stage !== 'adjust') throw new Error('Регулировка недоступна.');
      spend(s,30); const e = effective(j.adjustA,j.adjustB), t = targets(j);
      j.adjustPenalty = Math.round(Math.max(0,Math.abs(e.a-t.a)-6)*1.6 + Math.max(0,Math.abs(e.b-t.b)-6)*1.6);
      ready(j); log(s,`Регулировка завершена. Качество: ${quality(j)}/100.`); break;
    }
    case 'REWORK': {
      live(); if (j.stage !== 'ready' || !['wiring','brake','shock'].includes(j.type)) throw new Error('Для этого узла повторная настройка не нужна.');
      spend(s,15); j.status = 'active'; j.stage = j.type === 'wiring' ? 'wiring' : 'adjust';
      if (j.type === 'wiring') { j.wirePairs = []; j.wireErrors = 0; } break;
    }
    case 'CHANGE_PART': live(); if (!j.part || j.stage !== 'ready') throw new Error('Сначала завершите сборку.'); spend(s,15); s.inventory[j.part]++; j.part = null; j.stage = 'part'; j.status = 'active'; j.wirePairs=[]; j.wireErrors=0; j.adjustPenalty=0; break;
    case 'DELIVER': {
      live(); if (j.stage !== 'ready') throw new Error('Сначала завершите работу.');
      const reasons=[];
      if (s.day > j.dueDay) reasons.push('срок пропущен');
      if (quality(j) < j.minQuality) reasons.push(`качество ${quality(j)} ниже ${j.minQuality}`);
      if (!suitable(j,j.part)) reasons.push('апгрейд не соответствует задаче');
      j.passed = !reasons.length; j.status = 'closed'; j.closedDay = s.day; j.finalQuality = quality(j); j.reasons = reasons;
      if (j.passed) { const before=skill(s); s.money+=j.payment; s.rep=Math.min(100,s.rep+4); s.xp+=14; s.completed++;
        log(s,`${j.client}: заказ принят. +${j.payment} кр. · +14 опыта · +4 репутации.`);
        if (before < skill(s)) log(s,'Механика II открыта! Теперь доступны подвеска и новый ручной инструмент.');
        if (j.storyStep) { s.story.stage=j.storyStep; if (j.storyStep===1) s.story.awaitingChoice=true; if (j.storyStep===3) log(s,'Ника отправилась на большой маршрут. История завершена — мастерская продолжает работу.'); }
      } else { s.rep=Math.max(0,s.rep-8); s.refused++; log(s,`${j.client} отказался платить: ${reasons.join('; ')}. Репутация −8.`); }
      s.selected=activeJobs(s)[0]?.id || null; break;
    }
    case 'CANCEL': live(); spend(s,j.part?15:0); if (j.part) s.inventory[j.part]++; j.part=null; j.status='closed'; j.cancelled=true; j.closedDay=s.day; s.rep=Math.max(0,s.rep-3); s.selected=activeJobs(s)[0]?.id||null; log(s,'Заказ отменён. Транспорт и исходные детали возвращены клиенту. Репутация −3.'); break;
    case 'BUY_PART': {
      const p=PARTS[action.part]; if(!p) throw new Error('Неизвестная деталь.');
      if(s.money<p.price) throw new Error('Недостаточно кредитов.');
      s.money-=p.price; s.incoming.push({part:action.part,day:s.day+1}); log(s,`${p.name}: доставка утром дня ${s.day+1}. −${p.price} кр.`); break;
    }
    case 'BUY_TOOL': if(skill(s)<2) throw new Error('Сначала откройте механику II.'); if(s.torque) throw new Error('Инструмент уже есть.'); if(s.money<120) throw new Error('Нужно 120 кредитов.'); s.money-=120; s.torque=true; log(s,'Динамометрический ключ добавлен к ручным инструментам.'); break;
    case 'STORY_CHOICE': if(!s.story.awaitingChoice || !['grip','range'].includes(action.choice)) throw new Error('Выбор сейчас недоступен.'); s.story.choice=action.choice; s.story.awaitingChoice=false; log(s,'Ника прислушалась к совету. В следующий визит она попросит подходящий апгрейд.'); break;
    case 'END_DAY': {
      if(s.day%3===0) {
        if(s.money<RENT) { s.gameOver=true; log(s,'Не хватает средств на аренду. Можно повторить день или начать новую попытку.'); break; }
        s.money-=RENT; log(s,`Аренда оплачена: −${RENT} кр.`);
      }
      s.day++; s.minutes=0;
      const arriving=s.incoming.filter(x=>x.day<=s.day); for(const x of arriving) s.inventory[x.part]++;
      s.incoming=s.incoming.filter(x=>x.day>s.day); s.offers=offersForDay(s);
      log(s,`День ${s.day}. ${arriving.length ? `Получено деталей: ${arriving.length}.` : 'Новые заказы уже у прилавка.'}`);
      break;
    }
    default: throw new Error('Неизвестное действие.');
  }
  return s;
}
