import { api } from './api';

export interface McpClientInfo {
  /** Nome que o aplicativo registrou no servidor (pode não ter informado). */
  clientName: string | null;
  /** Host pra onde o navegador volta depois de autorizar/cancelar. */
  redirectHost: string;
}

/**
 * Chamado pela tela de consentimento (app/(auth)/mcp/authorize) já
 * autenticada pelo login normal — cria o authorization code que o Claude
 * troca por um access token em POST /mcp/oauth/token (ver backend/src/mcp/).
 */
export const mcpOAuthService = {
  /**
   * Confere no servidor se o client_id existe e se a redirect_uri é mesmo
   * dele. Os parâmetros da tela vêm da URL, que qualquer um monta à mão: nada
   * do que está nela pode ser exibido como confiável nem usado pra
   * redirecionar antes desta checagem.
   */
  clientInfo: (clientId: string, redirectUri: string) =>
    api
      .get('/mcp/oauth/client', { params: { client_id: clientId, redirect_uri: redirectUri } })
      .then((r) => r.data.data as McpClientInfo),

  consent: (params: { clientId: string; redirectUri: string; codeChallenge: string; codeChallengeMethod: string }) =>
    api.post('/mcp/oauth/consent', params).then((r) => r.data.data as { code: string }),
};
