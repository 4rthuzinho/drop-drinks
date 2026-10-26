const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTransportResolver,normalizeCep}=require('../lib/transport');
const {calculate}=require('../lib/quote');
const base={...require('../config/quote.json'),transportExtraKm:2};
test('sem CEP mantém base sem consultar serviços',async()=>{
  const resolve=createTransportResolver(()=>{throw Error('Não deveria consultar');});
  const t=await resolve(null);assert.equal(t.status,'not_informed');assert.equal(t.distance,null);
  const r=calculate({guests:100,hours:5,distance:t.distance,needsStructure:false,drinks:['caipirinha','moscow','mojito']},base);assert.equal(r.costs.transport,50);
  assert.equal((await resolve('30690-580')).distance,0);
});
test('consulta coordenadas e distância rodoviária, com cache de CEP',async()=>{
  const calls=[];
  const resolve=createTransportResolver(async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('/route/')?{code:'Ok',routes:[{distance:35500}]}:{location:{coordinates:{latitude:'-19.9',longitude:'-44.0'}}}};});
  const t=await resolve('30130-010');assert.equal(t.status,'estimated');assert.equal(t.distance,35.5);assert.equal(calls.length,3);
  const r=calculate({guests:100,hours:5,distance:t.distance,needsStructure:false,drinks:['caipirinha','moscow','mojito']},base);assert.equal(r.costs.transport,81);
  await resolve('30130010');assert.equal(calls.length,4);
});
test('CEP malformado não dispara rede',async()=>{
  for(const cep of ['123','123456789','abcdefgh','https://example.com',12345678])assert.throws(()=>normalizeCep(cep));
  const resolve=createTransportResolver(()=>{throw Error('Não consultar');});await assert.rejects(resolve('abc'));
});
test('serviço indisponível ou sem coordenadas sinaliza revisão',async()=>{
  for(const response of [{ok:false},{ok:true,json:async()=>({location:{coordinates:{}}})},{ok:true,json:async()=>({location:{coordinates:{latitude:null,longitude:''}}})}]){
    const resolve=createTransportResolver(async()=>response);assert.equal((await resolve('30130010')).status,'unavailable');
  }
});
test('falha de rota não é interpretada como distância zero',async()=>{
  const resolve=createTransportResolver(async url=>({ok:true,json:async()=>url.includes('/route/')?{code:'NoRoute'}:{location:{coordinates:{latitude:-20,longitude:-44}}}}));
  assert.deepEqual(await resolve('30130010'),{distance:null,status:'unavailable',cep:'30130010'});
});
