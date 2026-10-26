# Drop Drinks — orçamento em validação

Preserva o site existente. Formulário de 3 a 6 drinks (4 recomendado), cálculo no servidor e WhatsApp com estimativa sujeita à confirmação.

## Testar localmente

Node.js 22 ou superior. Para rodar o site não há dependências adicionais. Para executar os testes do formulário, instale as dependências de desenvolvimento com `npm.cmd install`.

No PowerShell, defina `$env:ADMIN_API_KEY` com uma chave privada longa e execute `npm.cmd start`. Não compartilhe a chave e não a coloque no HTML, Git ou URL. Acesse http://127.0.0.1:3000 e http://127.0.0.1:3000/admin . O comando npm.cmd start carrega .env automaticamente, se existir. Copie .env.example para .env para configurar localmente, sem colocar segredos no Git.

Execute `npm.cmd test` para verificar o algoritmo e os limites.

## Orçamento guiado

O HTML do modal fica diretamente em index.html e quote-ui.js cuida da navegação, cálculo e WhatsApp, sem uma camada extra reorganizando o formulário. script.js contém apenas navegação do site.

São 5 passos: nome e tipo de evento; local e CEP; data e observações; convidados e duração; drinks. A última escolha calcula diretamente e mostra o resultado, sem etapa de revisão. A pergunta de balcão foi retirada por enquanto; o formulário envia needsStructure=false. O preço completo aparece como “Estimativa final: R$ …”; configurações incompletas continuam identificadas como estimativa parcial. Os detalhes do pedido ficam recolhidos, disponíveis para consulta e envio ao WhatsApp.

Enter avança campos de uma linha; Escape fecha. As respostas são preservadas ao fechar e reabrir na mesma página (recarregar limpa as respostas). Campos obrigatórios e mínimo de 3 drinks são validados. Testes de DOM verificam navegação, validação, continuidade e integração com cálculo/WhatsApp; não substituem a conferência visual em navegador real. O modal requer navegador com suporte ao elemento dialog.

## Regras confirmadas

- Bartenders = teto(convidados / 75). Bardecks = teto(convidados / 200). Todos os convidados contam; bardeck não aumenta capacidade de preparar drinks.
- Custo de cada categoria = pessoas × horas da festa × valor/hora. Inicialmente R$ 100/h para ambas; preparação e limpeza incluídas, sem hora adicional. Bartender mantém mínimo de R$ 100/h.
- Transporte = R$ 50 + máximo(0, km de ida − 20) × R$ 2.
- O formulário usa CEP (ou “Não sei o CEP”), sem campo de distância manual. Origem inicial: 30690-580, editável no painel. BrasilAPI CEP v2 fornece coordenadas e OSRM fornece a distância aproximada de carro de ida. Sem CEP, aplica o transporte básico; se a consulta falhar, também usa a base provisória, sinaliza revisão e não libera preço final. CEP inválido deve ser corrigido ou removido. O visitante vê apenas o aviso de estimativa, sem detalhar os custos internos de transporte. A API ignora distâncias enviadas manualmente pelo navegador.
  Referências: https://brasilapi.com.br/docs e https://project-osrm.org/docs/v5.24.0/api/#route-service . Coordenadas de CEP podem ter erros ou representar uma área ampla; não substituem a confirmação do endereço e da rota. Serviços públicos externos podem ficar indisponíveis. Testes automatizados simulam CEP/rota para serem reproduzíveis, incluindo falhas. A consulta real do CEP base retornou endereço e coordenadas; a rota real ainda precisa de validação com eventos conhecidos.
- Quantidade de drinks para orçamento = média simples das taxas dos drinks escolhidos × 6 × horas × bartenders, arredondada para baixo. Montado (bases prontas): 4/10 min; preparado (macerar fruta e outras etapas): 2/10 min. Exemplo: 3 montados e 1 preparado = (4+4+4+2)/4 = 3,5 a cada 10 minutos por bartender. A produção estimada é usada como base de custo conforme a regra do responsável; não é uma promessa de entrega.
- Custo das receitas = quantidade estimada acima × média dos custos por drink das opções escolhidas. Cada opção tem peso igual nas duas médias. Não há campo de consumo por pessoa; convidados influenciam a quantidade de bartenders. Bardecks não são contados na produção. O custo das receitas entra uma vez no subtotal, antes do acréscimo percentual.
- Insumos gerais = convidados × horas × valor geral configurado. Não repetir os mesmos ingredientes/itens nas receitas e nos gerais.
- Aluguel de taças incluído por padrão = convidados × taças por convidado ÷ 12 × preço por dúzia. Valores iniciais: 2 taças por convidado e R$ 17/dúzia. Cálculo proporcional, sem arredondar para dúzias inteiras; por exemplo, 100 convidados = R$ 283,33 de aluguel. Ambos editáveis no painel. Não multiplica pelas horas; não repetir o aluguel nas receitas ou nos insumos gerais. Entra no subtotal antes do acréscimo percentual. Campo vazio é pendência, zero é custo zero explícito.
- Estrutura extra só quando solicitada. Acréscimo = subtotal × percentual; não significa margem sobre o preço de venda.

## Pendências para preço final

Classificação e custo das receitas, custo geral e percentual de acréscimo. Estrutura só gera pendência se solicitada (o formulário atual não solicita). Valores `null` significam desconhecidos, nunca zero. Para extras ou acréscimo sem cobrança, definir explicitamente 0 no painel. O visitante vê um **valor parcial**, não um orçamento completo, enquanto faltar configuração. Taxas e categorias de produção precisam ser validadas pelo responsável. Catálogo inicial inclui opções já presentes no site; referências de nomes clássicos: https://iba-world.com/cocktails/ . Não foram importados custos ou receitas como regra operacional.

## Painel e publicação na Vercel

O painel permite editar parâmetros separados de bartenders e bardecks, classificar receitas e acrescentar drinks. A API exige `Authorization: Bearer` com `ADMIN_API_KEY`; chave fica somente na memória da aba. Login usa HTTPS em produção. Nunca definir a chave com prefixos públicos. O painel é privado por autenticação na API, ainda que sua página de login seja pública.

Com UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN configurados, salvar grava diretamente no Upstash Redis, sem expiração. Cada orçamento lê os valores atuais do banco, sem cache de configurações. Republicar o projeto preserva esses valores. Se o banco ainda estiver vazio, a configuração de config/quote.json aparece como ponto de partida; entre no admin e clique em Salvar para inicializar. Se o Upstash falhar, o site informa indisponibilidade em vez de usar valores antigos silenciosamente. Sem as variáveis, apenas fora da Vercel existe modo local, que salva no arquivo. Na Vercel, a falta ou erro das credenciais retorna 503. Use o token Standard (com escrita), não o Read Only. UPSTASH_CONFIG_KEY separa as configurações; valor padrão drop-drinks:quote-config:v1. Para testes, prefira outro banco ou outra chave. As alterações só afetam cálculos novos: pedidos antigos já enviados no WhatsApp não mudam. Em edições simultâneas, vale a última configuração salva.

Antes de publicar: validar parâmetros com o responsável, executar testes, definir ADMIN_API_KEY nos ambientes da Vercel, conferir que arquivos sensíveis não entram no Git e revisar a estimativa com eventos conhecidos. O projeto usa funções Node da Vercel e arquivos estáticos. O comando `node build.js` prepara somente os arquivos públicos em public/; as configurações ficam fora dessa pasta. Não publicar como site somente estático, pois o cálculo depende de /api/quote.

Nenhum deploy foi realizado. O link público com algoritmo depende da autorização para publicação. Prazo original do roadmap: 26/10/2026.

## Configurar Upstash e Vercel

1. Criar um banco Redis Free na própria conta Upstash (não usar banco temporário de demonstração). Copiar REST URL e REST Token Standard do painel. Referência: https://upstash.com/docs/redis/features/restapi . Não enviar credenciais no chat.
2. No terminal PowerShell desta pasta, vincular o projeto existente e cadastrar as variáveis interativamente. Ao executar link, selecionar o projeto Drop Drinks existente; não criar outro por engano.

```powershell
npx vercel login
npx vercel link
npx vercel env add UPSTASH_REDIS_REST_URL production
npx vercel env add UPSTASH_REDIS_REST_TOKEN production --sensitive
npx vercel env add ADMIN_API_KEY production --sensitive
npx vercel env add UPSTASH_CONFIG_KEY production
```

Fornecer a URL e token do Upstash nos prompts apropriados. ADMIN_API_KEY é uma senha independente do token do banco; usar pelo menos 32 caracteres aleatórios gerados por um gerenciador de senhas. Para UPSTASH_CONFIG_KEY, usar drop-drinks:quote-config:v1. Se a variável já existir, atualizar pelo painel Vercel em vez de criar duplicata. Não definir segredos com prefixos públicos nem passar valores na linha de comando. Referência dos comandos: https://vercel.com/docs/cli/env . Configurar Preview separadamente, com banco/chave de testes; não compartilhar o armazenamento de produção com testes.

3. Conferir o projeto sem publicar:

```powershell
npm.cmd ci
node build.js
```

4. Quando decidir publicar por conta própria, executar `npx vercel --prod`. Esse comando publica de verdade; não foi executado pelo assistente. Após publicar, entrar em /admin, conferir os valores e Salvar configurações. Reabrir o painel para confirmar a leitura do banco. Alterações posteriores não exigem novo deploy.

Para testar localmente com Upstash, se .env ainda não existir:

```powershell
if (!(Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Editar .env no editor, preencher as variáveis e escolher UPSTASH_CONFIG_KEY=drop-drinks:quote-config:dev (ou outro banco de testes). Executar `npm.cmd start`. Se o terminal já tiver ADMIN_API_KEY definida, ela tem prioridade sobre .env; usar a mesma senha ou fechar e reabrir o terminal.

Segurança revisada: token do Upstash só no servidor e no cabeçalho Authorization; destino restrito a HTTPS de Upstash sem redirecionamento; configuração completa exige API key; erros externos são genéricos; .env ignorado pelo Git; apenas arquivos públicos são copiados para publicação; API pública não retorna receitas, custos individuais ou credenciais, nem subtotal de custos quando já existe preço final. O build aplica validação de configuração e bloqueia arquivos inesperados na raiz pública. Cabeçalhos na Vercel restringem scripts ao próprio site e impedem enquadramento por outros sites. O banco armazena somente parâmetros de cálculo, sem nomes ou telefones de clientes. A revisão local e a simulação do banco não substituem validação da conexão real após cadastrar as credenciais.
