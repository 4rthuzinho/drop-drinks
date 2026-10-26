const fs=require('node:fs');
require('./lib/quote').validateConfig(JSON.parse(fs.readFileSync('config/quote.json','utf8')));
fs.mkdirSync('public',{recursive:true});
for(const file of ['index.html','admin.html','style.css','script.js','quote-ui.js','admin.js']) fs.copyFileSync(file,'public/'+file);
fs.cpSync('images','public/images',{recursive:true});
// Não publique arquivos inesperados deixados por builds antigos.
const allowed=new Set(['index.html','admin.html','style.css','script.js','quote-ui.js','admin.js','images']);
for(const entry of fs.readdirSync('public')) if(!allowed.has(entry)) throw Error('Arquivo inesperado na pasta pública; revise antes de publicar.');
console.log('Arquivos públicos preparados. Configuração e código do servidor ficam fora da pasta pública.');
