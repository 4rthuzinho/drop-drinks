const {test}=require('node:test');
const assert=require('node:assert/strict');
const server=require('../server');
const {calculate}=require('../lib/quote');
const config=require('../config/quote.json');
test('HTTP: cálculo, autenticação e isolamento de arquivos privados',async()=>{
  const envNames=['ADMIN_API_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','UPSTASH_CONFIG_KEY','VERCEL'];
  const originalEnv=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
  envNames.forEach(name=>delete process.env[name]);
  const originalFetch=global.fetch;
  process.env.ADMIN_API_KEY='test-key-only';
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try {
    assert.equal((await fetch(url+'/')).status,200);
    assert.equal((await fetch(url+'/admin')).status,200);
    assert.equal((await fetch(url+'/config/quote.json')).status,404);
    assert.equal((await fetch(url+'/.env')).status,404);
    assert.equal((await fetch(url+'/lib/settings.js')).status,404);
    assert.equal((await fetch(url+'/api/quote?admin=1')).status,401);
    assert.equal((await fetch(url+'/api/quote?admin=1',{headers:{Authorization:'Bearer wrong'}})).status,401);
    const admin=await fetch(url+'/api/quote?admin=1',{headers:{Authorization:'Bearer test-key-only'}});
    assert.equal(admin.status,200);assert.equal((await admin.json()).config.hourlyBardeck,100);
    const catalog=await (await fetch(url+'/api/quote')).json();assert.ok(catalog.drinks.length>=6);assert.equal(catalog.drinks[0].costPerDrink,undefined);
    const response=await fetch(url+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guests:500,hours:7,distance:20,needsStructure:false,drinks:['caipirinha','moscow','mojito']})});
    const expected=calculate({guests:500,hours:7,distance:null,needsStructure:false,drinks:['caipirinha','moscow','mojito']},config);
    assert.equal(response.status,200);const q=await response.json();assert.equal(q.bartenders,expected.bartenders);assert.equal(q.bardecks,expected.bardecks);assert.equal(q.total,expected.total);assert.equal(q.knownSubtotal,expected.total === null ? expected.knownSubtotal : undefined);
    assert.equal(q.transport.status,'not_informed');
    const invalidCep=await fetch(url+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guests:100,hours:5,cep:'123',needsStructure:false,drinks:['caipirinha','moscow','mojito']})});assert.equal(invalidCep.status,400);
    const sameCep=await fetch(url+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guests:100,hours:5,cep:'30690-580',distance:9999,needsStructure:false,drinks:['caipirinha','moscow','mojito']})});const same=await sameCep.json();assert.equal(same.transport.status,'estimated');assert.equal(same.knownSubtotal,calculate({guests:100,hours:5,distance:0,needsStructure:false,drinks:['caipirinha','moscow','mojito']},config).knownSubtotal);
    assert.equal((await fetch(url+'/api/quote',{method:'POST',body:'{'})).status,400);
    assert.equal((await fetch(url+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guests:-1})})).status,400);
    process.env.VERCEL='1';
    const save=await fetch(url+'/api/quote?admin=1',{method:'PUT',headers:{Authorization:'Bearer test-key-only','Content-Type':'application/json'},body:JSON.stringify(config)});assert.equal(save.status,503);
    // Banco simulado: nenhuma credencial real nem conexão externa neste teste.
    let stored=null,fail=false;
    process.env.UPSTASH_REDIS_REST_URL='https://test-only.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN='upstash-test-secret';
    process.env.UPSTASH_CONFIG_KEY='test:quote';
    global.fetch=async(input,options)=>{
      if(input!=='https://test-only.upstash.io')return originalFetch(input,options);
      assert.equal(options.redirect,'error');
      assert.equal(options.headers.Authorization,'Bearer upstash-test-secret');
      const args=JSON.parse(options.body);assert.equal(args[1],'test:quote');
      if(fail)return {ok:false};
      if(args[0]==='GET')return {ok:true,json:async()=>({result:stored})};
      assert.equal(args[0],'SET');assert.equal(args.length,3);stored=args[2];
      return {ok:true,json:async()=>({result:'OK'})};
    };
    const auth={Authorization:'Bearer test-key-only','Content-Type':'application/json'};
    const initial=await (await fetch(url+'/api/quote?admin=1',{headers:auth})).json();
    assert.equal(initial.storage,'upstash');assert.equal(initial.initialized,false);
    const changed={...config,markupPercent:10,generalPerGuestHour:0};
    const saved=await fetch(url+'/api/quote?admin=1',{method:'PUT',headers:auth,body:JSON.stringify(changed)});
    assert.equal(saved.status,200);assert.equal((await saved.json()).storage,'upstash');
    const loaded=await (await fetch(url+'/api/quote?admin=1',{headers:auth})).json();
    assert.equal(loaded.config.markupPercent,10);assert.equal(loaded.initialized,true);
    const publicResult=await fetch(url+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guests:100,hours:5,needsStructure:false,drinks:['caipirinha','moscow','mojito']})});
    const publicBody=await publicResult.text();
    assert.equal(JSON.parse(publicBody).total,calculate({guests:100,hours:5,distance:null,needsStructure:false,drinks:['caipirinha','moscow','mojito']},changed).total);
    assert.equal(publicBody.includes('upstash-test-secret'),false);assert.equal(publicBody.includes('glassRentalPerDozen'),false);assert.equal(publicBody.includes('knownSubtotal'),false);
    fail=true;
    const unavailable=await fetch(url+'/api/quote');assert.equal(unavailable.status,503);
    assert.equal((await unavailable.text()).includes('upstash-test-secret'),false);
    assert.equal(require('../config/quote.json').markupPercent,config.markupPercent);
  } finally {
    global.fetch=originalFetch;
    for(const name of envNames) {if(originalEnv[name]===undefined)delete process.env[name];else process.env[name]=originalEnv[name];}
    await new Promise(resolve=>server.close(resolve));
  }
});
