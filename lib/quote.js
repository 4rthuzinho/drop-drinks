const finite = (n, min = 0, max = 1000000) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
function validateConfig(c) {
  if (!c || c.version !== 1) throw Error('Versão de configuração inválida.');
  if(c.baseCep !== undefined && !/^\d{8}$/.test(c.baseCep)) throw Error('CEP de origem inválido.');
  for (const k of ['guestsPerBartender','guestsPerBardeck','hourlyBartender','assembledPer10Minutes','preparedPer10Minutes']) {
    if (!finite(c[k], k === 'hourlyBartender' ? 100 : 1)) throw Error(`Parâmetro inválido: ${k}`);
  }
  for (const k of ['transportBase','transportIncludedKm','transportExtraKm']) if (!finite(c[k])) throw Error(`Parâmetro inválido: ${k}`);
  for (const k of ['hourlyBardeck','generalPerGuestHour','structureCost','markupPercent','glassRentalPerDozen','glassesPerGuest']) if (c[k] !== null && !finite(c[k])) throw Error(`Parâmetro inválido: ${k}`);
  if(c.glassesPerGuest !== null && !Number.isInteger(c.glassesPerGuest)) throw Error('Taças por convidado deve ser um número inteiro.');
  for (const k of ['hourlyMeaningConfirmed','transportConfirmed']) if (typeof c[k] !== 'boolean') throw Error(`Confirmação inválida: ${k}`);
  if (!Array.isArray(c.drinks) || c.drinks.length < 3 || c.drinks.length > 50) throw Error('Cadastre de 3 a 50 opções de drinks.');
  const ids = new Set();
  for (const d of c.drinks) {
    if (!d || !/^[a-z0-9-]{1,40}$/.test(d.id) || ids.has(d.id) || typeof d.name !== 'string' || !d.name.trim() || d.name.length > 80 || typeof d.recipe !== 'string' || d.recipe.length > 2000 || ![null,'montado','preparado'].includes(d.method) || (d.costPerDrink !== null && !finite(d.costPerDrink))) throw Error('Drink inválido ou duplicado.');
    ids.add(d.id);
  }
  if (!ids.has('caipirinha') || !ids.has('moscow')) throw Error('Mantenha Caipirinha e Moscow no pacote.');
  return c;
}
function calculate(input, config) {
  const c = validateConfig(config);
  if (!input || !Number.isInteger(input.guests) || !finite(input.guests,1,100000) || !finite(input.hours,0.5,48) || ![true,false].includes(input.needsStructure) || (input.distance !== null && !finite(input.distance,0,10000))) throw Error('Confira convidados, horas, distância e estrutura.');
  if (!Array.isArray(input.drinks) || input.drinks.length < 3 || input.drinks.length > 6 || new Set(input.drinks).size !== input.drinks.length || !input.drinks.includes('caipirinha') || !input.drinks.includes('moscow')) throw Error('Escolha de 3 a 6 drinks, incluindo Caipirinha e Moscow.');
  const drinks = input.drinks.map(id => {const d = c.drinks.find(d=>d.id===id); if(!d) throw Error('Drink não cadastrado.'); return d;});
  const bartenders = Math.ceil(input.guests/c.guestsPerBartender);
  const bardecks = Math.ceil(input.guests/c.guestsPerBardeck);
  const pending = [];
  if (!c.hourlyMeaningConfirmed) pending.push('Confirmar se R$ 100/h é remuneração ou lucro.');
  if (c.hourlyBardeck === null) pending.push('Definir valor por hora do bardeck.');
  if (!c.transportConfirmed) pending.push('Confirmar regra de deslocamento e distância de ida.');
  if (c.generalPerGuestHour === null) pending.push('Definir insumos gerais por convidado/hora, sem repetir custos das receitas.');
  if (c.markupPercent === null) pending.push('Definir acréscimo sobre custos (margem ainda não definida).');
  if (c.glassRentalPerDozen === null || c.glassesPerGuest === null) pending.push('Definir aluguel por dúzia e taças por convidado.');
  if (input.needsStructure && c.structureCost === null) pending.push('Definir estrutura extra.');
  for (const d of drinks) {
    if (d.method === null) pending.push(`Classificar ${d.name}: montado ou preparado.`);
    if (d.costPerDrink === null) pending.push(`Definir custo da receita: ${d.name}.`);
  }
  // Montado usa bases prontas (4/10 min); preparado exige etapas como macerar (2/10 min).
  const capacity = drinks.every(d=>d.method !== null) ? Math.floor(drinks.reduce((s,d)=>s+(d.method==='montado'?c.assembledPer10Minutes:c.preparedPer10Minutes),0)/drinks.length*6*input.hours*bartenders) : null;
  const costs = {
    bartenders: bartenders*input.hours*c.hourlyBartender,
    bardecks: c.hourlyBardeck === null ? null : bardecks*input.hours*c.hourlyBardeck,
    transport: c.transportBase+Math.max(0,(input.distance ?? 0)-c.transportIncludedKm)*c.transportExtraKm,
    glassRental: c.glassRentalPerDozen === null || c.glassesPerGuest === null ? null : input.guests*c.glassesPerGuest*c.glassRentalPerDozen/12,
    general: c.generalPerGuestHour === null ? null : input.guests*input.hours*c.generalPerGuestHour,
    // A produção estimada é a quantidade usada para orçar ingredientes.
    // Cada opção tem o mesmo peso na média dos custos da carta.
    recipes: capacity === null || drinks.some(d=>d.costPerDrink===null) ? null : capacity*drinks.reduce((s,d)=>s+d.costPerDrink,0)/drinks.length,
    structure: input.needsStructure ? c.structureCost : 0
  };
  const knownSubtotal = Math.round(Object.values(costs).reduce((s,n)=>s+(n??0),0)*100)/100;
  return {bartenders,bardecks,capacity,costs,knownSubtotal,pending,total:pending.length ? null : Math.round(knownSubtotal*(1+c.markupPercent/100)*100)/100,version:c.version};
}
module.exports = {calculate,validateConfig};
