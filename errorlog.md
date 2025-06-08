# エラーログと対処法

## エラー1: ES Module互換性エラー

### 発生日時
2025-06-07T07:26:14.045Z

### エラー内容
```
ERROR Uncaught Exception {
    "errorType": "Error",
    "errorMessage": "require() of ES Module /opt/nodejs/node_modules/exit-hook/index.js from /opt/nodejs/node_modules/@mastra/mcp/dist/index.cjs not supported.
    Instead change the require of index.js in /opt/nodejs/node_modules/@mastra/mcp/dist/index.cjs to a dynamic import() which is available in all CommonJS modules.",
    "code": "ERR_REQUIRE_ESM"
}
```

### 原因
`@mastra/mcp`パッケージが内部で`exit-hook`というES Module形式のパッケージを使用しているが、Lambda環境でCommonJS形式でrequireしようとしているため、互換性エラーが発生。

### 解決方法
Lambda関数全体をES Module形式に変更：

1. **package.json**に`"type": "module"`を追加
2. **lambda/tsconfig.json**のmoduleを`"ES2022"`に変更
3. **ビルドスクリプト**に以下を追加：
   - `--format=esm`（ES Module形式で出力）
   - `--target=es2022`
   - `@mastra/mcp`を`--external`に追加
4. **レイヤーのpackage.json**のtypeを`"module"`に変更

## エラー2: Lambda実行時のES Module認識エラー

### 発生日時
2025-06-07T07:40:47.425Z

### エラー内容
```
ERROR (node:2) Warning: Failed to load the ES module: /var/task/index.js. 
Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.

ERROR Uncaught Exception {
    "errorType": "Runtime.UserCodeSyntaxError",
    "errorMessage": "SyntaxError: Cannot use import statement outside a module"
}
```

### 原因
Lambdaランタイムが`index.js`をES Moduleとして認識できていない。Lambda実行環境（`/var/task/`）に`package.json`が存在しないため。

### 解決方法
ファイル拡張子を`.mjs`に変更：

1. **ビルドスクリプト**の出力を`index.js`から`index.mjs`に変更
   ```json
   --outfile=dist/index.mjs
   ```

2. **CDKスタック**のコードソースを変更：
   ```typescript
   code: lambda.Code.fromAsset('../dist', {
     exclude: ['layer.zip', 'handler.zip', 'layer/**']
   })
   ```

### 結果
- `.mjs`拡張子により、Node.jsが自動的にES Moduleとして認識
- package.json不要で確実に動作
- ソースコードとビルド成果物が分離され、より整理された構成に

## エラー3: MCP Server接続エラー

### 発生日時
2025-06-07T08:00:00Z（推定）

### エラー内容
```
ERROR {
  "errorType": "Error",
  "errorMessage": "Failed to connect to MCP server brave_search: McpError: MCP error -32000: Connection closed",
  "trace": [
    "Error: Failed to connect to MCP server brave_search: McpError: MCP error -32000: Connection closed",
    "    at Client._onclose (file:///opt/nodejs/node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js:97:23)",
    "    at ChildProcess.<anonymous> (file:///opt/nodejs/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js:90:77)",
    "    at ChildProcess.emit (node:events:518:28)"
  ]
}
```

### 原因

1. **npxコマンドが利用できない詳細理由**
   - **npmツールチェインの不在**: Lambda Layer（`/opt/nodejs/`）にはnpmパッケージの実行ファイルのみが含まれ、npm/npx等のツールチェインは含まれない
   - **Lambda実行環境の制約**: Lambda関数の実行環境（`/var/task/`）には最小限のNode.jsランタイムのみが提供される
   - **npxの仕組み**: npxは通常、ローカルの`node_modules/.bin/`やグローバルインストールされたツールを実行するが、Lambda環境にはこれらが存在しない
   - **パス解決の問題**: npxが依存するPATH環境変数やnode_modules解決機構がLambda環境では制限されている

2. **子プロセス制約の詳細**
   - **実行権限**: Lambda環境では子プロセスの実行に制限があり、外部コマンドの実行が不安定
   - **環境変数の継承**: 子プロセスへの環境変数継承が期待通りに動作しない場合がある
   - **プロセス管理**: Lambda関数の短いライフサイクル内で子プロセスを適切に管理することが困難

3. **パッケージ不足**: `@modelcontextprotocol/server-brave-search`がLambda Layerに含まれていない

### なぜnodeコマンドで代替したか

1. **直接実行の確実性**
   - `node`コマンドはLambdaランタイムに標準で含まれているため、確実に利用可能
   - パッケージマネージャーに依存せず、直接JavaScriptファイルを実行

2. **明示的なパス指定**
   ```typescript
   // 問題のあった方法（npx使用）
   command: "npx",
   args: ["@modelcontextprotocol/server-brave-search"]
   
   // 解決方法（node直接実行）
   command: "node",
   args: ["/opt/nodejs/node_modules/@modelcontextprotocol/server-brave-search/dist/index.js"]
   ```
   - Lambda Layer内の正確なパス（`/opt/nodejs/node_modules/`）を明示的に指定
   - パッケージ解決の曖昧性を排除

3. **依存関係の制御**
   - Lambda Layerに事前にパッケージをインストールすることで、実行時の依存関係解決を回避
   - npxのようなパッケージマネージャーの動的解決に依存しない静的な構成

4. **デバッグの容易性**
   - エラー時にパスやファイルの存在確認が容易
   - npxの内部処理に起因する問題を排除し、シンプルな実行フローを実現

### 解決方法
Lambda LayerにMCPサーバーを追加し、直接実行：

1. **Lambda Layerに依存関係を追加**
   ```json
   // cdk/layer/nodejs/package.json
   "dependencies": {
     "@modelcontextprotocol/server-brave-search": "^0.6.0"
   }
   ```

2. **実行方法を変更**
   ```typescript
   // lambda/index.ts
   const mcp = new MCPClient({
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
   ```

3. **環境変数の設定**
   ```typescript
   // cdk/lib/cdk-stack.ts
   environment: {
     BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
   }
   ```

### 結果
- MCPサーバーがLambda Layer内で直接実行される
- npxの依存関係を回避
- 子プロセスの制約を回避し、安定した実行を実現

## まとめ

### 最終的な構成
- **開発**: `/lambda/index.ts`でTypeScriptコードを編集
- **ビルド**: esbuildで`/dist/index.mjs`にES Module形式で出力
- **デプロイ**: CDKが`/dist/index.mjs`をLambda関数として、`/cdk/layer/nodejs/`をLayerとしてデプロイ
- **MCP**: Lambda Layer内の`@modelcontextprotocol/server-brave-search`を直接実行

### 重要なポイント
1. ES Module形式を使用する場合は、拡張子やpackage.json設定に注意
2. Lambda環境では子プロセスやnpxの制約があるため、依存関係を事前にLayerに含める
3. MCPサーバーは直接nodeコマンドで実行し、Layer内のパッケージパスを明示的に指定
4. 環境変数（BRAVE_API_KEY）の設定を忘れずに行う

## Lambda関数でTypeScriptを直接使用せず、dist/index.mjsを使用する理由

### 背景
Lambda関数の実装において、`lambda/index.ts`（TypeScript）を直接デプロイするのではなく、esbuildでビルドした`dist/index.mjs`を使用している。

### 理由

1. **Lambda実行環境の制約**
   - AWS LambdaのNode.jsランタイムはJavaScriptのみを実行可能
   - TypeScriptは直接実行できず、事前にJavaScriptへのトランスパイルが必要

2. **ES Module形式の必要性**
   - `@mastra/mcp`パッケージがES Module形式を要求（CommonJSでのrequire不可）
   - `.mjs`拡張子により、Node.jsが自動的にES Moduleとして認識
   - Lambda環境でpackage.jsonなしでもES Moduleとして動作

3. **esbuildによる最適化**
   ```bash
   esbuild lambda/index.ts --bundle --minify --sourcemap --platform=node --target=es2022 --format=esm --external:@mastra/core --external:@ai-sdk/amazon-bedrock --external:@mastra/mcp --outfile=dist/index.mjs
   ```
   各オプションの詳細：
   - `lambda/index.ts`: 入力ファイル（TypeScriptソース）
   - `--bundle`: 必要な依存関係を単一ファイルにまとめる（Lambda関数のサイズ最適化）
   - `--minify`: コードの圧縮・最小化（変数名短縮、空白削除、コールドスタート改善）
   - `--sourcemap`: デバッグ用ソースマップ生成（本番エラー時の原因特定が可能）
   - `--platform=node`: Node.js環境向けの最適化（ブラウザAPIを除外）
   - `--target=es2022`: ES2022仕様のJavaScript出力（最新言語機能を活用）
   - `--format=esm`: ES Module形式での出力（import/export構文、@mastra/mcp要求）
   - `--external:@mastra/core`: Lambda Layerから提供されるため、バンドルに含めない
   - `--external:@ai-sdk/amazon-bedrock`: Lambda Layerから提供されるため、バンドルに含めない
   - `--external:@mastra/mcp`: Lambda Layerから提供されるため、バンドルに含めない
   - `--outfile=dist/index.mjs`: 出力ファイル（.mjs拡張子でES Module明示）

4. **開発と本番の分離**
   - 開発時：`lambda/index.ts`で型安全なTypeScriptコーディング
   - 本番時：最適化された`dist/index.mjs`を実行
   - ソースマップにより、エラー時のデバッグも可能

5. **CDKとの統合**
   - CDKは`dist/`ディレクトリを直接参照
   - ビルド成果物のみをデプロイすることで、不要なソースコードを除外
   - Lambda関数のサイズ削減とセキュリティ向上

### 結論
TypeScriptの型安全性を開発時に活用しつつ、本番環境では最適化されたJavaScript（ES Module）を実行することで、開発効率とランタイム性能の両方を実現している。