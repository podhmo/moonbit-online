# moonbit-online

やりたいことはmoonbitのwasmを利用したオンラインデモの作成。


詳しい仕様は ./spec.md に記載されてる。

## todo (Task list)

実際の作業の際には ./TODO.md を読み一つずつ作業を進めてください。そして完了した場合はチェックボックスをonにしてください。
必ず作業の最後にテストを実行して全てのテストが通ることを確認してください。
成功しても失敗しても常に「振り返り」をresults/`%Y%m%d-%H%M.md`-(ok|ng).mdに記録してください。「振り返り」とは ./prompts.md に書かれた振り返りのプロンプトのことです。


## 補足事項

あなたはchomme devtoolsのMCPを使ってブラウザを開き動作確認ができます。


## setup

ここのスクリプトを実行してwasm版のmoonbit compilerを作る。これをweb上で実行したい。

- https://github.com/moonbitlang/moonbit-compiler?tab=readme-ov-file#use-wasm-based-moonbit-compiler
