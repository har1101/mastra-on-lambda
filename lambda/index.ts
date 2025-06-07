import { Handler } from 'aws-lambda';
import { Agent } from '@mastra/core/agent';
import { bedrock } from '@ai-sdk/amazon-bedrock';

interface LambdaEvent {
    question?: string;
}

export const handler: Handler<LambdaEvent> = async (event): Promise<Record<string, any>> => {
    // デフォルトの質問
    const question = event.question || 'AIエージェントって何?';
    
    const agent = new Agent({
        name: 'Mastra',
        model: bedrock('anthropic.claude-3-5-sonnet-20240620-v1:0'),
        instructions: 'あなたはAIエージェントです。ユーザーからの質問に対し、日本語でフレンドリーな回答をお願いします。',
    });

    const response = await agent.generate(question);

    return {
        question: question,
        message: response.text,
    };
};