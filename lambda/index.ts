import { Handler } from 'aws-lambda';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import { bedrock } from '@ai-sdk/amazon-bedrock';

interface LambdaEvent {
    question?: string;
}

const mcp = new MCPClient({
  id: "brave-search-mcp",
  servers: {
    brave_search: {
      command: "node",
      args: ["/opt/nodejs/node_modules/@modelcontextprotocol/server-brave-search/dist/index.js"],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY ?? "",
      },
    }
  }
});

export const handler: Handler<LambdaEvent> = async (event): Promise<Record<string, any>> => {
  // 質問設定、入力がない場合はデフォルト質問
  const question = event.question || 'AIエージェントって何?';
  
  const agent = new Agent({
    name: 'Mastra',
    model: bedrock('apac.anthropic.claude-sonnet-4-20250514-v1:0'),
    instructions: 'あなたはAIエージェントです。ユーザーからの質問に対し、日本語でフレンドリーな回答をお願いします。',
    tools: await mcp.getTools(),
  });

  const response = await agent.generate(question);

  return {
    question: question,
    message: response.text,
  };
};