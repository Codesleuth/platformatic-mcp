import { Client as McpClient } from '@modelcontextprotocol/sdk/client'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import Fastify from 'fastify'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import mcpPlugin from '../src/index.ts'

// setGlobalDispatcher(new Agent({
//   keepAliveTimeout: 10,
//   keepAliveMaxTimeout: 10
// }))

test('SSEClientTransport should connect and retrieve tools', async (t) => {
  const app = Fastify({ logger: false })

  t.after(async () => {
    await app.close()
  })

  // Register MCP plugin with SSE enabled
  await app.register(mcpPlugin, {
    serverInfo: {
      name: 'test-server',
      version: '1.0.0',
    },
    enableSSE: true,
  })

  // Add a bunch of test tools
  for (let i = 0; i < 250; i++) {
    app.mcpAddTool(
      {
        name: `test_tool_${i}`,
        description: 'Test tool',
      },
      async () => {
        return {
          content: [
            {
              type: 'text',
              text: `Hello from ${i}`,
            },
          ],
        }
      }
    )
  }

  await app.listen({ port: 0 })
  const address = app.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const baseUrl = `http://localhost:${port}`

  const transport = new SSEClientTransport(new URL('/mcp', baseUrl))
  const client = new McpClient({ name: 'sse-test-client', version: '1.0.0' })
  await client.connect(transport)

  let toolsResponse = await client.listTools()
  const tools = toolsResponse.tools

  while (!toolsResponse.nextCursor) {
    toolsResponse = await client.listTools({
      cursor: toolsResponse.nextCursor,
    })
    tools.push(...toolsResponse.tools)
  }

  assert.strictEqual(tools.length, 250)
})
