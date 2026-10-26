const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calculate,validateConfig}=require('../lib/quote');
// Valores fixos de teste: alterações feitas no painel não mudam os cenários.
const base={...require('../config/quote.json'),guestsPerBartender:75,guestsPerBardeck:200,hourlyBartender:100,hourlyBardeck:100,assembledPer10Minutes:4,preparedPer10Minutes:2,transportBase:50,transportIncludedKm:20,transportExtraKm:2,generalPerGuestHour:null,markupPercent:null,glassRentalPerDozen:17,glassesPerGuest:2};
base.drinks=base.drinks.map(drink=>({...drink,method:null,costPerDrink:null}));
const input={guests:160,hours:5,distance:30,needsStructure:false,drinks:['caipirinha','moscow','mojito','gin']};
test('aluguel padrão: duas taças por convidado, uma vez por evento',()=>{
  const r=calculate({...input,guests:100},base);
  assert.equal(r.costs.glassRental,3400/12);
  assert.equal(calculate({...input,guests:100,hours:10},base).costs.glassRental,3400/12);
  assert.equal(calculate({...input,guests:200},base).costs.glassRental,6800/12);
  assert.equal(calculate({...input,guests:100},{...base,glassRentalPerDozen:10,glassesPerGuest:3}).costs.glassRental,250);
  assert.equal(calculate({...input,guests:100},{...base,glassRentalPerDozen:0}).costs.glassRental,0);
  const missing=calculate(input,{...base,glassRentalPerDozen:null});
  assert.equal(missing.costs.glassRental,null);assert.equal(missing.total,null);
  assert.throws(()=>validateConfig({...base,glassRentalPerDozen:-17}));
  assert.throws(()=>validateConfig({...base,glassesPerGuest:1.5}));
});
test('montados usam bases prontas e preparados exigem mais etapas',()=>{
  const c=structuredClone(base);
  c.drinks.forEach(d=>{d.method='montado';});
  assert.equal(calculate({...input,guests:75,hours:1},c).capacity,24);
  c.drinks.forEach(d=>{d.method='preparado';});
  assert.equal(calculate({...input,guests:75,hours:1},c).capacity,12);
});
test('equipe por convidados, transporte sem duplicar base',()=>{const r=calculate(input,base);assert.equal(r.bartenders,3);assert.equal(r.bardecks,1);assert.equal(r.costs.bartenders,1500);assert.equal(r.costs.bardecks,500);assert.equal(r.costs.transport,70);assert.equal(r.total,null);});
test('limites de equipe e bardecks',()=>{for(const [guests,bartenders,bardecks] of [[75,1,1],[76,2,1],[100,2,1],[200,3,1],[201,3,2],[300,4,2],[500,7,3]]){const r=calculate({...input,guests,hours:7},base);assert.equal(r.bartenders,bartenders);assert.equal(r.bardecks,bardecks);if(guests===500)assert.equal(r.costs.bartenders+r.costs.bardecks,7000);}});
test('média proporcional de produção define o custo dos drinks',()=>{
  const c=structuredClone(base);
  c.drinks.forEach(d=>{d.method='montado';d.costPerDrink=2;});
  c.drinks[0].method='preparado';
  Object.assign(c,{generalPerGuestHour:0,markupPercent:0});
  const r=calculate(input,c);
  assert.equal(r.capacity,315); // (2+4+4+4)/4 * 6 * 5h * 3 bartenders.
  assert.equal(r.costs.recipes,630);
  assert.equal(r.total,3153.33);
  const single=calculate({...input,guests:75,hours:1},c);
  assert.equal(single.capacity,21);assert.equal(single.costs.recipes,42);
  c.markupPercent=20;
  assert.equal(calculate(input,c).total,3784);
  c.drinks[0].costPerDrink=null;
  assert.equal(calculate(input,c).costs.recipes,null);
  assert.equal(calculate(input,c).total,null);
});
test('rejeita escolhas invÃ¡lidas e valores manipulados',()=>{for(const patch of [{guests:0},{hours:-1},{guests:1.5},{drinks:['caipirinha','moscow']},{drinks:['caipirinha','moscow','moscow']},{drinks:['caipirinha','moscow','inexistente']}])assert.throws(()=>calculate({...input,...patch},base));const c=structuredClone(base);c.hourlyBartender=99;assert.throws(()=>validateConfig(c));});
test('zero explÃ­cito Ã© vÃ¡lido; desconhecido nÃ£o vira zero',()=>{const r=calculate({...input,distance:0},base);assert.equal(r.costs.transport,50);assert.equal(r.costs.general,null);assert.equal(r.costs.structure,0);assert.equal(r.capacity,null);});

