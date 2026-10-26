const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('./api/quote');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
const server = http.createServer(async(req,res)=>{
  const url = new URL(req.url,'http://localhost');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(url.pathname === '/api/quote') {
    res.status = code => {res.statusCode=code;return res;};
    res.json = data => {res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
    let body='';
    try {
      for await(const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>65536) return res.status(413).json({error:'Arquivo muito grande.'});}
      req.body=body?JSON.parse(body):null;
      return handler(req,res);
    }catch {return res.status(400).json({error:'JSON inválido.'});}
  }
  const name = url.pathname === '/' ? 'index.html' : url.pathname === '/admin' ? 'admin.html' : url.pathname.slice(1);
  if(!['index.html','admin.html','script.js','quote-ui.js','admin.js','style.css'].includes(name) && !/^images\/[a-z0-9-]+\.png$/.test(name)) {res.writeHead(404);return res.end('Não encontrado');}
  try {const data=fs.readFileSync(path.join(__dirname,name));res.setHeader('Content-Type',types[path.extname(name)]);res.end(data);} catch {res.writeHead(404);res.end('Não encontrado');}
});
if(require.main===module) server.listen(process.env.PORT||3000,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:3000'));
module.exports=server;
