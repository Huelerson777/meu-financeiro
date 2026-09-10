import { api } from './api';

/**
 * Chamado pela tela de consentimento (app/(auth)/mcp/authorize) já
 * autenticada pelo login normal — cria o authorization code que o Claude
 * troca por um access token em POST /mcp/oauth/token (ver backend/src/mcp/).
 */
export const mcpOAuthService = {
  consent: (params: { clientId: string; redirectUri: string; codeChallenge: string; codeChallengeMethod: string }) =>
    api.post('/mcp/oauth/consent', params).then((r) => r.data.data as { code: string }),
};
