import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,act,skill,quality,targets,compatible,hydrateState,faultOfferId,PARTS,SHIFT} from '../game.js';
import {VEHICLES,FAULTS,ELECTRIC_NODES} from '../content.js';

function wheelReady() {
  let s=createState(); s=act(s,{type:'ACCEPT',id:s.offers[0].id});
  s=act(s,{type:'DIAG',node:'wheel',tool:'visual'});
  for(let i=0;i<3;i++) for(let n=0;n<3;n++) s=act(s,{type:'BOLT',index:i});
  s=act(s,{type:'INSTALL',part:'tire_road'}); s=act(s,{type:'FIT'}); return s;
}
test('order completion pays once and consumes exactly one part',()=>{
  const s=wheelReady(); assert.equal(s.inventory.tire_road,0); assert.equal(quality(s.jobs[0]),92);
  const done=act(s,{type:'DELIVER'}); assert.equal(done.money,s.money+170); assert.equal(done.completed,1);
  assert.throws(()=>act(done,{type:'DELIVER',jobId:done.jobs[0].id}));
});
test('late repair is refused transparently without changing original state',()=>{
  const s=wheelReady(); s.day=3; const done=act(s,{type:'DELIVER'});
  assert.equal(done.money,s.money); assert.equal(done.refused,1); assert.deepEqual(done.jobs[0].reasons,['срок пропущен']); assert.equal(s.jobs[0].status,'ready');
});
test('insufficient work time cannot consume a replacement',()=>{
  let s=wheelReady(); s=act(s,{type:'CHANGE_PART'}); s.minutes=SHIFT-10;
  const stock=s.inventory.tire_road; assert.throws(()=>act(s,{type:'INSTALL',part:'tire_road'}));
  assert.equal(s.inventory.tire_road,stock); assert.equal(s.jobs[0].part,null);
});
test('paid supplies arrive on explicit next day and never twice',()=>{
  let s=createState(); s=act(s,{type:'BUY_PART',part:'shock'}); assert.equal(s.inventory.shock,0); assert.equal(s.money,290);
  s=act(s,{type:'END_DAY'}); assert.equal(s.inventory.shock,1); assert.equal(s.incoming.length,0);
  s=act(s,{type:'END_DAY'}); assert.equal(s.inventory.shock,1);
});
test('three completed basic jobs unlock mechanics II',()=>{
  let s=wheelReady(); s=act(s,{type:'DELIVER'}); assert.equal(skill(s),1);
  for(let n=0;n<2;n++) {
    s=act(s,{type:'END_DAY'}); s.jobs.push({...s.jobs[0],id:`extra-${n}`,status:'ready',stage:'ready',dueDay:99,storyStep:undefined});
    s.selected=`extra-${n}`; s=act(s,{type:'DELIVER'});
  }
  assert.equal(skill(s),2); assert.equal(s.xp,42);
});
test('bankruptcy is explicit and cannot silently progress the day',()=>{
  const s=createState(); s.day=3; s.money=10; const done=act(s,{type:'END_DAY'});
  assert.equal(done.gameOver,true); assert.equal(done.day,3); assert.throws(()=>act(done,{type:'BUY_PART',part:'connector'}));
});
test('cancellation returns installed workshop part and cannot repeat',()=>{
  const s=wheelReady(); const done=act(s,{type:'CANCEL'}); assert.equal(done.inventory.tire_road,1);
  assert.equal(done.money,s.money); assert.throws(()=>act(done,{type:'CANCEL',jobId:done.jobs[0].id}));
});

function prepare(type,part) {
  let s=createState();
  s.xp=42; s.torque=true;
  if(type==='shock') s=act(s,{type:'END_DAY'});
  const offer=s.offers.find(o=>o.type===type&&o.kind==='repair');
  s=act(s,{type:'ACCEPT',id:offer.id});
  s=act(s,{type:'DIAG',node:type,tool:type==='wiring'?'meter':'visual'});
  for(let i=0;i<3;i++)for(let k=0;k<3;k++)s=act(s,{type:'BOLT',index:i});
  s.inventory[part]=1;
  s=act(s,{type:'INSTALL',part});
  return act(s,{type:'FIT'});
}

test('wiring errors reduce quality and rework restores a clean attempt',()=>{
  let s=prepare('wiring','connector');
  assert.throws(()=>act(s,{type:'COMMIT_WIRE'}));
  s=act(s,{type:'WIRE',left:'A',right:'B'});
  assert.equal(quality(s.jobs[0]),85);
  for(const p of ['A','B','C'])s=act(s,{type:'WIRE',left:p,right:p});
  s=act(s,{type:'COMMIT_WIRE'}); s=act(s,{type:'REWORK'});
  assert.equal(s.jobs[0].wirePairs.length,0); assert.equal(quality(s.jobs[0]),92);
});

test('bad adjustment refuses payment; correcting both coupled values succeeds',()=>{
  let s=prepare('brake','pads');
  const bad=act(s,{type:'COMMIT_ADJUST'});
  assert.ok(quality(bad.jobs[0])<85);
  const refused=act(bad,{type:'DELIVER'});
  assert.equal(refused.refused,1); assert.equal(refused.money,bad.money);
  s=act(bad,{type:'REWORK'});
  const t=targets(s.jobs[0]);
  const a=(t.a-.24*(t.b-50)+2.16)/1.0432;
  const b=t.b+.18*(a-50);
  s=act(s,{type:'ADJUST_VALUE',a,b}); s=act(s,{type:'COMMIT_ADJUST'});
  assert.equal(quality(s.jobs[0]),92);
  assert.equal(act(s,{type:'DELIVER'}).completed,1);
});

test('story choice changes the required upgrade and wrong upgrade is refused',()=>{
  let s=act(wheelReady(),{type:'DELIVER'});
  s=act(s,{type:'STORY_CHOICE',choice:'grip'}); s=act(s,{type:'END_DAY'});
  const offer=s.offers.find(o=>o.storyStep===2);
  assert.equal(offer.goal,'grip');
  s=act(s,{type:'ACCEPT',id:offer.id});
  const j=s.jobs.at(-1); j.part='tire_road'; j.stage='ready'; j.status='ready';
  const refused=act(s,{type:'DELIVER'});
  assert.ok(refused.jobs.at(-1).reasons.includes('апгрейд не соответствует задаче'));
});

test('suspension requires both skill admission and the manual tool',()=>{
  let s=act(createState(),{type:'END_DAY'});
  const id=s.offers.find(o=>o.type==='shock').id;
  assert.throws(()=>act(s,{type:'ACCEPT',id}));
  s=prepare('shock','shock');
  s=act(s,{type:'COMMIT_ADJUST'}); s=act(s,{type:'CHANGE_PART'}); s.torque=false;
  const count=s.inventory.shock;
  assert.throws(()=>act(s,{type:'INSTALL',part:'shock'}));
  assert.equal(s.inventory.shock,count);
});

test('two active jobs keep independent progress when switching',()=>{
  let s=createState(); const first=s.offers[0].id,second=s.offers[1].id;
  s=act(s,{type:'ACCEPT',id:first}); s=act(s,{type:'DIAG',node:'wheel',tool:'visual'});
  s=act(s,{type:'ACCEPT',id:second});
  assert.throws(()=>act(s,{type:'ACCEPT',id:s.offers[0].id}));
  s=act(s,{type:'SELECT',jobId:first});
  assert.equal(s.selected,first); assert.equal(s.jobs[0].stage,'bolts'); assert.equal(s.jobs[1].stage,'diagnosis');
});

test('declining an offer is free and removes only that visitor',()=>{
  const s=createState(),offer=s.offers[0];
  const done=act(s,{type:'DECLINE',id:offer.id});
  assert.equal(done.rep,s.rep); assert.equal(done.money,s.money); assert.equal(done.minutes,s.minutes);
  assert.equal(done.jobs.length,0); assert.equal(done.offers.length,s.offers.length-1);
  assert.ok(!done.offers.some(o=>o.id===offer.id));
  assert.throws(()=>act(done,{type:'ACCEPT',id:offer.id}));
  assert.throws(()=>act(done,{type:'DECLINE',id:offer.id}));
});

test('a visitor with an accepted order cannot be declined as a new offer',()=>{
  let s=createState(); const id=s.offers[0].id;
  s=act(s,{type:'ACCEPT',id});
  assert.throws(()=>act(s,{type:'DECLINE',id}));
  assert.equal(s.jobs[0].status,'active'); assert.equal(s.rep,50);
});

test('all sixty repair scenarios can be completed with compatible parts and reused interactions',()=>{
  let count=0;
  for(const [vehicleId,faults] of Object.entries(FAULTS))for(const fault of faults){
    let s=createState();s.xp=42;s.torque=true;
    s.inventory=Object.fromEntries(Object.keys(PARTS).map(id=>[id,2]));
    s=act(s,{type:'SET_VEHICLE',vehicleId});s=act(s,{type:'REQUEST_FAULT',faultId:fault.id});
    const id=faultOfferId(s,fault);s=act(s,{type:'ACCEPT',id});
    s=act(s,{type:'DIAG',node:fault.node,tool:ELECTRIC_NODES.includes(fault.node)?'meter':'visual'});
    for(let i=0;i<3;i++)for(let k=0;k<3;k++)s=act(s,{type:'BOLT',index:i});
    assert.ok(compatible(s.jobs[0],fault.parts[0]),fault.id);
    s=act(s,{type:'INSTALL',part:fault.parts[0]});s=act(s,{type:'FIT'});
    if(s.jobs[0].stage==='wiring'){
      for(const port of ['A','B','C'])s=act(s,{type:'WIRE',left:port,right:port});
      s=act(s,{type:'COMMIT_WIRE'});
    }else if(s.jobs[0].stage==='adjust'){
      const t=targets(s.jobs[0]),a=(t.a-.24*(t.b-50)+2.16)/1.0432,b=t.b+.18*(a-50);
      s=act(s,{type:'ADJUST_VALUE',a,b});s=act(s,{type:'COMMIT_ADJUST'});
    }
    const money=s.money,payment=s.jobs[0].payment;
    s=act(s,{type:'DELIVER'});
    assert.equal(s.completed,1,fault.id);assert.equal(s.money,money+payment,fault.id);
    assert.equal(s.jobs[0].vehicleId,vehicleId);assert.equal(s.jobs[0].finalQuality,92);
    count++;
  }
  assert.equal(count,60);assert.equal(Object.keys(VEHICLES).length,6);
});

test('changing direction preserves active orders and never recreates processed offers',()=>{
  let s=act(createState(),{type:'SET_VEHICLE',vehicleId:'BI'});
  const fault=FAULTS.BI[0];s=act(s,{type:'REQUEST_FAULT',faultId:fault.id});const id=faultOfferId(s,fault);
  s=act(s,{type:'ACCEPT',id});s=act(s,{type:'DIAG',node:'wheel',tool:'visual'});
  s=act(s,{type:'SET_VEHICLE',vehicleId:'EM'});s=act(s,{type:'SET_VEHICLE',vehicleId:'BI'});
  assert.equal(s.jobs[0].stage,'bolts');assert.ok(!s.offers.some(o=>o.id===id));
  assert.throws(()=>act(s,{type:'REQUEST_FAULT',faultId:fault.id}));
  const declined=s.offers[0].id;s=act(s,{type:'DECLINE',id:declined});
  s=act(s,{type:'SET_VEHICLE',vehicleId:'EM'});s=act(s,{type:'SET_VEHICLE',vehicleId:'BI'});
  assert.ok(!s.offers.some(o=>o.id===declined));
});

test('a bicycle has no electric traction nodes and model-specific replacement is enforced',()=>{
  let s=act(createState(),{type:'SET_VEHICLE',vehicleId:'BI'});
  s=act(s,{type:'ACCEPT',id:s.offers[0].id});
  assert.throws(()=>act(s,{type:'DIAG',node:'battery',tool:'meter'}));
  s=act(s,{type:'DIAG',node:'wheel',tool:'visual'});
  for(let i=0;i<3;i++)for(let k=0;k<3;k++)s=act(s,{type:'BOLT',index:i});
  assert.throws(()=>act(s,{type:'INSTALL',part:'tire_road'}));
  assert.equal(s.inventory.tire_road,1);assert.equal(s.jobs[0].part,null);
});

test('spoke failure requires a wheel assembly rather than only a tire',()=>{
  let s=act(createState(),{type:'SET_VEHICLE',vehicleId:'BI'});const f=FAULTS.BI[4];
  s=act(s,{type:'REQUEST_FAULT',faultId:f.id});s=act(s,{type:'ACCEPT',id:faultOfferId(s,f)});
  assert.equal(compatible(s.jobs[0],'bike_tire'),false);assert.equal(compatible(s.jobs[0],'bike_wheel'),true);
});

test('legacy saves preserve balances and receive new stock with zero quantities',()=>{
  const old=createState();delete old.vehicleId;delete old.declinedOffers;delete old.inventory.bike_battery;
  const s=hydrateState(old);assert.equal(s.vehicleId,'ES');assert.equal(s.money,old.money);assert.equal(s.inventory.bike_battery,0);
  let next=act(s,{type:'BUY_PART',part:'bike_battery'});next=act(next,{type:'END_DAY'});
  assert.equal(next.inventory.bike_battery,1);assert.ok(Number.isFinite(next.money));
});
