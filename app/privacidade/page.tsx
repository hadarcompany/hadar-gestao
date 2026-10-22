import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Política de privacidade | Hadar Gestão", description: "Como o Hadar Gestão utiliza dados e conexões com Instagram e Facebook." };

export default function PrivacyPage() {
  return <LegalPage title="Política de privacidade">
    <p>O Hadar Gestão é operado por <strong>HADAR MARKETING COMPANY LTDA</strong>, CNPJ <strong>46.461.097/0001-30</strong>. Esta política explica o tratamento de dados no aplicativo, incluindo as conexões oficiais com Instagram e Facebook. Para dúvidas ou solicitações sobre dados pessoais, escreva para <a href="mailto:contato@agenciahadar.com.br">contato@agenciahadar.com.br</a>.</p>
    <h2>Dados utilizados no aplicativo</h2>
    <ul>
      <li>Cadastro e acesso: nome, e-mail, identificador de usuário, permissões e informações de sessão necessárias para autenticar e autorizar o uso.</li>
      <li>Gestão: informações de clientes, equipe, tarefas e arquivos inseridos pelos usuários autorizados. Integrações financeiras e de atendimento, quando habilitadas, tratam os dados necessários às respectivas funções.</li>
      <li>Redes sociais: identificadores e nomes dos perfis profissionais ou páginas conectados, informações de perfil disponibilizadas pela plataforma, permissões concedidas e tokens de acesso.</li>
      <li>Publicações: imagens, vídeos, capas, legendas, datas, horários, opções de publicação, aprovações, identificadores do conteúdo publicado e informações de processamento ou falha.</li>
      <li>Relatórios e comentários: métricas de contas e conteúdos e os comentários necessários às funções habilitadas, conforme as permissões que a pessoa responsável conceder na Meta.</li>
    </ul>
    <h2>Conexão com Instagram e Facebook</h2>
    <p>A conexão ocorre nas telas oficiais da Meta. O Gestão recebe a autorização e os tokens necessários; não solicita nem armazena a senha do seu Instagram ou Facebook. A conexão deve ser feita por uma pessoa autorizada a administrar o perfil profissional ou a página.</p>
    <p>Usamos os dados autorizados para identificar as contas conectadas, permitir a seleção do destino, preparar e publicar o conteúdo solicitado e apresentar o estado das publicações. Métricas e comentários são utilizados nas funções correspondentes, quando autorizadas. As postagens podem ser imediatas, agendadas ou recorrentes; a aprovação pelo cliente é uma opção do fluxo.</p>
    <p>Os dados da Meta não são vendidos nem utilizados para montar listas de publicidade de terceiros. Você pode desconectar a conta no Gestão e revogar a autorização nas configurações do Instagram ou Facebook.</p>
    <h2>Finalidades e responsabilidades</h2>
    <p>Tratamos os dados para fornecer o serviço contratado, gerenciar os acessos, executar as ações solicitadas, dar suporte e proteger o funcionamento do aplicativo. A autorização nas plataformas sociais permite as operações específicas escolhidas pelo responsável pela conta. Solicitações e obrigações legais também podem exigir tratamento e conservação de determinados registros.</p>
    <p>Quando uma empresa utiliza sua própria instância do Gestão, ela é responsável pelas informações que insere, pelas permissões de sua equipe e pelas instruções sobre dados dos seus clientes. A Hadar trata esses dados para operar e dar suporte ao serviço, conforme a relação com a empresa.</p>
    <h2>Infraestrutura e compartilhamento</h2>
    <p>Utilizamos provedores de infraestrutura para banco de dados, autenticação, hospedagem e arquivos. A infraestrutura atual inclui Supabase, hospedagem de aplicação na Vercel e servidores VPS. A localização do processamento pode variar conforme o provedor e a instância, inclusive fora do Brasil.</p>
    <p>Ao conectar uma rede e solicitar uma publicação, os dados e arquivos necessários são enviados à Meta. Outras integrações habilitadas recebem os dados necessários às operações solicitadas. O acesso administrativo é destinado à operação e ao suporte do serviço. Dados também podem ser compartilhados quando houver uma obrigação legal aplicável.</p>
    <h2>Armazenamento e proteção</h2>
    <p>O aplicativo usa autenticação, permissões e conexões HTTPS. Os tokens das integrações sociais são criptografados antes de serem armazenados no banco. Essas medidas reduzem riscos; nenhuma infraestrutura elimina todos os riscos de segurança.</p>
    <p>Os registros são mantidos enquanto necessários ao uso do serviço, ao histórico solicitado e às obrigações aplicáveis. No armazenamento de mídias da VPS, os originais elegíveis são removidos após 48 horas da confirmação de todas as publicações que os utilizam. Arquivos referenciados por rascunhos, falhas ou séries ativas podem permanecer necessários e não seguem essa remoção automática. Cópias de backup seguem seu próprio ciclo de retenção.</p>
    <p>Desconectar uma rede remove o token salvo e impede novas publicações por essa conexão, mas preserva o histórico do Gestão. Conteúdos já publicados continuam na rede social até serem removidos nela. O encerramento de um período de teste bloqueia o uso e preserva os dados; ele não equivale a uma solicitação de exclusão.</p>
    <h2>Seus direitos e como solicitar exclusão</h2>
    <p>Você pode solicitar informações sobre o tratamento, acesso, correção e exclusão de dados pessoais, além de revogar autorizações, nos termos aplicáveis. Podemos pedir confirmação da identidade e da autoridade sobre a conta para evitar o atendimento de pedidos indevidos.</p>
    <p>Envie o pedido a <a href="mailto:contato@agenciahadar.com.br">contato@agenciahadar.com.br</a>. Veja as <Link href="/exclusao-de-dados">instruções para desconectar contas e solicitar exclusão</Link>. Dados sujeitos a conservação legal ou necessários para resguardar direitos podem ser mantidos com acesso restrito; informaremos as limitações pertinentes ao pedido.</p>
    <h2>Sessão e atualizações desta política</h2>
    <p>O Gestão utiliza cookies de sessão necessários para manter a autenticação. A política poderá ser atualizada para refletir alterações no serviço e nas integrações. A data no início desta página identifica a versão publicada.</p>
  </LegalPage>;
}
