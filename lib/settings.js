// Apenas o servidor acessa o Upstash. Nenhuma credencial vai para o navegador.
const fs = require('node:fs');
const path = require('node:path');
const {validateConfig} = require('./quote');
const configPath = path.join(__dirname,'../config/quote.json');

function storageError() {
  const error = new Error('Armazenamento indisponível. Confira a conexão e as variáveis do Upstash no servidor.');
  error.status = 503;
  return error;
}
function connection() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token && !process.env.VERCEL) return null;
  if (!url || !token) throw storageError();
  let parsed;
  try { parsed = new URL(url); } catch { throw storageError(); }
  // Evita enviar o token a outro domínio ou em redirecionamentos.
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.upstash\.io$/.test(parsed.hostname) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' || parsed.port) throw storageError();
  const key = process.env.UPSTASH_CONFIG_KEY || 'drop-drinks:quote-config:v1';
  if (!/^[a-zA-Z0-9:_-]{1,120}$/.test(key)) throw storageError();
  return {url:parsed.origin,token,key};
}
async function command(conn, args) {
  try {
    const response = await fetch(conn.url, {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(5000),
      headers:{Authorization:`Bearer ${conn.token}`,'Content-Type':'application/json'},
      body:JSON.stringify(args)
    });
    if (!response.ok) throw storageError();
    const data = await response.json();
    if (data.error || !Object.hasOwn(data,'result')) throw storageError();
    return data.result;
  } catch { throw storageError(); }
}
async function readSettings() {
  const conn = connection();
  if (!conn) return {config:validateConfig(JSON.parse(fs.readFileSync(configPath,'utf8'))),storage:'local',initialized:true};
  const value = await command(conn,['GET',conn.key]);
  if (value === null) return {config:validateConfig(JSON.parse(fs.readFileSync(configPath,'utf8'))),storage:'upstash',initialized:false};
  try { return {config:validateConfig(JSON.parse(value)),storage:'upstash',initialized:true}; }
  catch { throw storageError(); }
}
async function saveSettings(config) {
  validateConfig(config);
  const value = JSON.stringify(config);
  if (Buffer.byteLength(value) > 65536) throw Error('Configuração muito grande.');
  const conn = connection();
  if (conn) {
    // Sem prazo de expiração. Republicar o site não substitui esta configuração.
    if (await command(conn,['SET',conn.key,value]) !== 'OK') throw storageError();
    return 'upstash';
  }
  fs.writeFileSync(configPath+'.tmp',value+'\n');
  fs.renameSync(configPath+'.tmp',configPath);
  return 'local';
}
module.exports = {readSettings,saveSettings};
