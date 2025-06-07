# Mastra on Lambda

AWS Lambda関数として動作するMastraエージェントのプロジェクトです。

## プロジェクト構成

```
mastra-on-lambda/
├── lambda/
│   └── index.ts         # Lambda関数のハンドラー
├── package.json         # プロジェクトの依存関係
├── tsconfig.json        # TypeScriptの設定
└── cdk/                 # AWS CDKプロジェクト
    ├── lib/
    │   └── cdk-stack.ts # CDKスタック定義
    └── layer/           # Lambda Layer用の依存関係
        └── nodejs/
            └── package.json
```

## 機能

- **Lambda関数**: Mastraエージェントを実行し、AIエージェントに関する質問に日本語で回答
- **Lambda Layer**: `@mastra/core`と`@ai-sdk/amazon-bedrock`の依存関係を含む
- **実行ロール**: Lambda基本実行権限とBedrock Full Accessを持つIAMロール
- **CloudWatch Logs**: ログ保持期間1週間で自動設定

## 前提条件

- Node.js 20.x以上
- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWSアカウントでAmazon Bedrockが有効化されていること

## デプロイ手順

1. **プロジェクトルートで依存関係をインストール**
   ```bash
   npm install
   ```

2. **Lambda関数のTypeScriptをコンパイル**
   ```bash
   cd lambda
   npx tsc
   cd ..
   ```

3. **CDKディレクトリに移動**
   ```bash
   cd cdk
   ```

4. **CDKの依存関係をインストール**
   ```bash
   npm install
   ```

5. **CDKスタックのTypeScriptをコンパイル**
   ```bash
   npm run build
   ```

6. **CDKブートストラップ（初回のみ）**
   ```bash
   cdk bootstrap
   ```

7. **スタックをデプロイ**
   ```bash
   cdk deploy
   ```

## 動作確認

デプロイ後、AWSコンソールまたはAWS CLIでLambda関数を実行できます。

### デフォルトの質問で実行
```bash
aws lambda invoke \
  --function-name MastraLambda \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
```

### カスタム質問で実行
```bash
aws lambda invoke \
  --function-name MastraLambda \
  --cli-binary-format raw-in-base64-out \
  --payload '{"question": "Mastraフレームワークについて教えて"}' \
  response.json

cat response.json
```

## 削除方法

```bash
cd cdk
npx cdk destroy
```

## 注意事項

- Lambda関数のタイムアウトは30秒、メモリは512MBに設定
- Bedrock利用にはリージョンとモデルのアクセス権限が必要
- Lambda Layerの更新時は`layer/nodejs`内で`npm install`を再実行してください

## 開発時の注意

### Lambda関数の更新
Lambda関数のコード（`lambda/index.ts`）を変更した場合：
```bash
cd lambda
npx tsc
cd ../cdk
cdk deploy
```

### Lambda Layerの更新
依存関係を追加・更新した場合：
```bash
cd cdk/layer/nodejs
npm install <新しいパッケージ>
cd ../..
cdk deploy
```

### CDKスタックの更新
インフラ構成（`cdk/lib/cdk-stack.ts`）を変更した場合：
```bash
cd cdk
npm run build
cdk deploy
```