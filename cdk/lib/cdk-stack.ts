import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda実行ロール
    const lambdaRole = new iam.Role(this, 'MastraLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
    });

    // Bedrock アクセス権限を追加
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: ['*']
    }));

    // CloudWatch Logsグループ
    const logGroup = new logs.LogGroup(this, 'MastraLambdaLogGroup', {
      logGroupName: '/aws/lambda/mastra-lambda',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Layer
    const dependenciesLayer = new lambda.LayerVersion(this, 'MastraDependenciesLayer', {
      code: lambda.Code.fromAsset('./layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'mastra, ai-sdk, mcp dependencies',
    });

    // Lambda関数
    const mastraLambda = new lambda.Function(this, 'MastraLambda', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist', {
        exclude: ['layer.zip', 'handler.zip', 'layer/**']
      }),
      role: lambdaRole,
      layers: [dependenciesLayer],
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      environment: {
        NODE_ENV: 'production',
        BRAVE_API_KEY: 'put-your-brave-api-key',
      },
      logGroup: logGroup,
    });
  }
}
