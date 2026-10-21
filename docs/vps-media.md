# Vídeos na VPS

PostgreSQL e autenticação continuam no Supabase. Este serviço guarda apenas JPEG
(8 MiB) e MP4 (200 MiB); não transforma nem recodifica vídeos. A assinatura do R2
não é necessária. O plano e o tráfego contratado da VPS continuam aplicáveis.

O navegador envia partes de 8 MiB diretamente ao serviço HTTPS, sem passar os
200 MiB por uma função da Vercel. Cada parte pode ser repetida com o mesmo conteúdo.
Depois da montagem e conferência de tamanho e cabeçalho, o objeto é imutável.
A conferência de cabeçalho não garante codec/duração aceitos pela Meta.

## Instalação

1. Fazer e verificar backup do banco antes de aplicar a migração aditiva por
   `npm run social:prepare -- --project-ref=REF --apply`. Nunca usar db push/seed
   em produção. O preparo preserva o bucket Supabase privado para arquivos antigos.
2. Criar usuário sem login `hadar-media`, diretórios `/opt/hadar-media`,
   `/etc/hadar-media` e `/srv/hadar-media`. Código root:root sem escrita pelo serviço;
   dados e chave legíveis somente pelo usuário do serviço (config 600, dados 700).
3. Copiar server.py e a unidade systemd; confirmar o gateway da rede do Caddy
   antes de definir `--bind`. A porta 8091 deve aceitar apenas a rede privada do
   proxy. Nunca publicar esta porta na interface externa da VPS.
4. DNS A `midia.agenciahadar.com.br` → IP da VPS. Adicionar um host separado ao
   Caddy, com TLS automático, `request_body { max_size 9MB }` e
   `reverse_proxy 172.18.0.1:8091` com transporte HTTP limitado a quatro conexões
   por host e keepalive desativado. Autorizar no firewall apenas o IP privado do
   Caddy pela interface da bridge; conferir essa regra se recriar o container.
   Não habilitar logs com query strings: URLs de
   leitura incluem credenciais temporárias. Preservar os demais hosts.
5. Configurar `SOCIAL_MEDIA_PROVIDER=VPS`, `SOCIAL_VPS_MEDIA_URL`,
   `SOCIAL_VPS_MEDIA_INSTANCE=hadar`, `SOCIAL_VPS_MEDIA_SECRET` (32+ caracteres),
   `SOCIAL_STORAGE_LIMIT_MB=5120` e `SOCIAL_MEDIA_CLEANUP_ENABLED=true` na hospedagem
   da Hadar. A mesma chave vai no arquivo privado indicado pelo serviço. Não mudar
   as chaves de criptografia de integrações/Meta já utilizadas.
6. Configuração inicial: Hadar 5 GiB, limite global 10 GiB e piso de disco livre
   de 10 GiB. Montagem pode ocupar uma segunda cópia temporária. O serviço limita
   a quatro conexões simultâneas e roda com teto de RAM de 256 MiB. Conferir carga
   real antes de adicionar instâncias, quotas e usuários.

## Retenção e recuperação

O worker faz a limpeza mesmo com a publicação automática desativada. Remove o
original somente 48 horas depois que **todas** as publicações que o referenciam
forem confirmadas. Rascunhos, agendamentos, falhas, resultados incertos e cancelados
retêm o arquivo. Envios não confirmados expiram após 24 horas. Arquivos disponíveis
sem publicação ficam preservados; um administrador pode avaliar seu descarte
futuramente. A quota só é liberada após exclusão física confirmada.

A transação que anexa mídia e a que inicia exclusão usam a mesma trava do banco.
Uma mídia em exclusão não pode ganhar uma nova referência. Falhas de exclusão são
repetidas; o histórico de postagem e os metadados da mídia ficam no banco.

Backups SQL seguem diários, verificados por restauração. Para incluir vídeos,
configurar `localMediaDirectory=/srv/hadar-media/hadar` no backup da Hadar.
Cada arquivo concluído é cifrado uma vez, com SHA-256 conferido após decifrar.
Os manifestos dos backups diários referenciam esses blobs `.hgm` compartilhados;
as cópias permanecem enquanto algum backup retido as referencia (14 dias na VPS,
30 dias nas cópias do Windows). O descarte do original após 48 horas não apaga
imediatamente as cópias dos backups. Limite separado padrão de backup de mídia:
20 GiB, além do piso de disco de 10 GiB; exceder interrompe o backup com status de
falha, sem apagar dados ativos. Conferir o status diariamente.

Para recuperar, decifrar o `.hgb` do banco com a ferramenta de recuperação existente;
`manifest.json.localMediaObjects` lista os `.hgm` necessários, hash original, MIME,
caminho e tamanho. A ferramenta `decrypt-backup.mjs` também decifra cada `.hgm`
para um arquivo de destino. Reconstruir os diretórios pelo SHA-256 do caminho e
o manifest.json no spool, conferindo hash e bytes antes de religar o serviço.
Envios parciais não entram no backup. Não restaurar nem sobrescrever produção
sem um plano específico de recuperação.

## Verificação

`python tests/media-server_test.py` testa HTTP real, ticket inválido/expirado,
origem, quota, tipo, partes incompletas/repetidas, imutabilidade, Range/HEAD e um
arquivo sintético de 200 MiB com hash de ponta a ponta. Este teste não publica
conteúdo na Meta e não substitui o teste final com uma conta profissional.
