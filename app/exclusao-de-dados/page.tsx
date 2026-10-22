import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Exclusão de dados | Hadar Gestão", description: "Como desconectar Instagram ou Facebook e solicitar exclusão dos dados no Hadar Gestão." };

export default function DataDeletionPage() {
  return <LegalPage title="Exclusão de dados">
    <p>Estas instruções se aplicam aos dados tratados pelo Hadar Gestão, operado por <strong>HADAR MARKETING COMPANY LTDA</strong>, CNPJ <strong>46.461.097/0001-30</strong>. Você pode solicitar exclusão mesmo sem conseguir entrar no aplicativo.</p>
    <h2>Desconectar Instagram ou Facebook</h2>
    <p>No Gestão, abra <strong>Publicações</strong>, selecione o cliente e use <strong>Desconectar</strong> na conta desejada. O aplicativo remove o token de acesso salvo, cancela as publicações ainda não iniciadas e pausa as séries dessa conexão. Se uma publicação estiver em processamento, aguarde a conclusão e tente novamente.</p>
    <p>Você também pode revogar o acesso do Hadar Gestão nas configurações de apps e sites do Instagram ou nas integrações comerciais do Facebook. Desconectar não apaga o histórico armazenado no Gestão nem remove conteúdo que já está publicado na rede social.</p>
    <h2>Solicitar exclusão dos dados</h2>
    <p>Envie um e-mail para <a href="mailto:contato@agenciahadar.com.br?subject=Exclus%C3%A3o%20de%20dados%20-%20Hadar%20Gest%C3%A3o">contato@agenciahadar.com.br</a>, com o assunto <strong>Exclusão de dados — Hadar Gestão</strong>, informando:</p>
    <ul>
      <li>O e-mail utilizado no Gestão e a empresa ou instância relacionada.</li>
      <li>O nome de usuário do Instagram ou o nome e identificador da página do Facebook, se o pedido envolver uma conexão social.</li>
      <li>Quais dados deseja excluir: conexão e dados recebidos da Meta, mídias, histórico de publicações ou cadastro, por exemplo.</li>
    </ul>
    <p><strong>Não envie senhas, tokens ou chaves de API.</strong> Se precisar de ajuda para identificar a conta, descreva o caso no próprio e-mail.</p>
    <h2>Como o pedido é tratado</h2>
    <p>Confirmaremos a identidade e a autoridade da pessoa solicitante sobre os dados. Após essa confirmação, avaliaremos o alcance do pedido, removeremos os dados cabíveis dos sistemas ativos e informaremos a conclusão ou eventuais limitações legais e operacionais.</p>
    <p>Cópias de segurança deixam de reter os dados conforme seu ciclo de retenção. Registros que precisem ser preservados por obrigação legal ou para resguardar direitos podem permanecer com acesso restrito. A exclusão no Gestão não elimina publicações já existentes no Instagram ou Facebook; sua remoção deve ser feita na própria plataforma.</p>
    <p>Para saber quais dados utilizamos e para quais finalidades, consulte a <Link href="/privacidade">política de privacidade</Link>.</p>
  </LegalPage>;
}
