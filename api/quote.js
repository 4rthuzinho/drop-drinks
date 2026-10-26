const crypto = require('node:crypto');
const {calculate,validateConfig} = require('../lib/quote');
const {resolveTransport,normalizeCep} = require('../lib/transport');
const {readSettings,saveSettings} = require('../lib/settings');
function authorized(req) {
  const expected = process.env.ADMIN_API_KEY;
  const header = req.headers.authorization || '';
  if (!expected || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const digest = value => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(header.slice(7)),digest(expected));
}
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const admin = req.query?.admin === '1' || new URL(req.url,'http://localhost').searchParams.get('admin') === '1';
  try {
    if(admin) {
      if (!authorized(req)) return res.status(401).json({error:'Chave inválida ou acesso administrativo não configurado.'});
      if(req.method === 'GET') return res.json({...await readSettings(),canSave:true});
      if(req.method === 'PUT') {
        const config = validateConfig(req.body);
        const storage = await saveSettings(config);
        return res.json({saved:true,storage});
      }
    } else {
      const {config:c} = await readSettings();
      if(req.method === 'GET') return res.json({drinks:c.drinks.map(({id,name})=>({id,name}))});
      if(req.method === 'POST') {
        const input = {...req.body,distance:null};
        calculate(input,c); // Valida antes de consultar serviços externos.
        try {normalizeCep(input.cep);}catch(e){return res.status(400).json({error:e.message});}
        const transport = await resolveTransport(input.cep,c.baseCep || '30690580');
        const r = calculate({...input,distance:transport.distance},c);
        const unavailable = transport.status === 'unavailable';
        const total = unavailable ? null : r.total;
        return res.json({bartenders:r.bartenders,bardecks:r.bardecks,total,pending:r.pending.length>0||unavailable,knownSubtotal:total === null ? r.knownSubtotal : undefined,capacity:r.capacity,version:r.version,transport:{status:transport.status}});
      }
    }
    res.setHeader('Allow',admin?'GET, PUT':'GET, POST');
    return res.status(405).json({error:'Método não permitido.'});
  } catch(e) {return res.status(e.status === 503 ? 503 : 400).json({error:e.status === 503 ? 'Armazenamento indisponível. Tente novamente ou fale com a equipe.' : 'Confira os dados e a configuração do orçamento.'});}
};
