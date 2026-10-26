// Um único fluxo: perguntas, cálculo e envio do pedido.
(() => {
  const form = document.getElementById('quoteForm');
  const dialog = document.querySelector('.quote-dialog');
  const steps = [...form.querySelectorAll('.wizard-step')];
  const title = document.getElementById('wizardTitle');
  const next = document.getElementById('quoteNext');
  const back = document.getElementById('quoteBack');
  const result = document.getElementById('quoteResult');
  const note = document.getElementById('quoteResultNote');
  const status = document.getElementById('quoteStatus');
  const send = document.getElementById('sendQuote');
  const copy = document.getElementById('copyQuote');
  const message = document.getElementById('quoteMessage');
  let current = 0, busy = false, opener, catalog = [], catalogReady = false, revision = 0;
  const selected = () => [...form.querySelectorAll('[name="drinks"]:checked')].map(el => el.value);
  const money = value => value.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

  function show(index, focus = true) {
    current = index;
    steps.forEach((step, i) => { step.hidden = i !== current; });
    title.textContent = steps[current].dataset.title;
    document.getElementById('wizardHint').textContent = steps[current].dataset.hint;
    const final = current === 5;
    dialog.querySelector('.wizard-kicker').textContent = final ? 'Orçamento' : `Passo ${current + 1} de 5`;
    const progress = final ? 100 : (current + 1) * 20;
    dialog.querySelector('.wizard-progress').setAttribute('aria-valuenow', progress);
    dialog.querySelector('.wizard-progress span').style.width = progress + '%';
    back.disabled = current === 0 || busy;
    next.hidden = final;
    next.disabled = busy;
    next.textContent = busy ? 'Calculando…' : current === 4 ? 'Ver estimativa →' : 'Avançar →';
    back.textContent = final ? '← Ajustar pedido' : '← Voltar';
    status.textContent = '';
    if (focus) title.focus();
    dialog.scrollTop = 0;
  }

  function validate(index) {
    if (index === 0) {
      const phone = form.elements.telefone;
      const digits = phone.value.replace(/\D/g,'');
      const valid = /^(?:55)?[1-9][0-9]{9,10}$/.test(digits) && /^[\d\s()+-]+$/.test(phone.value);
      phone.setCustomValidity(valid ? '' : 'Informe um telefone com DDD, como (31) 99999-9999.');
    }
    for (const input of steps[index].querySelectorAll('input,select,textarea')) {
      if (!input.disabled && !input.checkValidity()) {
        show(index); input.reportValidity(); return false;
      }
    }
    if (index === 4 && (!catalogReady || selected().length < 3)) {
      show(index);
      status.textContent = catalogReady ? 'Escolha pelo menos 3 drinks.' : 'Carregue as opções de drinks para continuar.';
      return false;
    }
    return true;
  }

  function updateDrinks() {
    const ids = selected();
    document.getElementById('drinkCount').textContent = `${ids.length} de 6 drinks selecionados${ids.length === 4 ? ' · nossa recomendação' : ''}`;
    form.querySelectorAll('[name="drinks"]').forEach(input => {
      input.disabled = ['caipirinha','moscow'].includes(input.value) || (!input.checked && ids.length >= 6);
    });
  }

  async function loadDrinks() {
    const container = document.getElementById('drinkOptions');
    container.textContent = 'Carregando opções…';
    try {
      const response = await fetch('/api/quote');
      if (!response.ok) throw Error();
      catalog = (await response.json()).drinks;
      container.textContent = '';
      for (const drink of catalog) {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.name = 'drinks'; input.value = drink.id;
        input.checked = ['caipirinha','moscow'].includes(drink.id);
        label.append(input, document.createTextNode(drink.name)); container.append(label);
      }
      catalogReady = true; updateDrinks();
    } catch {
      container.textContent = 'Não foi possível carregar a carta. ';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'button secondary'; retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', loadDrinks); container.append(retry);
    }
  }

  form.addEventListener('input', () => {
    form.elements.telefone.setCustomValidity('');
    revision++;
    send.hidden = true; send.removeAttribute('href'); copy.disabled = true; message.value = '';
    status.textContent = ''; updateDrinks();
  });
  form.elements.semCep.addEventListener('change', () => {
    form.elements.cep.disabled = form.elements.semCep.checked;
    if (form.elements.cep.disabled) form.elements.cep.value = '';
  });
  back.addEventListener('click', () => show(Math.max(0,current - 1)));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || current === 5 || !validate(current)) return;
    if (current < 4) { show(current + 1); return; }
    for (let i = 0; i < 4; i++) if (!validate(i)) return;
    const data = new FormData(form), ids = selected(), requestRevision = revision;
    const payload = {
      guests: Number(data.get('convidados')), hours: Number(data.get('duracao')),
      cep: data.get('semCep') ? null : (String(data.get('cep') || '').trim() || null),
      needsStructure: false, drinks: ids
    };
    busy = true; next.disabled = true; back.disabled = true; next.textContent = 'Calculando…';
    form.setAttribute('aria-busy','true');
    try {
      const response = await fetch('/api/quote', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const quote = await response.json();
      if (requestRevision !== revision) { status.textContent = 'As escolhas mudaram. Clique em Ver estimativa novamente.'; return; }
      if (!response.ok) throw Error(quote.error || 'Não foi possível calcular. Tente novamente.');
      const price = quote.total === null ? `Estimativa parcial: ${money(quote.knownSubtotal)}` : `Estimativa final: ${money(quote.total)}`;
      result.textContent = price;
      note.textContent = quote.total === null ? 'Faltam custos a confirmar. Peça o valor completo pelo WhatsApp.' : 'Sujeita à confirmação da equipe pelo WhatsApp.';
      if (quote.transport.status === 'unavailable') note.textContent += ' Deslocamento a confirmar.';
      const date = data.get('data');
      message.value = [
        'Olá, Mr. DROP! Quero confirmar meu orçamento de consumo livre.',
        `Nome: ${data.get('nome')}`, `Telefone: ${data.get('telefone')}`, `Evento: ${data.get('evento')}`,
        `Local: ${data.get('local')}`, `CEP: ${payload.cep || 'Não informado'}`,
        `Data: ${date ? date.split('-').reverse().join('/') : 'A definir'}`,
        `Convidados: ${payload.guests}`, `Duração: ${payload.hours} horas`,
        `Drinks: ${ids.map(id => catalog.find(drink => drink.id === id).name).join(', ')}`,
        `Observações: ${data.get('observacoes') || 'Nenhuma'}`, price, note.textContent
      ].join('\n');
      send.href = 'https://wa.me/5531992152738?text=' + encodeURIComponent(message.value);
      send.hidden = false; copy.disabled = false; show(5);
    } catch (error) {
      status.textContent = error.message || 'Não foi possível calcular. Tente novamente.';
    } finally {
      busy = false; next.disabled = false; back.disabled = current === 0;
      next.textContent = 'Ver estimativa →'; form.removeAttribute('aria-busy');
    }
  });

  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(message.value); status.textContent = 'Pedido copiado.'; }
    catch { message.closest('details').open = true; message.focus(); message.select(); status.textContent = 'Selecione e copie o pedido.'; }
  });
  function open(event) {
    event.preventDefault(); opener = event.currentTarget;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('quote-modal-open'); show(current);
  }
  document.getElementById('startQuote').addEventListener('click', open);
  document.querySelectorAll('a[href="#orcamento"]').forEach(link => link.addEventListener('click', open));
  dialog.querySelector('.wizard-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('quote-modal-open');
    document.getElementById('startQuote').textContent = 'Continuar meu orçamento →'; opener?.focus();
  });
  show(0,false); loadDrinks();
})();
