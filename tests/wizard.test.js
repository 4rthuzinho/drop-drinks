const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');

async function setup(total=null) {
  const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'http://localhost:3000',runScripts:'outside-only'});
  const w=dom.window, requests=[];
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.fetch=async(url,options)=>{
    if(!options)return {ok:true,json:async()=>({drinks:require('../config/quote.json').drinks.map(({id,name})=>({id,name}))})};
    requests.push(JSON.parse(options.body));
    return {ok:true,json:async()=>({total,knownSubtotal:2050,transport:{status:'not_informed'}})};
  };
  w.eval(fs.readFileSync('quote-ui.js','utf8'));
  await new Promise(resolve=>setImmediate(resolve));
  const d=w.document,form=d.getElementById('quoteForm');
  return {dom,w,d,form,requests,next:()=>d.getElementById('quoteNext').click(),back:()=>d.getElementById('quoteBack').click(),title:()=>d.getElementById('wizardTitle').textContent};
}

function answerParty(s) {
  s.d.getElementById('startQuote').click();
  s.form.elements.nome.value='Ana';s.form.elements.telefone.value='(31) 99999-9999';s.form.elements.evento.value='Casamento';s.next();
  s.form.elements.local.value='Belo Horizonte';
  s.form.elements.semCep.click();assert.equal(s.form.elements.cep.disabled,true);s.next();
  s.next(); // Data e observações opcionais.
  assert.match(s.title(),/tamanho da festa/);
  s.form.elements.convidados.value='160';s.form.elements.duracao.value='5';s.next();
  assert.match(s.title(),/drinks/);
}

test('nome e evento juntos, voltar e reabrir mantêm respostas',async()=>{
  const s=await setup();try{
    s.d.getElementById('startQuote').click();s.next();assert.match(s.title(),/começar/);
    s.form.elements.nome.value='Ana';s.form.elements.telefone.value='(31) 99999-9999';s.next();assert.match(s.title(),/começar/);
    s.form.elements.evento.value='Casamento';s.next();assert.match(s.title(),/Onde/);
    s.back();assert.equal(s.form.elements.nome.value,'Ana');
    s.d.querySelector('.wizard-close').click();assert.equal(s.d.querySelector('dialog').open,false);
    assert.equal(s.d.body.classList.contains('quote-modal-open'),false);
    s.d.querySelector('a[href="#orcamento"]').click();assert.equal(s.d.querySelector('dialog').open,true);
    assert.equal(s.form.elements.nome.value,'Ana');
  }finally{s.dom.window.close();}
});

test('5 passos, drinks por último e cálculo direto sem revisão ou balcão',async()=>{
  const s=await setup();try{
    answerParty(s);
    assert.equal(s.form.elements.estrutura,undefined);
    assert.equal(s.d.querySelector('.wizard-kicker').textContent,'Passo 5 de 5');
    s.next();assert.equal(s.requests.length,0);assert.match(s.d.getElementById('quoteStatus').textContent,/pelo menos 3/);
    s.form.querySelector('input[value="mojito"]').click();s.next();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(s.title(),'Seu orçamento');assert.equal(s.requests.length,1);
    assert.equal(s.requests[0].needsStructure,false);assert.equal(s.requests[0].guests,160);assert.equal(s.requests[0].hours,5);assert.equal(s.requests[0].cep,null);
    assert.match(s.d.getElementById('quoteResult').textContent,/^Estimativa parcial:/);
    assert.match(s.d.getElementById('quoteResultNote').textContent,/Faltam custos/);
    assert.equal(s.d.getElementById('sendQuote').hidden,false);
    assert.match(s.d.getElementById('sendQuote').href,/wa.me\/5531992152738/);
    assert.match(s.d.getElementById('quoteMessage').value,/Ana/);
    assert.ok(s.d.getElementById('quoteMessage').value.includes('Telefone: (31) 99999-9999'));
    assert.equal(s.d.querySelector('details').open,false);
    s.back();assert.match(s.title(),/drinks/);
    s.form.querySelector('input[value="gin"]').click();assert.equal(s.d.getElementById('sendQuote').hidden,true);
  }finally{s.dom.window.close();}
});

test('preço completo tem mensagem final direta',async()=>{
  const s=await setup(2500);try{
    answerParty(s);s.form.querySelector('input[value="mojito"]').click();s.next();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(s.d.getElementById('quoteResult').textContent.replace(/\s/g,' '),'Estimativa final: R$ 2.500,00');
    assert.equal(s.d.getElementById('quoteNext').hidden,true);
    assert.equal(s.d.getElementById('quoteBack').disabled,false);
  }finally{s.dom.window.close();}
});

test('telefone obrigatório com DDD permanece no primeiro passo',async()=>{
  const s=await setup();try{
    s.d.getElementById('startQuote').click();
    s.form.elements.nome.value='Ana';s.form.elements.evento.value='Outro';
    for(const value of ['', '12345', 'abcdefghijk']) {
      s.form.elements.telefone.value=value;s.next();assert.match(s.title(),/começar/);
    }
    s.form.elements.telefone.value='+55 (31) 99999-9999';s.next();assert.match(s.title(),/Onde/);
    s.back();assert.equal(s.form.elements.telefone.value,'+55 (31) 99999-9999');
  }finally{s.dom.window.close();}
});

test('convidados e duração são validados juntos antes dos drinks',async()=>{
  const s=await setup();try{
    s.d.getElementById('startQuote').click();
    s.form.elements.nome.value='Ana';s.form.elements.telefone.value='(31) 99999-9999';s.form.elements.evento.value='Outro';s.next();
    s.form.elements.local.value='BH';s.next();s.next();
    s.form.elements.convidados.value='100';s.next();assert.match(s.title(),/tamanho da festa/);
    s.form.elements.duracao.value='-1';s.next();assert.match(s.title(),/tamanho da festa/);
    s.form.elements.duracao.value='4';s.next();assert.match(s.title(),/drinks/);
    assert.equal(s.requests.length,0);
  }finally{s.dom.window.close();}
});
