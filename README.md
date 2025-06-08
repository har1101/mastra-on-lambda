# Mastra on Lambda

AWS Lambda関数として動作するMastraエージェントのプロジェクトです。

## プロジェクト構成

```
mastra-on-lambda/
├── lambda/
│   └── index.ts         # Lambda関数のソースコード
├── dist/                # ビルド成果物（自動生成）
│   └── index.mjs        # esbuildでバンドル済みLambda関数
├── package.json         # プロジェクトの依存関係
├── tsconfig.json        # TypeScriptの設定
└── cdk/                 # AWS CDKプロジェクト
    ├── lib/
    │   └── cdk-stack.ts # CDKスタック定義
    └── layer/           # Lambda Layer用の依存関係
        └── nodejs/
            └── package.json
```

### ディレクトリの役割

1. **`/lambda/`**
   - TypeScriptソースコードの格納場所
   - 開発時にコードを編集する場所

2. **`/dist/`（ビルド時に自動生成）**
   - esbuildによるビルド成果物の出力先
   - `index.mjs`: ES Module形式にトランスパイルされたLambda関数
   - CDKはここからLambda関数コードをデプロイ

3. **`/cdk/layer/nodejs/`**
   - Lambda Layerの依存関係を格納
   - `@mastra/core`, `@mastra/mcp`, `@ai-sdk/amazon-bedrock`などを含む
   - CDKが自動的にLayerとしてパッケージング

### ビルドとデプロイのフロー

```
開発時:
/lambda/index.ts → [esbuild] → /dist/index.mjs

デプロイ時:
/dist/index.mjs → Lambda関数本体
/cdk/layer/nodejs/ → Lambda Layer（依存関係）
```

## 機能

- **Lambda関数**: Mastraエージェントを実行し、AIエージェントに関する質問に日本語で回答
- **MCP統合**: Brave Search MCPサーバーを使用してWeb検索機能を提供
- **Lambda Layer**: `@mastra/core`、`@mastra/mcp`、`@ai-sdk/amazon-bedrock`、`@modelcontextprotocol/server-brave-search`の依存関係を含む
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

2. **Lambda関数をビルド**
   ```bash
   npm run build
   ```
   これにより`dist/index.mjs`（ES Module形式のLambda関数）が生成されます。

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

8. **Brave Search API Keyを設定（デプロイ後）**
   AWSコンソールでLambda関数の環境変数を設定：
   - キー: `BRAVE_API_KEY`
   - 値: https://api.search.brave.com/ で取得したAPIキー

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

### カスタム質問で実行（Web検索機能を使用）
```bash
aws lambda invoke \
  --function-name MastraLambda \
  --cli-binary-format raw-in-base64-out \
  --payload '{"question": "2024年のAI技術のトレンドについて教えて"}' \
  response.json

cat response.json
```

## 削除方法

```bash
cd cdk
cdk destroy
```

## 注意事項

- Lambda関数のタイムアウトは300秒、メモリは1024MBに設定
- Bedrock利用にはリージョンとモデルのアクセス権限が必要
- **Brave Search機能を使用する場合**: デプロイ後にAWSコンソールで`BRAVE_API_KEY`環境変数を設定する必要があります
- MCPサーバーがLambda Layer内で実行されるため、初回実行時に少し時間がかかる場合があります
- Lambda Layerの更新時は`cdk/layer/nodejs`内で`npm install`を再実行してください
- TypeScriptの型チェックとesbuildのビルドターゲットは両方ES2022に設定されています

## 開発時の注意

### Lambda関数の更新
Lambda関数のコード（`lambda/index.ts`）を変更した場合：
```bash
# プロジェクトルートで
npm run build
cd cdk
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
(cdk synth)
cdk deploy
```