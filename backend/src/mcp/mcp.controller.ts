import { Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpTokenGuard } from './mcp-token.guard';
import { McpToolsService } from './mcp-tools.service';

/**
 * Endpoint MCP em si (JSON-RPC via Streamable HTTP), protegido pelo access
 * token OAuth (ver mcp-token.guard.ts). Fica fora do prefixo `/api` (ver
 * main.ts) — igual a mcp-oauth.controller.ts.
 *
 * Modo stateless: um `Server`+`StreamableHTTPServerTransport` novo por
 * requisição, sem sessão nem stream de servidor — cabível aqui porque cada
 * chamada de tool é independente (sem necessidade de contexto entre
 * chamadas) e evita ter que guardar estado de conexão em memória entre
 * requisições de um serviço Render com múltiplas instâncias.
 */
@ApiExcludeController()
@UseGuards(McpTokenGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly toolsService: McpToolsService) {}

  @Post()
  async handlePost(@Req() req: Request & { mcpUserId: string }, @Res() res: Response) {
    const server = this.buildServer(req.mcpUserId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  // Modo stateless: não há stream de servidor pra reabrir nem sessão pra
  // encerrar — a spec permite responder 405 pra GET/DELETE nesse caso.
  @Get()
  @HttpCode(405)
  handleGet() {
    return { error: 'method_not_allowed', error_description: 'Servidor MCP stateless — sem stream de servidor' };
  }

  @Delete()
  @HttpCode(405)
  handleDelete() {
    return { error: 'method_not_allowed', error_description: 'Servidor MCP stateless — sem sessão pra encerrar' };
  }

  private buildServer(userId: string): Server {
    const server = new Server({ name: 'poupay', version: '1.0.0' }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolsService.listToolDefinitions(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.toolsService.callTool(userId, request.params.name, (request.params.arguments as Record<string, unknown>) ?? {}),
    );

    return server;
  }
}
