// CEPs são consultados somente no servidor; não recebe URLs do visitante.
function normalizeCep(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{5}-?\d{3}$/.test(value.trim())) throw Error('Informe um CEP com 8 dígitos ou escolha “Não sei o CEP”.');
  return value.trim().replace('-','');
}
function createTransportResolver(fetcher = fetch) {
  const cache = new Map();
  async function coordinates(cep) {
    const cached = cache.get(cep);
    if(cached && cached.expires > Date.now()) return cached.value;
    const response = await fetcher(`https://brasilapi.com.br/api/cep/v2/${cep}`,{signal:AbortSignal.timeout(5000)});
    if(!response.ok) throw Error('CEP indisponível');
    const data = await response.json(), point = data.location?.coordinates;
    if(!point || point.latitude === '' || point.longitude === '' || point.latitude == null || point.longitude == null) throw Error('CEP sem coordenadas');
    const lat=Number(point.latitude), lon=Number(point.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -34||lat > 6||lon < -74||lon > -28) throw Error('Coordenadas inválidas');
    const value={lat,lon};
    if(cache.size>=500)cache.delete(cache.keys().next().value);
    cache.set(cep,{value,expires:Date.now()+3600000});return value;
  }
  return async function resolveTransport(value,baseCep='30690580') {
    const cep=normalizeCep(value), origin=normalizeCep(baseCep);
    if(!cep)return {distance:null,status:'not_informed',cep:null};
    if(cep===origin)return {distance:0,status:'estimated',cep};
    try {
      const [a,b]=await Promise.all([coordinates(origin),coordinates(cep)]);
      const response=await fetcher(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false&steps=false`,{signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw Error('Rota indisponível');
      const data=await response.json(),meters=data.routes?.[0]?.distance;
      if(data.code!=='Ok'||typeof meters!=='number'||!Number.isFinite(meters)||meters<0||meters>10000000)throw Error('Rota inválida');
      return {distance:Math.round(meters/100)/10,status:'estimated',cep};
    }catch {return {distance:null,status:'unavailable',cep};}
  };
}
module.exports={normalizeCep,createTransportResolver,resolveTransport:createTransportResolver()};
