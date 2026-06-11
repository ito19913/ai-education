# SESSION_HANDOFF.md

AI-Education プロジェクトの **セッション間引継ぎドキュメント**。次セッションの最初に必ず読む。最終更新: **2026-06-11 後段セッション完了 (origin/main=`b067d3f`、本日 14 コミット、全 tsc/lint[既知12]/build クリア、migration 2 本 [`20260611000000_init_daily_picks` / `20260611010000_add_resume_outline`] 本番適用済+REST 検証済)**。**本セッションの成果 4 本柱**: ①**Phase B 勉強開始 chat 儀式「おかえり、今日なにやる?」** (grill B-1〜B-8 確定→実装。今日のタスク 2 層化 = 上段プラン先頭 + 下段「きょう決めたこと」、初回挨拶おかえり化+候補カード+「＋ゆいと決める」、daily_picks [完了は導出・持ち越し・翌日✓掃除]、generateReply キーワード intercept。**実機確認済「動いてます。内容もいい感じ」、運用方針 =「一旦この形で運用、ダメなら改良」**) + **宿題・テストその場登録** (儀式カード「＋新しい宿題・テストを登録」=保存と同時に今日へ自動 pick / ダッシュボード宿題カード「＋追加」=登録のみ)。②**レジュメ構造化 R11 三部作完結** (grill R11-1〜R11-8 確定→①②③全実装。**レジュメ=頭の中の体系図の本丸**: ①アウトライン基盤 = resumes.outline+AI 下書き+言葉で修正+**通し文書ビューがデフォルト** [Ⅰ→1→(1)→①→・全科目固定、**実機確認済「いい感じ」**] / ②書く型 = 宣言パレット [科目別チップ+自作 localStorage 蓄積]+「この型で書く」[宣言の並び+番号枠のみ・中身書かない]+刻む時の自動配置 [Haiku] / ③フィードバック = 添削の構造観点 [宣言と中身のズレ・階層迷子を△・**関所は中身基準のまま**]+🪄「整える」[子の言葉を変えず記法だけ])。③**宿題・テスト提出日→予定カレンダー自動マーカー** (merge.ts AssignmentMarker、教材が真実・行は作らない・テスト=examラベル+あと◯日/宿題=（提出）・やったで消える)。④**Lesson**: Turbopack panic 0xc0000142 (globals.css PostCSS 子プロセス起動失敗) はコード起因でなく古い dev サーバー+`.next` キャッシュ → 停止+削除+再起動で解消。**★次にやる候補**: (1) **実機確認** = Phase B 永続化リロード残存 / R11-②③ (宣言チップ・この型で書く・整える・構造込み添削・刻む時の自動配置) / 提出日マーカー (2) 宿題専用「AI と解く」画面 (要 grill) (3) N9③戻り提案 (要 grill) (4) 旧 today-tasks 残骸整理 (5) まとまり生成のサーバー側ジョブ化 (要 grill) (6) 既存スキャン本の体系図再抽出動線。設計の議論は grill-me モードで 1 問ずつ (推奨案を添える)。real モード前提で `cd web && npm run dev` (dev サーバーは要再起動 — 前セッションの harness 側プロセスは終了している)。詳細 = ARCHITECTURE「## Phase B」「### レジュメ構造化 R11 (#### R11-①/②/③ 実装)」「## ダッシュボード化〜 > ### 未実装・次の候補」。 **← 以下は同セッションの途中経過 (参考):** **本セッションの成果 (詳細 ARCHITECTURE「## Phase B: 勉強開始 chat 儀式」)**: 今日のタスクを 2 層化 = 上段 自動枠 (プラン先頭、既存) + 下段 **「その日決める枠」(きょう決めたこと)**。①grill B-1〜B-8 確定 (発火 = その日最初の挨拶おかえり化+「＋ゆいと決める」ボタン・強制なし / 対象 = 宿題・テスト「まだ」+ プラン外の本のまとまり / 本は chat 内まとまりピッカーで選ぶ [済み✓+⭐おすすめ] / 永続化 = `daily_picks` テーブル・**完了フラグ持たず導出** [宿題 status / レジュメ understood] / 持ち越し = 完了 or 子が「やめとく」まで・否定バッジなし・完了日 ✓→翌日自動掃除 / 儀式 = カード選択・複数 OK・「今日はプランだけでいい」で断れる / 初回判定 = 今日の thread 無し)。②実装 = migration + `lib/today/daily-picks-repo.ts` + `DailyPick` 型 + TutorCard `day-picker`/`day-segment-picker` + `DayPickerCard`/`DaySegmentPickerCard` + TutorWorkspace (picks state + 挨拶後 900ms にカード append + generateReply キーワード intercept [今日なにやる/他にもやる/今日はプランだけ、**state machine 通さない**] + Claude シーン day-start/day-close 言い換え + 完了観測フック [宿題トグル/レジュメ understood]) + DashboardPane 2 段 (「きょう決めたこと」行 = 学習する/やった/やめとく✕/✓、ヘッダー「＋ゆいと決める」) + TutorChat/Bubble/Router/Archive 配線。**動作確認手順**: migration 適用 → `cd web && npm run dev` → (今日の thread を消すか翌日に) /tutor でゆいが「今日なにやる?」+ 候補カード → 宿題タップ→ダッシュボード下段に出る → 本タップ→まとまり選択 → 「やった」/レジュメ仕上げで ✓ → リロードで残存 → 翌日消える。**→ 実機確認済「動いてます。内容もいい感じ」+ 追加実装 (`6dfaec1`): 宿題・テストの**その場登録** (ito19「今日のタスクで一番多いのは宿題・テスト」) = 儀式カード末尾「＋新しい宿題・テストを登録」(候補 0 件でもカードを出す) → AssignmentDialog がその場で開き、**保存と同時に今日の枠へ自動 pick** + ゆい「登録して今日に入れたよ、他にもやる?」。ダッシュボードの宿題・テストカードにも「＋追加」(登録のみ)。`handleSubmitAssignment` が新規作成 Material を返すよう拡張。※同日 Turbopack panic (0xc0000142、globals.css PostCSS 子プロセス起動失敗) は古い dev サーバー+`.next` キャッシュ起因 → 停止+キャッシュ削除+再起動で解消 (コード起因でない)。**★セッション末: レジュメ構造化 R11 を grill 確定 (R11-1〜R11-8、★未実装★、詳細 ARCHITECTURE「### レジュメ構造化 R11」)★**: レジュメ＝頭の中の体系図の本丸。ito19 会計士受験の実体験 2 本柱を製品化 = ①**見出しの完全統一** (Ⅰ→1→(1)→①→・ 5 段固定・全科目全冊カスタム不可、Ⅰ・1=冊アウトライン/(1)・①=ピース本文内、冊を開くと**通し文書ビュー**がデフォルト) ②**宣言** (【定義】【要件】【効果】等、中身に名前を付けてから書く。パレット+AI推奨[並びだけ・中身書かない]+自作蓄積)。アウトライン=AI が教材構造から下書き→言葉で修正・ピースを刻むたび配置提案。添削は構造も見るが関所(R8)は中身基準。入力=テキスト+空テンプレ挿入 (構造化エディタ作らない)。既存ピースは AI 一括配置提案。実装順=**R11-①アウトライン基盤 (migration+下書き+通し文書) → ②書く型 (テンプレ+宣言パレット) → ③添削構造観点+音声整形**。**→ 同セッションで R11-① 実装完了 (`7fecbc3`、tsc/lint[既知12]/build クリア、★E2E実機確認は未★)**: migration `20260611010000_add_resume_outline.sql` (✅本番適用済+REST 検証済。resumes.outline JSONB=章+entryIds、配置の唯一の置き場) + `outline-claude.ts` (Opus 下書き+言葉修正、検証は client sanitizeOutline) + フォールバック (教材ごと1章・ページ順、修正失敗は現状維持) + **NotesHomeView デフォルト=通し文書ビュー** (Ⅰ→1 固定レンダリング+未整理+「アウトラインを作る」CTA+言葉で直すバー、リスト/体系図は切替)。詳細 ARCHITECTURE「#### R11-① 実装」。**✅migration 2 本 (daily_picks + resume_outline) は本番適用済+REST 検証済 (daily_picks テーブル存在 / resumes.outline 列存在)**。**→ さらに R11-② 書く型も実装完了 (`2def22d`、tsc/lint[既知12]/build クリア、★E2E実機確認は未★)**: ①宣言パレット (`lib/notes/declarations.ts`、科目別既定チップ [法律・税務系=定義/趣旨/要件/効果/論点/例]+自作宣言は localStorage 蓄積、ResumePane でタップ→カーソル位置に【宣言】挿入) ②「この型で書く」(`template-claude.ts`、Opus vision が教材を見て**宣言の並び+番号枠だけ**の空テンプレ、中身書かない=R3、失敗は科目別固定テンプレ) ③刻む時の配置提案 (`suggestOutlinePlacement`、Haiku 4.5、新ピースをアウトラインの章へ自動配置+ゆい「Ⅱ◯◯に入れたよ」、合わなければ未整理)。詳細 ARCHITECTURE「#### R11-② 実装」。**→ R11-③ も実装完了 (`b824408`、R11 三部作完結、tsc/lint[既知12]/build クリア)**: ①添削の構造観点 (reviewResume 拡張、宣言と中身のズレ・階層の迷子を△で方向指摘・**構造は「重大な△」に数えない=関所は中身基準のまま**・宣言未使用の本文に型は強制しない) ②「整える」(`tidyResumeBody`、子の言葉・内容・文順を変えず記法だけ — フィラー除去+句読点改行+①②+【宣言】、失敗は正規表現簡易整形) ③ResumePane 🪄「整える」ボタン。R11-① は実機確認済 (英語レジュメ Ⅰ be動詞/Ⅱ 代名詞、ito19「いい感じ」)。詳細 ARCHITECTURE「#### R11-③ 実装」。**→ さらに宿題・テスト提出日→予定カレンダー自動マーカーも実装 (`e47bc13`)**: 「まだ」+dueDate ありの assignment を予定リスト/カレンダーに自動表示 (merge.ts `AssignmentMarker`、教材側が真実・行は作らない・テスト=examラベル色+あと◯日・宿題=締切/提出ラベル色+「（提出）」・編集不可・やったで消える)。**★次にやる候補**: Phase B + R11-①②③ + 提出日マーカーの実機確認 / 宿題専用「AI と解く」画面 (要 grill) / N9③戻り提案 / 旧 today-tasks 残骸整理 / まとまり生成のサーバー側ジョブ化 (要 grill)。 **← 以下は同日前段: 2026-06-11 セッション完了 (ダッシュボード化+予定+宿題・テスト+新プラン+学習履歴の大型セッション、実機確認済・migration 5 本本番適用+REST 検証済・tsc/lint/build クリア)**。**本セッションの成果 (詳細は ARCHITECTURE「## ダッシュボード化 + 予定 + 宿題・テスト + 新プラン + 学習履歴 (2026-06-09〜06-11)」)**: ①**トップ=ダッシュボード化** (`DashboardPane`、左メニューは「ダッシュボード」1 つだけに大幅削減。課題/教材/レジュメ/プラン/先生▼/もっと▼撤去・レポート/帰宅儀式廃止・記録系は下部「これまでの記録」帯。構成=今日のタスク→宿題・テスト→予定→課題→教材→レジュメ→プランサマリー→記録、全幅 max-w-5xl 統一、**画面に出るのは実データだけ**=モックの今日のタスク/進捗バー/AIと相談/予定の勉強マージ撤去)。②**予定=何でも入る 1 本のカレンダー** (ラベル {名前,固定パレット色,kind} デフォルト 5 シード・勉強は削除保護・試験は「あと◯日」、追加/編集/削除+リスト⇆カレンダートグル、migration `20260609000000`+`20260609010000`、★base-ui Select は値を生表示→SelectValue 関数 children で変換★)。③**教材 2 エリア化+宿題・テスト** (Material.kind=book/assignment、上部タブ [本棚|宿題・テスト]、宿題=リスト+フィルタ+並び替え [新しい順/提出日/科目順]+やった既定非表示+科目ラベル、`AssignmentDialog` D&D PDF 後付け/差し替え/削除、**学習する=PDF ある行のみ**、migration `20260609020000`)。④**新プラン=ザックリ・まとまりキュー型 (旧 Phase 5 Plan Engine 丸ごと廃棄)** (プラン=教材単位 `StudyPlan`、教材詳細「プランに組み込む」=期間選ぶだけ 10 秒、キュー=ConceptSegment 上から順、**済み=レジュメ understood から導出+手動スキップ** [プラン側に完了フラグ持たない]、今日のタスク=各プランの先頭 1 個常駐・完了で即次・溜まらない、期間=チェックポイントで期限超過カードが 3 択 [延長/終了/最初から=2周目 countFrom]、migration `20260610000000`、`PlansView`/`PlanAddDialog`/`plan-progress.ts`、PlanEngineDashboard 削除+chat 計画立案フロー廃止)。⑤**学習履歴=自動・必須 (タスクは任意)** (learning_logs 不変ログ: read/resume-draft/resume-done/review-promote/assignment-done を実アクションにフック + study_minutes: 読書ビューのアクティブ時間ハートビート [タブ可視+3 分以内操作で毎分+1]、`LearningHistoryView`=今日/7 日間サマリー+日別足あと、migration `20260610010000`)。⑥細かい改善=教材詳細に表紙サムネ (w-24) / レジュメのデフォルト冊を起動時自動確保 (英語で冊追加が出ない実機バグ解消) / navigate に tab・unit param。**★次にやる候補**: Phase B 勉強開始 chat 儀式 (「おかえり、今日なにやる?」で宿題を選ぶ「その日決める枠」、要 grill) / 宿題・テスト提出日→予定カレンダー自動マーカー / 宿題専用「AI と解く」画面 / 旧 today-tasks 系の残骸整理 / 2 周目 G-C 改稿 / 文字起こし「整える」/ N9③戻り提案。設計の議論は grill-me モードで 1 問ずつ (推奨案を添える)。real モード前提で `cd web && npm run dev`。 **← 以下は前回 2026-06-08 セッション完了②** (**`origin/main = 91e68ba`、本日後段 2 コミット (`cd35171`/`91e68ba`)、実機確認・tsc/lint[既知 wasm 13]/build クリア・migration 2 本本番適用+REST 検証済・SSoT+memory 同期済**)。**本日後段の成果**: 教材まわりを「読むための源」中心に全面再構成 — ①**教材詳細を 4 カードに** (メタ[教材名/出版社/著者]+編集を最上部 / 課題[Issue を coveredNodeIds で逆引き]独立カード / 学習スケジュール / **まとまり一覧**[体系図ノード→ConceptSegment に統一]) + **体系の地図・評価コメント・教材ごと葵 chat を撤去**。②**出版社・著者** (migration `20260608010000`、detect-meta 自動検知+編集ダイアログ、★メタ編集が DB 永続化されていなかった潜在バグ是正=`updateMaterialMeta` 配線)。③**表紙サムネ** (migration `20260608020000`、PDF を読んだ時に 1 回生成し DB 保存) + **教材一覧を本棚風グリッドに**。④**読書ビュー「まとまり選択で一旦止まる」** (選択→「ここから読む」でガイド読書開始、詳細『読む』も `&unit=1` で同着地)。⑤**カリキュラムページ(/curriculum)削除**。**migration 2 本は本番適用済 (REST で publisher/author/cover_thumb 列存在を検証済)**。詳細は §5 末尾 2026-06-08 後段ブロック + ARCHITECTURE「## 教材詳細・一覧の再構成」。**★次にやる候補**: 2 周目 G-C 改稿 / 文字起こし「整える」/ 図クリップ / N9③戻り提案・N9④スケジュール配分 / (任意) ゆい chat の open 振り返りナッジ重複表示の調査。設計の議論は grill-me モードで 1 問ずつ (推奨案を添える)。real モード前提で `cd web && npm run dev`、各コミット tsc/lint/build クリア+conventional commit+末尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。**← 以下は前段 (1062b62 まで)**: **本日の成果まとめ**: ①**R10 レジュメ(冊)管理 Phase 1/2/3 完結** (Phase1=migration `20260608000000_init_resumes.sql` 本番適用済+科目タブ+N4 違反是正+出典→レジュメ往復 / Phase2=冊タブ 追加/削除[デフォルト保護]/デフォルト変更/別冊振り分け+学習中の「入れる冊」セレクター / Phase3=冊のコピー)。②**科目を直す** (科目付け間違い修正、別科目のデフォルト冊へ)。③**「ヒントちょうだい」(R4 完全実装)** (答えは言わず糸口を段階的に小出し)。④**ガイド読書 2 修正** (青枠を別ブロックへ動かすと選択し直し+見開きでページまたぎ移動、ドロップ座標でページ/ブロック特定)。⑤**サムネをレール幅追従で拡大表示** (細部確認、レール maxSize 420px)。⑥**旧学習画面 /learn を廃止** (→`/tutor` リダイレクト+入口撤去、`components/learn/` コードは MindMapPane 共有のため残置、司令室が実質トップに)。**詳細は下記 §5 の 2026-06-08 ブロック群 (Phase1→Phase2→科目を直す→ヒント→Phase3→ガイド読書修正→サムネ→/learn廃止) を参照**。**★次にやる候補**: 2 周目 G-C で自分のレジュメ改稿 / 文字起こしを葵が整える「整える」/ 図クリップ / (任意) ゆい chat の open 振り返りナッジが実機で重複表示される件の調査。設計の議論は grill-me モードで 1 問ずつ (推奨案を必ず添える)。real モード前提で `cd web && npm run dev`、各コミット tsc/lint/build クリア+conventional commit+末尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。 ← 以下は同日の途中経過: **✅ R10 レジュメ(冊)管理 Phase 2 も実装・実機 E2E 確認済・コミット済 (`e7c17f7`)**: grill 確定 ((1) 別冊振り分けは同一科目内のみ / (2) 冊 UI = 科目タブの下に冊タブ / (3) 冊削除時は中身をデフォルト冊へ移してから論理削除=子の本文を失わせない / (4) 振り分けはカードの ⋯ メニュー / (5) 新規冊は手入力 [自動名「○○レジュメN」初期値] / (6) 科目付け間違い修正は別件に後回し)。実装: `resumes-repo` に insertResume(作成Resumeを返す)/renameResume/setDefaultResume/softDeleteResume(中身退避)/moveEntryToResume + `NotesHomeView` 冊タブ(★デフォルト・⋯で名前変更/デフォルト/削除・＋冊を追加、選択冊で resume_id スコープ、カードの⋯に別冊振り分け) + **学習中の「入れる冊」セレクター (R5、ito19 実機指摘)** = `ResumePane` 上部で普段デフォルト・別冊はその場選択・新冊作成可 (resumes/onAddResume を TutorWorkspace→MaterialReadPane→ResumePane で配線) + ドロップダウン min-w-[200px]+whitespace-nowrap で冊名1行。migration 不要 (Phase 1 のテーブル)。法人税 2 冊で E2E 確認 (学習中セレクターで入れ先選択・別冊振り分け・デフォルト変更・削除でデフォルト送り・リロード後永続)。全 tsc/lint(既知 wasm 13)/build クリア。**★次=R10 Phase 3 (冊のコピー) / 科目付け間違い修正 / 「ヒントちょうだい」/ 2 周目 G-C 改稿 / 「整える」**。詳細 ARCHITECTURE「### レジュメ(冊)管理 > #### 実装 (2026-06-08、Phase 2)」。 ← 以下は同日 Phase 1: **✅ R10 レジュメ(冊)管理 Phase 1 + 出典→レジュメ往復 を実機 E2E 確認済・コミット済 (`74e46a7`)**: 北極星「1 科目 1 冊」を実装し、NotesHomeView の全科目混在表示 (N4 違反) を**科目タブ + 科目スコープ**に是正。① migration `20260608000000_init_resumes.sql` (本番適用済) = `resumes` テーブル (`subject_id` は **text** でハードコード科目 `subj-english` とカスタム科目 uuid を両対応) + `note_entries.resume_id` (FK on delete set null) + RLS。② `lib/notes/resumes-repo.ts` 新規 = `ensureDefaultResume(subjectId, subjectName, ownerId)` がオンデマンドでデフォルト冊を確保 + 同科目の `resume_id` 未割当ピースを backfill。③ `ResumePane` が保存直前に ensureDefaultResume→`resume_id` 書込。④ `NotesHomeView` に科目タブ (override+描画時解決で set-state-in-effect 回避) + 冊名「○○レジュメ」見出し、表示は subject_id 絞りで resume レコード非依存。⑤ **出典→レジュメ往復** (ito19 実機フィードバック「出典からレジュメに戻ることも重要」) = 読書ビュー `MaterialReadPane` ヘッダーに「📒 レジュメを見る」ボタン→`navigate("notes", {subjectId})`、`NotesHomeView` の `initialSubjectId` で該当タブ初期選択。型 `Resume`/`NoteEntry.resumeId` 追加。**英語/法人税 2 科目で E2E 確認済** (タブ切替・冊名見出し・混在なし・リロード後も DB 永続)。全 tsc/lint(既知 wasm 13 のみ)/build クリア。**★Phase 2 への申し送り**: 既存「NotebookLM 税務 AI 教材」レジュメが英語タブに居る=登録時 subjectId が `subj-english` のため (タブは正しく分類)。別冊/別科目振り分けは Phase 2 で。**★次=R10 Phase 2** (冊の追加/削除[デフォルト保護]/デフォルト変更/別冊への手動振り分け R5) or Phase 3 (コピー) / 「ヒントちょうだい」/ 2 周目 G-C 改稿 / 文字起こし「整える」。詳細 ARCHITECTURE「## レジュメ構想 > ### レジュメ(冊)管理 > #### 実装 (2026-06-08、Phase 1)」。 ← 以下は 2026-06-07 後段3: **レジュメ構想 実装 ①+②+④core を E2E 確認済 (commit `7e07fd2`〜`da0f7e3`、push 済)**: フェーズ①呼び名リネーム (子文言 ノート→レジュメ / 「レジュメにする」/「レジュメ体系図」、tutor-mock の NL 分類器も同期=落とし穴回避、内部据え置き) + フェーズ②+④core **横並びレジュメ pane** (新 `ResumePane.tsx` + `reviewResume()` 3 色添削、教材の横で子が自分の言葉で書く・お手本見せない・葵が ◎/△/✕、`MaterialReadPane` に `resumeMode`、教材は単一ページ強制、ガイド操作はレジュメ中も維持で書きながら教われる、本文は `note_entries.ai_summary` 流用=migration 不要) + **誤マッチ修正** (segment id は教材内ユニーク→`sourceMaterialId` で絞る、英語レジュメが法人税に出た実機バグ) + **確定フロー 3 アクション** (任意「葵に見てもらう」/ **「このまとまりを仕上げる」=関所・強制添削** / 「今日はここまで」=中断・添削なし→open、★「税語」=「ぜいこ先生」の聞き間違い・書くのは子で AI はチェックのみ)。**全 tsc/lint/build クリア + ito19 実機「すごくいい」確認**。**さらに ✅ R4 音声入力 (Web Speech API、🎤 話す/停止→本文追記、`b2442f3`、「いい感じ」) も実装済**。**★次=R10 レジュメ(冊)管理 Phase1** (1科目1冊が原則+デフォルト冊自動+体系図を科目/冊スコープに+既存ピース移行、要 migration `resumes` テーブル+`note_entries.resume_id`。現状 NotesHomeView は全科目混在=N4違反を是正)。詳細 ARCHITECTURE「## レジュメ構想 > ### 実装 (2026-06-07)」「### レジュメ(冊)管理」。 ← 以下は同日: **①ガイド読書のガイドプラン+青枠調整を DB 永続化 (commit `020bee2`・push 済、migration `20260607010000_add_guided_plans.sql` 本番適用済、★E2E 実機確認は保留中★)**: ガイドプラン (`GuidedBlock[]`) は概念を開くたび Opus vision で作り直し session メモリのみ=リロードで消える・非決定的→block ID ズレで手動調整した青枠が別ブロックに当たる問題。grill で「プランごと固定保存して初めて調整値が意味を持つ」確定→`materials.guided_plans` JSONB (`{segmentId: GuidedBlock[]}`) に保存。取得は ①DB/local map ②session キャッシュ ③Opus 生成 の順で**2 回目以降は Opus を呼ばず即表示**。青枠調整は `block.bbox` 焼き込み・ドラッグ中ローカル即追従/指を離した時 (pointerUp) に 1 回 DB 保存。`bboxOverrides` 廃止→`guidedPlansMap` state に統一。**②レジュメ構想 grill 確定 (R1-R8、★未実装★)**: 北極星「まとめノート構想」を **「レジュメ構想」に再定義**。ノート=書く作業に堕ちる/レジュメ=見れば全体を思い出せる要約。R1 呼び名 (ノート→レジュメ/ノートにまとめる→**レジュメにする**/ノート体系図→レジュメ体系図/Issue 据え置き、**範囲 A=子に見える文言のみ**改名・内部コード/DB 据え置き) / R2 **レジュメ本文を書くのは子** (捨てていた"自分の言葉の説明"を本文に昇格・葵は添削だけ) / R3 **AI お手本は見せない** (添削の裏でだけ使う・教材は参照可) / R4 **音声メイン+テキスト** (Web Speech API 無料・葵が文字起こしを軽く整えるだけ) / R5 リンクは**学習しながら自動** (まとまり=1レジュメ自動オープン・必要時だけ別レジュメ呼び出し) / R6 レイアウト=レジュメモード時 ［サムネ｜教材**単一ページ**｜**レジュメ pane** (葵 chat 枠を置換)］ / R7 **3 色添削** (◎/△/✕・答えは書かず方向だけ) / R8 誤りゼロ&重大な抜けゼロで理解済み・中断は Issue 保存。**SSoT 反映済: PHILOSOPHY 章 6 を全面レジュメ化 + ARCHITECTURE「## レジュメ構想」新設 (R1-R8 表)**。次=実装プラン化 (①リネーム→②レジュメ pane+単一ページ→③音声入力→④子が書く+3 色添削→⑤自動リンク)。 ← 以下は同日前段: **実機課題対応を一括対応・全コミット済 (origin/main=`5196ef3`)**: ①科目(subject)永続化=重大欠落の解消 (subjects テーブル+repo、migration 本番適用済、実機「法人税」科目+教材を REST 復旧) ②**Supabase Pro 化 + Storage 上限引き上げ**で 129MB の自炊本も保存可 ③読書ビュー=3ペインのドラッグリサイズ+サムネのキーボード操作+**サムネレール細く(60px)+非表示トグル** ④まとまり=**アップロード時バックグラウンド生成 (スキャン本対応)** + **スキャン本のページずれ解消 (vision 経路に統一+ページ画像へ「PDF-N」赤バッジ焼き込み→AI がそれを読んで紙番号確定)** ⑤**ガイド読書=ブロック+「ここを解説」+青枠の元仕様を維持** (ページ送り化も試したが「子は今どこ読んでるか見えないとやりづらい」で却下) + **青枠を直接ドラッグで手動調整** (EditableHighlight、移動+四隅リサイズ、bboxOverrides でセッション内記憶) → ito19「すごくいい」。読み方の方針=塊を選ぶ→そこをベースに質問・不明点を聞くを一区切りずつ。詳細 ARCHITECTURE「### 2026-06-07」「### 2026-06-07 後段」。**次の候補=ガイド読書の手動調整値 DB 永続化 / まとまり生成のサーバー側ジョブ化(要 grill) / N9③戻り提案・N9④スケジュール配分**。 ←以下は前回 2026-06-06: **まとめノートの「まとまり (一単元) 区切り」を grill 確定 (M1-M10) → デジタル本で実装・✅E2E 確認済 / スキャン本は C-8 未実装**: 実機で「ノートが今ページ要約で一単元要約になっていない」最大欠点を指摘 → grill 確定 (まとまり=1概念=1ノート / 範囲は AI が中身を読んで PDF 紙番号で確定・人間は数値もドラッグも触らない / 目次・印刷番号はヒント格下げでズレ消滅 / 通読→概念ごとまとめ2フェーズ / まとまり=N9④スケジュール配分の最小単位) → 実装 (ConceptSegment 型 + migration 2本 [本番適用済] + findSegmentForPage + segment-claude [Haiku、本文テキストを【pdf:N】タグで渡しPDF紙番号出力] + PageThumbnailRail 縦スライダー + 読書ビュー入口=まとまり一覧から選ぶ + オンデマンド生成&DB永続化 + 評価コメント sessionキャッシュ高速化)。**実機検証でバグ3連を退治** (前付け混入 / スキャン本無限ループ / ★自己キャンセル固着=エフェクト deps に segmenting を入れていた本丸★)。**✅ デジタル本「基本マスター BASIC 英文法」で E2E 確認** (開く→数秒で前付け除外の単元一覧→選択でジャンプ+オリエン→まとめる→リロードで即一覧、DB永続)。**⏳ スキャン本 (英文法解説・真英文法大全=自炊/固定レイアウトで文字レイヤー無し) は区切れず一覧出ない (固着はしない、読書は可能) → C-8 [低解像度vision区切り] が本格運用に必須**。詳細 ARCHITECTURE「### まとめノートの「まとまり (一単元) 区切り」設計」+ 末尾「次の選択肢」。 ← 以下は前回まで: **段階1-B 教材・PDF Supabase 永続化を実装 + ✅ E2E 確認済 (無料プラン + 小 PDF)**: 教材 + 体系図ノード (JSONB) + 元 PDF (Storage) を永続化しリロードで読書ビューが成立。grill 7 点確定 → `materials` テーブル + RLS + バケット `material-pdfs` migration / materials-repo / pdf-storage (TUS 再開可能) / TutorWorkspace 行即作成+裏アップロード / MaterialReadPane Storage フォールバック。Supabase 未設定なら自動 mock モードで既存動線不変。tsc/lint/build クリア。動かすには Pro 化 + migration 適用 + env が必要 [§3 次論点ブロック参照]。詳細 ARCHITECTURE「### 段階1-B 教材・PDF 永続化」。**さらに同日: まとめノート構想 grill N1-N9 全確定 → N9① 中核 MVP を実装・E2E 確認済 (C91) → N9② 未理解(open)+定期振り返り (C93) → ノート作成フロー再設計 (C94) → 葵 chat 装飾 (C95)** = プロダクト最終ゴール「子が AI 対話で作る教材横断まとめノート」が実物として稼働。①最小ループ(読む→能動ゲート→理解済みエントリ生成・永続化→ノート体系図③→出典リンク)が本番 DB で実機確認、②open ステータス+ハブ小出し振り返り+体系図 緑/黄 色分け、③**作成フロー再設計=「学習を開始する」(葵が説明)+対話を反映した要約+子のメモ取り込みでオリジナルノート化**(ito19 さん「AI のノートでなく子の 1 冊に」指摘)。note_entries migration 適用済(status/user_note 既存)。詳細 ARCHITECTURE「## まとめノート構想」の各サブ節。← 以下は前回まで: **Phase 6 拡大: ゆい/葵 全体 Claude 化 (A + B 完了) + C78 generic シーン追加で最大カバレッジ**): C58 PHILOSOPHY 全書き換え + grill 累計 30 問 / 47 論点 (C59-C61) + 第 1 段階 mock 反映 (C62-C65) + カリキュラム DB 仮実装 (C66-C68) + C2/C3 撤回 + 教材ベース回帰 (C69) + Phase 6 教材体系図 AI 抽出 Step A (C70-C72) + C73-C77 で A/B 全 Claude 化 + **C78 で「相談」等 fallback ルートも Claude 化 (plan-start + generic-{stateName} シーン追加)** → tutor-mock の全 mock 発話がほぼ Claude 経由で言い換えされる状態。残り C 部 (F4 / F5 / 試験前 / F1 内部 3 分類) + D 部 (親 chat) は次セッション以降。**2026-06-04 後段で C80-C82 追加**: 全 AI モデルを Opus 4.8 統一 (C80) + 教材登録 PDF メタ自動検知 (C81、grill 確定) + 教材一覧 in-memory 反映で残課題② 解消 (C82) + **教材本文理解システム (葵ティーチング基盤) grill 完結 (★未実装★、段階1/2)**。**段階1-A (本物の体系図、目次ベース、mock) を C84 (WIP) → C85 で完成・バグ解決**。★真因は「pdf.js が 186MB を処理しきれない」ではなく **真・英文法大全が自炊スキャン PDF (文字レイヤー無し)** だったこと★。解 = **スキャン PDF は目次ページを画像化して葵に vision で読ませる** (デジタル PDF は従来テキスト)。デバッグで 4 つの壁を突破: ①スキャン判定+画像化 ②画像配列を Server Action に渡すと "Maximum array nesting exceeded" → 改行連結 1 文字列で回避 ③目次が長い前付けの後ろ → 先頭 32 ページ描画 + しおり(outline)優先 ④出力が max_tokens 超で JSON 切断 → 16000 + salvage パーサ。結果 = 自炊 186MB から **Part 0〜5 の本物の章立て + 実ページ番号 (p.24-37 等) を 30+ ノード**で抽出、ユーザー「完璧に取れました」確認済。**さらに段階1-C「一緒にめくって読む」読書ビュー (PDF ビューア + 見開き + ズーム + 葵が現在ページを vision で読む chat、フル幅集中モード) を実装、ユーザー「ここまで OK」確認済** (詳細 §3「#### 段階1-C」)。**次セッション = 1-B (PDF/教材の Supabase 永続化、リロードで消える割り切りの解消) or 学習プラン grill 残り 5 論点**。**動作確認時の注意 = dev server 再起動必須、スキャン PDF 登録は 32 枚 vision で ~80-120 秒、読書ビューは今セッション登録の教材のみ (in-memory)**)

---

## §1. このプロジェクトは何か

**ito19 さんの娘さん (中2) 専用の学習ツール**。`PHILOSOPHY.md` の通り「暗記からツール化への勉強観転換」を音声対話で体験させる Web アプリ。

- 配置: `C:\dev\projects\home\Ai-Education\`
- リモート: <https://github.com/ito19913/ai-education> (private)
- ブランチ: `main` 直 push 運用 (feature ブランチ使わない)
- スタック: Next.js 16 + React 19 + TypeScript strict + shadcn/ui (base-nova) + Tailwind v4 + Vitest

---

## §2. 全 SSoT ドキュメント (読む順)

| # | ファイル | 役割 |
|---|---|---|
| 1 | **PHILOSOPHY.md** | 「何のために作るか」の憲法。実装の前に必ず読む |
| 2 | **ARCHITECTURE.md** | 「どう作るか」の SSoT。Phase 0〜5 までの設計 + 実装状況 |
| 3 | **TUTOR-ROLE.md** | ゆい先生の役割定義 (コーチング + コンダクター) |
| 4 | **REVIEW-2026-05-24.md** | Phase 3 中盤の独立レビュー記録 (3 視点) |
| 5 | **本書 (SESSION_HANDOFF.md)** | セッション引継ぎ起点 |

---

## §3. 今日のセッション (2026-05-25/26) 全成果

**55 commit、約 +10720 行**。`7aaf7df`..(C55 SHA) の範囲。**Phase 5 grill 確定 + 全実装完了 + ARCHITECTURE 完全同期 + 2026-05-25 追加 grill 1+2 (教材アップロード 13 + 科目追加 9) SSoT 同期 + 両 grill ガワ実装 (C28-C34) + 緊急 fix 5 件 (C36-C38 / C40-C41) + 2026-05-26 ito19 さん意見実装 4 件 (C43 G フローチャート / C44 A+B 教材メニュー+一覧 / C45 D+E スケジュール連携 / C46 F 編集削除) で教材ハブ動線完全実装**。

### Phase 3 レビュー追従 (REVIEW-2026-05-24.md 対応)
| # | SHA | 内容 |
|---|---|---|
| C1 | `7e67dc8` | MarkdownText 共通化 + 4 chat ファイル置換 |
| C2 | `ceedc4f` | Phase 3 拡張型 6 個 + 静的 mock データ |
| C3 | `19398da` | tutor-mock 派生 push (excavation / 振り返り完了) |
| C4 | `e9c9233` | `/tutor?view=reflections` 一覧画面 |
| C5 | `8fd5c34` | IssueChat ヘッダ「ゆいから N 件」バッジ |
| C6 | `6974c48` | 「教えない」ハードガード + draft 自動生成 |

### Phase 4 中学生向け設計軌道修正 (grill Q1-Q17 + 実装 C7-C13)
| # | SHA | 内容 |
|---|---|---|
| — | `4c79f64` | docs: Phase 4 軌道修正 (ARCHITECTURE 更新) |
| C7 | `41cae87` | Phase 4 新型 + 静的 mock + 既存型拡張 |
| C8 | `14effde` | 計画立案 chat + カードハイブリッド |
| C9 | `6bb7237` | 帰宅儀式 第 1 部 学校レポート |
| C10 | `432d12a` | 帰宅儀式 第 2 部 + 自動起動 |
| C11 | `4a9ee60` | 週次/月次レポート UI 4 セクション |
| C12 | `37b7921` | 達成バッジ + 親共有 (Phase 4 グランド完了) |
| C13 | `0668c62` | メニュー整理「今日のタスク中心」|

### Phase 5 学習戦略エンジン 試作 (設計叩き台)
| # | SHA | 内容 |
|---|---|---|
| C14 | `6b3e84a` | Phase 5 試作型 9 個 + 静的 mock (議論用) |

### Phase 5 grill 確定 (P5-Q1〜Q7 + サブ問い計 11 問) + 実装 C15-C24 全完了
| # | SHA | 内容 |
|---|---|---|
| C15 | `ee51d81` | docs: ARCHITECTURE.md Phase 5 grill 確定設計 (P5-Q1〜Q7) を反映 |
| C16 | `e23d63c` | Phase 5 型確定 + PLAN_MODE_DISTRIBUTION 新規 + GT mock 全期間化 |
| C17 | `2ea8d50` | 立案フロー拡張 (weak-node-picker + PlanType 明示発話分岐) |
| C18 | `71f94d9` | NodeReviewSuggestion フロー (ゆい chat 主提示 + 即時 SI 挿入) |
| C19 | `21a2238` | Replan Engine (3 トリガー + 種類別影響範囲 + PlanRevision 履歴) |
| C24 | `1326cf5` | docs: SESSION_HANDOFF.md 更新 (中間) |
| C20 | `c01b86f` | 週次レポート拡張 (pending Suggestion 副提示 + Replan draft + weakNodes 追加) |
| C21 | `287ed83` | Plan Engine ダッシュボード (/tutor?view=plans 本実装) |
| C22 | `c26a557` | view=schedule → view=today-tasks 全体リネーム |
| C23 | `8899555` | 今日のタスク 進捗バー + 全 done CTA |
| C24(終) | `7d4970d` | docs: SESSION_HANDOFF.md 最終更新 |
| C25 | `d89811e` | docs: ARCHITECTURE.md Phase 5 本実装結果 SSoT 化 (ロードマップ表 + 本実装結果セクション) |

### 2026-05-25 追加 grill: 教材アップロード設計 (C26)

Phase 5 完了直後に追加で実施した grill。教材ウィザード (Phase 4) / Plan Engine の MaterialPickerCard (Phase 5) / Phase 6 計画 (教材 PDF → roadmap) を貫く「教材という入力レイヤ」を 13 個の確定で固めた。

| # | SHA | 内容 |
|---|---|---|
| C26 | (今 push) | docs: 教材アップロード設計 13 確定を ARCHITECTURE / SESSION_HANDOFF / memory に同期 |

**13 確定 (ARCHITECTURE「## 教材アップロード設計 (2026-05-25 grill)」に集約)**:

| # | 確定 |
|---|---|
| 1 | 順序: 教材アップロード → 計画 (現状実装維持) |
| 2 | 計画主体: ゆい (担任) 提案 → 娘さん承認/修正 |
| 3 | ゆいは教材選び提案禁止 (与えた教材に対する計画案のみ、「○○本を買って」は NG) |
| 4 | アップロード主体: 親 + 娘さん両方 (ARCHITECTURE 1408 既設計) |
| 5 | 教材アップ後の動線は計画と疎結合 (体系図見る / 計画で使う / 何もしない の 3 経路) |
| 6 | 学校宿題は SchoolDailyReport 側で写真/PDF アップ可 (教材エンティティとは別) |
| 7 | 教材は事前アップが基本 (同時アップ例外可) |
| 8 | 教材 AI persona = 葵先生 (TUTOR-ROLE 境界: ゆい=教えない / 葵=教える より) |
| 9 | **監修ステップ全廃** (どの場面でも人間が AI 出力を承認するステップは置かない) |
| 10 | **葵生成はテキストに忠実** (AI 解釈・取捨選択禁止) |
| 11 | 葵の教材出力 = 体系図 (忠実) + 評価コメント (葵の見解、coverage/difficulty/fit/notes) の 2 レイヤ |
| 12 | 教材についての葵 chat = 教材ごと独立スレッド (教材詳細ページに集約) |
| 13 | アップ完了動線 = ゆい hub 経由「葵が読んだよ、見る?」(hub 一貫性) |

**未決 (実装時に詰める)**:
- ウィザード簡素化後の入力タイプ UX (PDF / 写真 / スキャン)
- 計画立案フローでの教材ピッカー動作細部
- 学校宿題写真アップ時の葵介入度 (マルチモーダル解析の有無、Phase 6 議論)
- 教材詳細ページ細部 UI
- Phase 7 Supabase スキーマでの永続化 (Material / KnowledgeNode / MaterialReview / 教材 chat)

### 2026-05-25 追加 grill 2: 科目追加設計 (C27)

C26 と同日。計画立案・教材ウィザードの `SubjectPickerCard` が **英語 1 科目しか表示しない** UX 状態をきっかけにした追加 grill。「科目」エンティティの追加動線設計を 9 個の確定で固めた。MVP は英語のみ継続、実装は Phase 6/7 以降。

| # | SHA | 内容 |
|---|---|---|
| C27 | (今 push) | docs: 科目追加設計 9 確定を ARCHITECTURE / SESSION_HANDOFF / memory に同期 |

**9 確定 (ARCHITECTURE「## 科目追加設計 (2026-05-25 grill)」に集約)**:

| # | 確定 |
|---|---|
| S1 | MVP は英語のみ継続、設計のみ grill、実装は Phase 6/7 以降 |
| S2 | 主要科目はハードコードでデフォルトセット (先生キャラ含む) |
| S3 | ハードコード外は手動追加 (科目名 + 先生名) |
| S4 | 「科目の設定」専用入口が必要 |
| S5 | 計画立案で「科目がない」→ ゆいが「科目設定に行こう」誘導 |
| S6 | 入口 = ゆいハブ「科目を追加」主動線 + /admin/subjects バックアップ (教材追加と同じ二重構造) |
| S7 | 追加主体 = 親+娘さん両方 (教材アップ確定 4 と同じ) |
| S8 | 各「科目を選ぶ」UI に「+ 新規科目」リンク、追加処理はゆいハブの科目設定で統一 |
| S9 | ハードコードデフォルト = 主要 5 教科 (英・数・国・理・社) |

**未決 (実装時に詰める)**:
- 5 教科の先生キャラ命名 (英語=葵既存、残り 4 教科) → **✅ C28 で確定 (数=かずや / 国=みやび / 理=さとし / 社=ゆうき)**
- 科目追加 UI 入力項目細部 (科目名 / 先生名 / アバター文字 / 色 / subtitle) → **✅ C30 で確定 (科目名 / 先生名 / アバター 1 文字、色/subtitle は自動)**
- 削除運用 (ハードコード保護 + 手動追加分削除時の関連 Material/LearningPlan 整合) → **Phase 7 で対応予定**
- `SubjectSettingsPanel` の UI 細部 → **✅ C30 でガワ実装**
- 「+ 新規科目」リンクのビジュアル → **✅ C29 でガワ実装**
- ゆい mock 「科目を追加」 keyword 分岐パターン → **✅ C30 でガワ実装 (科目を追加 / 教科を追加 / 科目設定 / 英語以外 / 新規科目)**

### 2026-05-25/26 ガワ実装 (C28-C34): 両 grill の Mock 画面反映

ito19 さん「Mock 画面に反映できますか」の要望に応じて、選択肢 E (Phase 4 ウィザード簡素化 + 科目追加 UI ガワ) を全部実装。両 grill のガワが /tutor で実際に動かせる状態に。

| # | SHA | 内容 | 対応する確定 |
|---|---|---|---|
| C28 | `d8e7153` | MOCK_SUBJECTS 5 教科展開 + SVG アバター 5 人分 + 共通 `SubjectTeacherAvatar` コンポーネント | grill 2 S2/S9 |
| C29 | `749f8a2` | SubjectPickerCard + ウィザード Step1 に「+ 新規科目」リンク | grill 2 S8 |
| C30 | `96075dc` | `SubjectSettingsPanel` + `/tutor?view=subjects` + ゆい mock 「科目を追加」分岐 | grill 2 S4/S5/S6 |
| C31 | `10e933e` | MaterialEditWizard 3 step 化 (Step3Review 撤去、3 step 化) | grill 1 確定 9 |
| C32 | `379e5e5` | 教材詳細ページ skeleton + `view=material-detail` + ゆい「葵が読んだよ」発話 | grill 1 確定 5/11/12/13 |
| C33 | `f80d4e7` | `/admin/subjects` バックアップ動線 (SubjectSettingsPanel を再利用) | grill 2 S6 |
| C34 | `b1b92a1` | fix: subject-picker options を MOCK_SUBJECTS から動的化 (英語のみ表示バグ修正) | grill 2 S9 |

**動作確認シナリオ** (dev server 起動後):
1. ゆいに「計画立てる」 → subject-picker に 5 教科 + SVG アバター + 「+ 新規科目」リンク
2. ゆいに「科目を追加」「科目設定」 → 右ペインに `SubjectSettingsPanel`、追加フォームから新規科目登録 → ゆい「○○ 追加したよ」発話
3. `/admin/subjects` 直接アクセス → 一括管理画面 (同じパネル、親想定)
4. ゆいに「教材を追加」 → ウィザード 3 step (メタ → AI 抽出 → 保存、**監修ステップなし**)
5. ウィザード保存完了 → ゆい「葵先生が読んだよ! 右で見せるね」 + 教材詳細ページ自動展開 (体系図 + 評価コメント + 葵 chat 入力欄 placeholder)

**Phase 6/7 残作業** (この grill 由来):
- 葵先生 (Claude Opus) による教材 PDF / 写真の本物の読み込み (現状 mockExtractNodes、評価コメントは固定 mock テキスト)
- 教材ごと独立 chat スレッドの本実装 (現状 placeholder/disabled textarea)
- ゆい完了発話の quickReplies「[見る][あとで]」(現状は自動 material-detail 遷移)
- 「計画立案中に科目がない」AI 自動検出 → ゆい誘導発話 (S5、現状は UI 配置のみで自動検出なし)
- Phase 7 Supabase: Material / Subject / MaterialReview / 教材 chat の永続化 + 削除運用 (ハードコード保護 + 関連データ整合)

### 2026-05-26 緊急 fix (C36-C38): ito19 さん画面動作確認中に発見

C28-C34 ガワ実装完了状態の dev server 画面確認で見つかった 3 つの問題を、grill-me ではなく直接 fix。grill 1 / grill 2 の確定内容との整合性も同時に高めた。

| # | SHA | 内容 | 関連 |
|---|---|---|---|
| C36 | `fae0852` | `MaterialPickerCard` に「+ 新規テキスト追加」リンク追加 | grill 1 確定 5 / grill 2 S8 と同じパターン (SubjectPickerCard C29) |
| C37 | `b9b5b3e` | fix: `Step1MetaAndUpload` 科目セレクト Radix Select quirk 修正 | バグ (value !== children な SelectItem の raw value 表示) |
| C38 | `14f1125` | fix: C31 取り残し全 fix (監修関連文言 + Step4Save 致命バグ) | C31 当時の Step3Review 撤去で取り残された 5 ファイル変更、grill 1 確定 9/10 整合 |

**C38 が fix した致命バグの詳細**:
- 教材登録ウィザード Step3 (保存) の「保存する」ボタンが `disabled={approved.length === 0}` で永遠 disabled、動線が完全に詰まっていた
- C31 で Step3Review (監修) を撤去したため approve するチャンス自体が消えており、approved は永遠に 0 件
- grill 1 確定 9 (監修ステップ全廃) + 確定 10 (テキスト忠実) に従い、葵が抽出したノードはそのまま全保存する設計に統一 → `disabled={extracted.length === 0}` で動線が初めて通った

**C38 で変更した 5 ファイル**:
- `Step2Extraction.tsx`: ボタン「監修に進む」→「保存に進む」
- `Step4Save.tsx`: approved フィルタ全廃、表示文言「承認した〜」→「抽出された〜」、致命バグ disabled 条件修正
- `tutor-mock.ts`: ゆい発話「監修していこう」→「その教科の先生が…体系図と評価コメントを出してくれる」(将来の他教科対応も視野に一般化)
- `types.ts`: `AiExtractedNode.reviewStatus` 型フィールド削除 (dead field)
- `mock-extraction.ts`: reviewStatus セット削除 + Omit から除外

**動作確認シナリオ** (C36-C38 後の dev server):
1. ゆいに「計画立てよう」→ 英語選択 → material-picker 末尾に「+ 新規テキスト追加」リンク (C36) ✅
2. リンククリック → 右ペイン MaterialEditWizard 展開
3. Step1: 科目欄が「**英語**」表示 (C37) ✅
4. Step1 → Step2: ダミー教材名 + 何かの PDF で「AI 抽出に進む」
5. Step2 → Step3: ボタン「**保存に進む**」(C38) で進める
6. Step3: 「**抽出ノード数**」「**抽出されたノード一覧**」表示 + 「**保存する**」ボタン押せる (C38、旧:永遠 disabled)
7. 保存後: ゆいが「葵先生が読んだよ」発話 + 右ペイン material-detail 切替 (C32 既存)

### 2026-05-26 SSoT 同期 (C39)

- `ARCHITECTURE.md`「## 教材アップロード設計 (2026-05-25 grill)」の「Phase 6 で実装する具体タスク」確定 9 行を「✅ C31 + C38 全 fix」に更新、「実装状況」表に C36/C37/C38 追記
- 本 `SESSION_HANDOFF.md` の §3 に本「2026-05-26 緊急 fix」セクション追加 + §6 スタータープロンプト更新
- memory `project_ai_education.md` / `MEMORY.md` 更新

### 2026-05-26 後段緊急 fix (C40-C41): C39 push 後の ito19 さん画面確認で発見

C39 で「動線完走可能」とした直後の動作確認で、教材登録後の material-detail 遷移が **そもそも動いていない** ことが判明。C32 ガワ実装時点 (2026-05-25) からずっと動いていなかった隠れバグ 2 件を一気に fix。

| # | SHA | 内容 | 原因 |
|---|---|---|---|
| C40 | `f93cc83` | fix: TutorWorkspace.viewFromParam に "material-detail" 追加忘れ修正 | C32 で `RightPaneView` 型 + RightPaneRouter 分岐 + navigate 呼び出しは実装したが、URL parser の許可リスト追加を忘れていた取り残し → URL は material-detail でも parser が `"default"` に丸めて DefaultPane 表示 |
| C41 | `04074b4` | fix: MaterialDetailView スクロール不能 fix (flex min-height: auto 問題) | root に `flex h-full overflow-y-auto` だけだと flex 子の default `min-height: auto` 規則で overflow が効かない。WeeklyMonthlyReportView.tsx:102-104 の二層パターン (`flex h-full` 外側 + `min-h-0 flex-1 overflow-y-auto` 内側) に統一 |

**動作確認シナリオ (C40-C41 後)**:
1. 教材登録ウィザード Step3 「保存する」 → ゆい「葵が読んだよ」発話
2. **右ペインが material-detail に切り替わる** (C40 fix で初めて動いた)
3. 体系図 (20 ノード + 「…他 N 件」) + 葵評価コメント + 葵 chat 入力欄まで **スクロールして全部見える** (C41 fix で確実に)

**本セッション中に対応しなかった残課題 (次セッション以降、ito19 さん明示「一旦終了」)**:
- ② **表示教材が MOCK_MATERIALS[0] (中2英語教科書) 固定**: 登録した教材名が反映されない (MOCK_MATERIALS 動的 push 未実装、TutorWorkspace.tsx:303 暫定設計通り)。in-memory mock push を入れれば即解決、Phase 7 Supabase 永続化とは別件
- ③ **2 回目以降の教材登録で「テスト」発話の重複**: 複数登録時のゆい発話振る舞い + material-detail 更新ロジックが未定義。設計 grill 要
- ④ **計画立案フロー + material-detail 並走**: 計画立案中に「+ 新規テキスト追加」で MaterialEditWizard 起動 → 登録後 material-detail に切り替わるが、左ペインは plan-await-material のまま (= material-picker カードが残る、duration-picker に進める)。grill 1 確定 5「計画と疎結合」の意図とは合っているが、「2 つの動線が同時に左右で進行している」状態の UX 違和感。grill 要

### 2026-05-26 後段 SSoT 同期 (C42)

- `ARCHITECTURE.md` の「実装状況」表に C40 / C41 追加、「Phase 6 で実装する具体タスク」の教材詳細ページ UI 行を「✅ C32 ガワ + C40 / C41 取り残し fix」に更新
- 本 `SESSION_HANDOFF.md` Header / §3 / §6 を更新 + 残課題 ②③④ を次セッション引継ぎとして明記
- memory `project_ai_education.md` / `MEMORY.md` 更新

### 2026-05-26 ito19 さん意見実装 (C43-C46): grill-me なしで意見表明 → 4 commit で教材ハブ動線完全実装

ito19 さん 2026-05-26 後段で「グリルミなしで自分の意見を述べる」フェーズに入り、A-G の追加要件を提示。本セッションでそのうち G + A-F を全実装。残課題 ②③④ (前 C42 で記録した別動線の論点) は引き続き次セッション以降。

**ito19 さん意見の整理**:
- A: ゆいメニューに「教材」追加
- B: 教材一覧から詳細遷移
- C: 教材詳細から葵 chat (Phase 6 で本実装、現状 placeholder)
- D: 教材詳細にスケジュール組み込み状況表示
- E: 教材詳細からスケジュール画面遷移リンク
- F: 教材の追加・編集
- G: 教材詳細に体系図 (学習画面と同じフローチャート) 追加 = ノードリスト + 体系図 2 表現

| # | SHA | 内容 | 対応 |
|---|---|---|---|
| C43 | `79ee7b0` | feat: MaterialDetailView に体系図フローチャート (MindMapPane) 追加 | G (まず最優先で実装、ito19 さん「まずそこまでいきましょうか」) |
| C44 | `21f6a22` | feat: ゆいメニュー「教材」+ MaterialsListPane 新規 | A+B 一気実装、残課題⑤ (教材詳細の再アクセス動線) 完全解消 |
| C45 | `5b0623d` | feat: 教材詳細にスケジュール組み込み状況表示 + 遷移リンク | D+E α 案 (SI → GT → resource.materialId 経路で当月集計、today-tasks 遷移) |
| C46 | `63a4f6b` | feat: 教材編集・削除 (F α 案、MaterialEditDialog 再利用) | F、TutorWorkspace.materials state 管理 + 既存 MaterialEditDialog 流用 |

**動作確認シナリオ (C43-C46 後の完成形)**:
1. ゆいメニュー右側 (プランの左) に **「教材」ボタン** (通常スタイル、強調なし)
2. クリック → ゆい「OK、登録済の教材を右で見せるね…」発話 → 右ペインに **MaterialsListPane** (科目別 grouping 縦リスト + 末尾「+ 新規教材を追加」)
3. 個別教材クリック → 右ペインに **MaterialDetailView** 切替:
   - 教材メタ Card (アバター + 名前 + 種別 + 学年)
   - **葵評価コメント Card** (範囲 / 難易度 / フィット / 使い方のヒント、mock テキスト)
   - **学習スケジュール組み込み状況 Card (C45)** (計画名 + 今月 X/Y 件 + 進捗 % + プログレスバー + 未着手 SI 上位 3 件 + [今月の予定を見る →] ボタン)
   - **体系図フローチャート Card (C43)** (MindMapPane で React Flow 階層図、左→右 dagre レイアウト、ズーム・パン可)
   - 体系図ノードリスト Card (テキスト忠実 20 件 + 「…他 N 件」)
   - 葵 chat 入力欄 Card (placeholder、Phase 6 で本実装)
   - **教材の管理 Card (C46)** (「メタ情報を編集 / 削除」ボタン → MaterialEditDialog でメタ修正 / ゴミ箱削除)
4. 削除 → ゆい「『○○』を削除したよ。Phase 7 永続化で関連データ整合化予定」発話 + 一覧ページに自動遷移

**本セッション中対応せず次セッション以降に持ち越し**:
- ② 表示教材が MOCK_MATERIALS[0] 固定 (アップロード時 fallback 設計、Phase 7 in-memory push で解消)
- ③ 2 回目以降の教材登録で「テスト」発話の重複
- ④ 計画立案フロー + material-detail 並走の UX 違和感
- C45 で α 案を選んだが「未着手 SI が現実的に存在するか」は plan-mock データ依存
- F の関連データ整合 (LearningPlan / SI / GT の materialId 参照) は Phase 7 永続化で grill

### 2026-05-26 後々段 SSoT 同期 (C47)

- `ARCHITECTURE.md`「実装状況」表に C43 / C44 / C45 / C46 追加、「Phase 6 で実装する具体タスク」の教材詳細ページ UI 行を「✅ C32 ガワ + C40 / C41 取り残し fix + C43 体系図フローチャート + C45 スケジュール組み込み状況 + C46 編集・削除 で完全実装」に更新、再アクセス動線の項目に C44 完全解消を追記
- 本 `SESSION_HANDOFF.md` Header / §3 / §6 を更新、ito19 さん意見実装の完了状況 + 動作確認シナリオ + 残課題 ②③④ を引き続き引継ぎ
- memory `project_ai_education.md` / `MEMORY.md` 更新

### 2026-05-26 微調整 (C48): 体系図 リスト ⇄ マップ 切替 UI 統合

C47 push 後の画面確認で ito19 さん追加意見「体系の地図は体系図の横にボタンを作って切り替えで表示するようにしてほしい」 → 旧 C43 で 2 Card 縦並びだった「フローチャート + ノードリスト」を 1 Card に統合、ヘッダー右側トグル (リスト / マップ) で切替に変更。デフォルト = リスト (テキスト忠実)、マップは MindMapPane (h-[420px])。縦長解消 + ユーザーが見たい表現を選べる UX。

| # | SHA | 内容 |
|---|---|---|
| C48 | `bea7c2e` | refactor: MaterialDetailView 体系図セクションを「リスト ⇄ マップ 切替」UI に統合 |

### 2026-05-26 セッション末ラップアップ + 次セッション引継ぎ (C55)

**ito19 さん最終確認 (2026-05-26 セッション末)**:
- 教材セクション (C43-C54、計 12 commit) の **全機能 ito19 さん OK 確認済**
- 次セッションは **「プラン (計画立案フロー) grill = 一番の肝、慎重に」** に進む
- C55 で SSoT 引継ぎ準備 + push でセッション完了

**プラン grill の起点候補 9 個 (前々回提示、本書 §6 に再掲)**:
| # | 論点 |
|---|---|
| ① | 計画立案の **起点** (本人発話 only? ゆいから「そろそろ見直し時期?」提案?) ← 推奨 |
| ② | 教材ピッカー UX 細部 (並び順 / 検索 / 削除) |
| ③ | 「科目がない」自動検出 + ゆい誘導発話 |
| ④ | roadmap-preview 表示内容 (月単位 / 週単位 / GT 一覧 / モード配分) |
| ⑤ | キャンセル / 一時保留の挙動 |
| ⑥ | 複数並走計画 (英 + 数 同時) の優先順序 |
| ⑦ | ゆいの事前情報 (最近 WeakNodes / 達成度 を見て事前提案) |
| ⑧ | 既存計画との関係 (新計画立案時に旧 plan どうなる?) |
| ⑨ | 1 計画 1 教材 vs 複数教材 |

**plan grill アプローチ (ito19 さん指示「慎重に」)**:
- 1 問ずつ詰める、推奨案を必ず添える (memory `feedback_grill_me.md` 規律)
- 次セッション開始時に ito19 さんに「9 候補のうちどれから? アジェンダあり? 現状動線一周してから?」アスク
- 「一番の肝」 = ツール全体の中核 (= Phase 6 ゆい AI 化の前提) なので、grill 結果は ARCHITECTURE.md に即同期、実装は確定後

### 2026-05-26 信号機進捗表示 (C49、暫定): スケジュール進捗を 🟢/🟡/🔴 でパッと見可視化

C48 push 後 ito19 さん追加意見「学習スケジュールの進捗状況を信号機の赤青黄色で表示、パッと見で順調かどうかが分かるように。赤青黄色の要件はプログラムで指定できるが、ここに関しては後で要件を詰めたい」 → MaterialDetailView の D+E スケジュール組み込み状況 Card に **信号バッジ** (色ドット + ラベル) と **プログレスバー色連動** を追加。

| # | SHA | 内容 |
|---|---|---|
| C49 | `47ca5a3` | feat: 学習スケジュール進捗を信号機色で表示 (暫定閾値) |
| C50 | `4cd181f` | style: 体系図マップモードの高さを 420px → 700px に拡大 |
| C51 | `225d385` | fix: スケジュール組み込み状況 - 今月 0 件時のボタン非表示化 |
| C52 | `f59ddd3` | feat: ノードリスト → 葵 chat 遷移ガワ |
| C53 | `2269131` | feat: 教材詳細最上部に「← 教材一覧に戻る」ボタン追加 |
| C54 | `e3e8717` | style: TutorWorkspace ヘッダから「/ ゆい先生」breadcrumb 削除 |
| C55 | (今 push) | docs: 教材セクション完成 + 次セッション「プラン grill (一番の肝)」引継ぎ準備 |

**暫定閾値 (本要件 grill 後に置換)**:
| 進捗 % | 信号 | ラベル |
|---|---|---|
| 80% 以上 | 🟢 emerald | 順調 |
| 50-80% | 🟡 amber | ペース注意 |
| 50% 未満 | 🔴 red | 遅れ気味 |

**残課題 ⑥ (次セッション以降で要件 grill)**:
- 閾値ロジック (単純進捗率 / 日付経過率との比較 / 教材ごとカスタム / 計画 PlanType 別 / 等)
- 信号配色 (アクセシビリティ配慮、色覚多様性対応の検討)
- 表示位置 (今月セクション内 / Card ヘッダー / メイン表示 等)
- 「今月」以外の集計範囲 (全期間 / 今週 / 今月 等の選択)

### 2026-05-26 Phase 6 着手 (C56-C57): プラン grill 9 候補は保留 → Claude API smoke test 完了

C55 で「次セッション = プラン (計画立案) grill = 一番の肝」と引き継ぎ準備したが、**ito19 さんが grill 開始直後に方針転換**:

> 「プランはAIが立てることを前提としていて、ここでそろそろAIの動きを確かめる必要があるので、Claudeの API を入れましょうか」

= mock のまま「ゆいが計画をどう立てるか」議論しても地に足つかない判断 → Phase 6 着手に切り替え。grill 9 候補 (①〜⑨) は AI の動きを見てから議論する流れに。

**8 論点 grill 確定** (詳細は ARCHITECTURE.md「## Phase 6: Claude API 接続」セクション):

| # | 確定 |
|---|---|
| 1 | 起点 = Phase 6 着手 (smoke test 先行)、プラン grill 9 候補は AI 化後に議論 |
| 2 | smoke test = 最小単位で「動くこと」確認、Phase 6 全体着手はしない |
| 3 | 代入点 = 「計画立てよう」入口のゆい応答 1 発話 (context 不要、最小単位) |
| 4 | モデル = Claude Opus 4.8 (`claude-opus-4-8`、本番想定通り) |
| 5 | 呼び出し場所 = Server Action (Next.js 16 標準、`'use server'`、API key は server-only) |
| 6 | mock 切替 = `NEXT_PUBLIC_USE_CLAUDE_API=true` + 「計画立てよう」keyword のみ Claude、失敗時 mock fallback |
| 7 | system prompt = TUTOR-ROLE.md + PHILOSOPHY.md 全文そのまま (prompt caching ephemeral)、SSoT 整合 |
| 8 | env 名 = `AI_EDU_ANTHROPIC_API_KEY` (= 親 harness の `ANTHROPIC_API_KEY=""` injection と衝突回避) |

**実装 (C56)**:

| # | SHA | 内容 |
|---|---|---|
| C56 | `859bff5` | feat: Phase 6 smoke test — Claude Opus 4.8 で「計画立てよう」入口 1 発話の AI 化 |

**変更ファイル (6 件 + 1 新規)**:
- `web/lib/learn/tutor-claude.ts` (new) — Server Action `tutorClaudeRespondToPlanRequest`
- `web/lib/learn/tutor-mock.ts` — `buildNextTutorReplyAsync` async wrapper 追加
- `web/components/tutor/TutorChat.tsx` — `generateReply` 型 Promise 化 + setTimeout コールバック async + try/finally
- `web/components/tutor/TutorWorkspace.tsx` — `buildNextTutorReplyAsync` import + `generateReply` async/await
- `web/.env.local.example` — `AI_EDU_ANTHROPIC_API_KEY` + `NEXT_PUBLIC_USE_CLAUDE_API=true` template + 衝突理由 comment
- `web/package.json` + `package-lock.json` — `@anthropic-ai/sdk` 依存追加

**動作確認 OK 例** (ゆい応答、mock 文言「OK、学習計画立てよう! まず科目から。（教材を 3 回まわす計画を立てるよ）」と明確に異なる):

> いいね、計画立てよっか！
> じゃあまず、どの科目からいく？下に出てくるカードから選んでみて。
> 「これが一番気になる」とか「これ後回しにしたい」とか、なんとなくでも OK だよ〜

- ✅ ゆいキャラ整合 (「だよ〜」「いいね」温かい口調)
- ✅ PHILOSOPHY「ふわっと → 具体化」軸 (「なんとなくでも OK」)
- ✅ subject-picker への自然な誘導
- ✅ TUTOR-ROLE「コーチング軸」(具体例で本人発話を引き出す)

ito19 さん 2026-05-26「対応してくれました」OK 確認済。

### 2026-05-26 env 衝突問題の Lesson Learned (Phase 7 でも踏襲)

最初の動作確認で `ANTHROPIC_API_KEY is not set in .env.local` エラー連発。.env.local に key を正しく書いても読まれない問題:

- **原因**: Claude Code 等の親 harness は子プロセス起動時に `ANTHROPIC_API_KEY=""` (空文字列) と `ANTHROPIC_BASE_URL` を inject する (= ユーザー key 漏洩防止のための harness 設計)
- **影響**: Next.js (内部 dotenv) は「既存 env を上書きしない」規律 → .env.local の値が無視される (空文字列が勝つ)
- **回避**: env 名をプロジェクト固有 prefix (`AI_EDU_*`) にする
- **debug の決め手**: `Object.keys(process.env).filter(k => /ANTHROPIC|SUPABASE/i.test(k))` で「キー名は存在するが値が空」を検出。env 関連の不具合は値ではなくキーの存在/値長さを別々に確認するのが第一歩

Phase 7 Supabase 接続でも同じ問題が起こる可能性あり (= `SUPABASE_*` を harness が inject する場合)。予防的に `AI_EDU_SUPABASE_*` prefix も検討。

### 2026-05-26 SSoT 同期 (C57)

- `ARCHITECTURE.md` に「## Phase 6: Claude API 接続 (2026-05-26 smoke test 着手)」セクション新設 (8 論点 + 実装ファイル表 + 動作確認結果 + Lesson Learned + 次 grill 候補 A-G)
- `ARCHITECTURE.md`「フェーズ別 実装ロードマップ」の Phase 6 行を「未着手」→「smoke test 着手済 (C56)」に更新
- 本 SESSION_HANDOFF.md §3 に本セクション追加 + §6 スタータープロンプト全更新
- memory `project_ai_education.md` / `MEMORY.md` 更新

### 2026-05-27 PHILOSOPHY 全書き換え + 学習プラン再設計 grill (C58-C59)

C57 で「次セッション = Phase 6 拡大 A-G grill」と引き継ぎ準備したが、**ito19 さんが引継ぎ受領後にプロジェクト前提から見直し方針** を提示。同セッション中に 17 問 grill を進めて以下を確定:

**C58 `8c5b1f0` docs: PHILOSOPHY 全書き換え — コーチング・ファースト型へ思想転換**:
- 旧 PHILOSOPHY (AI 提案ベース、ito19 さん未納得、暗記からの脱却・体系図・なぜを問う) を **全廃止**
- 新中心宣言: **「コーチング・ファースト型 学習アプリ」**
- 読者: 子供 (毎回腹落ち儀式) → **親 (アプリ使う前に必ず読む)** へ転換
- 5 章構成: 軸はコーチング / 構造的空白 / 直線進行と分からない地獄 / プロ野球コーチアナロジー / 親へのお願い
- **親⇄ゆいコーチ対話チャネル** 明示 (4 方向: 報告 / ヒアリング / 質問 / 答え)
- 差別化軸:「AI で質疑応答」はあるが「AI でコーチング」を狙うのは我々だけ

**C59 docs: 学習プラン再設計 grill 16 問 SSoT 同期**:
- ARCHITECTURE.md に新セクション「## 学習プラン再設計 grill (2026-05-27)」追加 (確定 33+ 論点 + 未確定 7 + Phase 5 解体級判断)
- ARCHITECTURE.md「フェーズ別 実装ロードマップ」の Phase 5/6 行に「2026-05-27 解体・再構築方向」追記
- 本 SESSION_HANDOFF.md Header + §3 + §6 全更新
- memory `project_ai_education.md` + `MEMORY.md` 更新

**確定論点 33+ の要旨** (詳細 ARCHITECTURE「## 学習プラン再設計 grill (2026-05-27)」参照):
- **思想・対象 8**: コーチング・ファースト軸 / 読者=親 / 旧 PHILOSOPHY 全廃止 / 親⇄ゆい対話 4 方向 / 通信教育 (Z会・進研ゼミ等) 対象 / 学年共通基盤 / 葵=受動的補助 / 高校拡張 2 年後
- **プラン構造 6**: 長期計画なし / 1 ヶ月更新 / 学校+塾二系統 / 学校>塾優先 / 外部スケジュール起点 / 今日+1 ヶ月全タスク見せる
- **つまずき遡及 5**: 学年超え / 教材ノード生成廃止 → 小〜高カリキュラム事前 DB / 高校まで (中高一貫対応) / AI 対話駆動 / 親通知絶対
- **主体性等 7**: 親承認モデル (小学生) / 中学生未確定 / 弱点絶対親共有 / 朝振り返り廃止 or 小学校のみ / 帰宅後フリーに / AI 通訳 / 主用途
- **試験前モード 9**: 状態モデル / ハイブリッド発火 / 3 周 × 重点変化 / 学校停止+塾並走 / 3 周フェーズ別配分 / コーチング駆動振り返り / 3 週前発火 / 親手入力 / 親フィードバック救済

**Phase 5 実装への影響**: 🔴 解体級。LearningPlan の 9 ヶ月期間 + 全期間 GT 化、教材ノード生成 (葵による体系図)、PlanType 5 種、完全本人主体 (Q15)、朝振り返り (morning モード)、本人同意制親共有 — これらほぼ作り直し。「**Phase 7 (永続化) の前に Phase 5 解体・再構築**」ステージに入る。

**未確定論点 (残り 7、次セッション以降で grill 推奨順)**:
1. 失敗扱い (carry-over / 破綻許容、コーチング・ファースト整合の核) ← 重
2. 中学生の主体性モデル (小学生 = 親承認確定済、中学生は?)
3. PlanType 5 種の扱い (廃止 / 再編 / 系統との関係)
4. カリキュラム DB の作成・運用 (AI 検索駆動、具体運用、信頼性担保)
5. 系統 A/B 子に見せるか (ito19 さん「全タスク見せていい」発言、確認のみ)
6. 時間予算自動制御 (別チャット案、ito19 さんスルー、保留 or 採用?)
7. 2 系統の統合管制エンジン (別チャット案の核、採用?)

### 2026-05-27 後段 失敗扱い grill 完結 (C60)

C59 SSoT 同期の後、ito19 さん指示で **失敗扱い grill 開始**。grill 第 19-24 (計 6 問) で本質+細部を確定。

**C60 docs: 失敗扱い grill 6 論点 SSoT 同期**:
- ARCHITECTURE.md「## 学習プラン再設計 grill (2026-05-27)」セクションに新 sub-section「#### F. 失敗扱い (6 論点)」追加
- 確定論点累計を「33+ (grill 第 1-16)」→「39+ (grill 第 1-24)」更新
- 未確定論点リストを「残り 7」→「残り 6」に更新 (失敗扱い削除、番号繰り上げ)
- 「次セッションで進める順序候補」更新 (失敗扱いに ✅ 完結マーク、次推奨スタート = 中学生主体性)
- 本 SESSION_HANDOFF.md Header + §3 末尾 (本セクション) + §6 スタータープロンプト更新
- memory 更新

**確定 F1-F6** (詳細 ARCHITECTURE「## 学習プラン再設計 grill (2026-05-27) > F. 失敗扱い」参照):

| # | 論点 | 確定 |
|---|---|---|
| F1 | UI / 内部の二段構え | **子供 UI は「失敗」概念ゼロ、内部 3 種類分け** (サボり / 誤答 / お休み)。子供 UI ラベルは「完了 / 次回に持ち越し / つまずき発見の機会」のみ |
| F2 | 判定方法 | **AI 自動 + 親フィードバック** (E9 と同じパターン) |
| F3 | 未実施 (サボり) | **当月内 carry-over + 3 日連続検知で親通知** (別チャット案「破綻許容設計」採用) |
| F4 | 誤答発見 | **AI 主導 (ヒアリング + ミニテスト出題)** — PHILOSOPHY 章 4「AI はヒアリング得意」の具体経路 |
| F5 | 戻り誘導 | **AI 自動判定 + 親 OPT-OUT 承認** (3 日経過自動 OK、親異議で再判定) |
| F6 | 細部 5 つ | (1) お休みはサボリカウント除外 / (2) 誤答 3 分類 (概念 → 遡及 / ケアレス → 記録のみ / 暗記不足 → 当該単元ドリル) / (3) 連鎖遡及最大 2 学年 / (4) 復帰判定 = 再ヒアリング + ミニテスト 80% / (5) 試験前モード中は遡及抑制 |

**思想ポイント**:
- 「子に『失敗』を見せない」を徹底 (F1)、ただし内部処理は精緻
- 「ヒアリングがコーチの核ツール」(新 PHILOSOPHY 章 4) を AI 主導 (F4) で実装
- 「戻り誘導」(コーチング・ファーストの最大価値局面) は親 OPT-OUT で親が必ず関与 (F5)
- 別チャット案「破綻許容設計」(F3 carry-over + 3 日検知) と新 PHILOSOPHY コーチング・ファーストの統合実装

**残り未確定 6 論点** (C60 時点) — 本書 末尾「### 2026-05-28 中学生主体性 grill 完結 (C61)」で D2 確定により残り 5 件に。

### 2026-05-28 中学生主体性 grill 完結 (C61)

C60 push 後の新セッションで ito19 さん指示通り **中学生主体性モデル grill 開始** (D セクション内 D2「主体性 (中学生)」の未確定論点)。grill 第 25-30 (計 6 問) で D2 を 6 論点に分解して確定。

**フレーミング合意 (第 1 問)**:
中学生主体性を考える局面は複数あるが、戻り誘導 (F5 親 OPT-OUT) / 弱点 (D3 絶対親共有) / 言語化 (D6 子→AI 通訳→親) / 親通知 (C5 必須) / 対話チャネル (A4 親⇄ゆい 4 方向) が **すべて確定済で「親関与必須」がベースラインを作っている**。学年共通基盤 (A6) で中1-中3 差別化もしない。**残る自由度は「計画立案の承認権」のみ** という絞り込みで合意。

**確定 D2-1〜D2-6** (詳細 ARCHITECTURE「## 学習プラン再設計 grill (2026-05-27) > D2 詳細」参照):

| # | 論点 | 確定 |
|---|---|---|
| D2-1 | 計画立案の承認権 | **OPT-OUT 親承認** (F5 戻り誘導と同型) — AI 立案 → 子に提示 → 親に通知 → 親 OK or 自動 OK で発火、親異議で AI 再立案 |
| D2-2 | 動けるタイミング | **即時子発火 + 親 24h 異議窓口** (F5 の「3 日経過自動 OK」とは別設計、計画立案は月のタスク表示そのもので止められないため。3 日待ちは月の 10% 停止コストが大きすぎる) |
| D2-3 | 月途中変更 (子発議) | **立案と同じパターン踏襲** (子発火 + 親 24h 異議で「保留→再調整」)。立案 / 月途中変更 / F5 戻り誘導 が 3 つの主要更新フロー一貫 |
| D2-4 | 親発議 (「数学厚くして」等) | **ゆい仲介コーチングフロー (E9 汎用化)** — 親→ゆい→子ヒアリング→子 OK で更新 / 子異議でゆいから親に返信、対話継続。A4 4 方向すべて使う |
| D2-5 | 親通知の透明性 | **子に明示「親にも伝えたよ」** — ゆいが子に 1 行告げる。隠れた監視感を回避 (思春期信頼関係)、PHILOSOPHY コーチング・ファースト整合。親 chat 全内容は子に見せない (A4 親→ゆい質問チャネルの本音吐露の場を保護) |
| D2-6 | 親異議処理 | **D2-4 同型 (ゆい仲介)、再窓口 1 回まで** — 親異議→ゆい→子ヒアリング→子 OK で再立案 / 子異議で親⇄ゆい対話継続。3 回目以降は手動確定 (永遠ループ防止) |

**3 つの主要更新フローが統一されたパターンに収斂**:

| フロー | 発議者 | 確定済 |
|---|---|---|
| 子発議の変更 | 子 | D2-3 |
| AI 発議 (戻り誘導) | AI | F5 |
| 親発議 (親フィードバック) | 親 | D2-4 (= E9 汎用化) |

→ いずれも「動く側が即時発火 + 反対側が異議窓口」の対称構造 = 実装 / UI ラベル / フロー共通化のベネフィット大。

**思想ポイント**:
- 「親関与必須」(A4/D3/C5/F5) + 「子の主体性尊重」(コーチング・ファースト、思春期信頼関係) のバランス解 = **OPT-OUT モデル + 透明性 (D2-5)** で両立
- ゆい仲介コーチング (D2-4 / D2-6) = A4 親⇄ゆい対話 4 方向の実装具体
- F5 戻り誘導 + D2-1 計画立案 + D2-3 月途中変更 が「子・AI 動く + 親 OPT-OUT」で **対称構造** → 実装 / UI ラベル / フロー共通化のベネフィット大

**C61 docs: 中学生主体性 grill 6 論点 SSoT 同期**:
- ARCHITECTURE.md「## 学習プラン再設計 grill (2026-05-27)」に新 sub-section「#### D2 詳細 (中学生主体性、6 論点、grill 第 25-30、2026-05-28)」追加
- D セクション D2 行 (未確定 → 確定済 + D2 詳細セクションへのリンク)
- 累計論点を「39+ (grill 第 1-24)」→「47 (grill 第 1-30)」更新、累計 grill 28 問 → 30 問へ
- 未確定論点リストを「残り 6」→「残り 5」に更新 (D2 削除、PlanType を次推奨スタートに繰り上げ)
- Phase 5 影響表「主体性」行 = 中学生 OPT-OUT 親承認 (D2 詳細) を反映
- 本 SESSION_HANDOFF.md Header + §3 末尾 (本セクション) + §6 スタータープロンプト更新
- memory `project_ai_education.md` + `MEMORY.md` 更新

**スコープ外で別 grill 必要な隣接論点** (本 grill で意図的に詰めなかった):
- D1 → D2 切替時期 (年齢自動 / 親選択 / 子選択) — 運用論点、A6 学年共通基盤と整合させて検討
- 24h タイマー終了後の確定処理 (再 OPT-OUT 必要 / 月跨ぎ時挙動) — 実装細部
- 親未参加家庭 (片親 / 親アカウントなし / 親忙殺) のフォールバック — 運用論点

**残り未確定 5 論点** (次セッション grill 推奨順):

| # | 論点 | 性格 |
|---|---|---|
| 1 | **PlanType 5 種扱い** ← **次の推奨スタート** | 中 (Phase 5 解体級判断と直結、現行 5 種をどうするか) |
| 2 | カリキュラム DB 作成・運用 | 中 (つまずき遡及エンジンの基盤) |
| 3 | 系統 A/B 子可視性 | 軽 (確認のみで完結する可能性) |
| 4 | 時間予算自動制御 | 軽 (別チャット案、保留 or 採用?) |
| 5 | 2 系統の統合管制エンジン | 中 (別チャット案の核、採用?) |

### 2026-05-28 第 1 段階 mock 反映 (C62-C65)

C61 (中学生主体性 grill 完結) 直後、ito19 さん指示「C58 以降全体を mock に反映 (第 1 段階のみ、軽量範囲)」で着手。Phase 5 解体プラン確定前の **軽量・即効性ある思想反映だけ** に絞り、未確定 5 論点と衝突しない範囲で実施。

| # | SHA | 内容 |
|---|---|---|
| **C62** | `5aae267` | feat: D2-5 ゆい mock に「親にも伝えたよ」発話追加 (計画立案完了発話 + Replan accept 発話の 2 箇所に「お母さん・お父さんにも伝えたよ ✉️ + 24h 異議窓口」1 段落追加) |
| **C63** | `e4331d9` | feat: D5 朝振り返り (morning モード) を MORNING_MODE_ENABLED フラグで off (定数 export + buildInitialTutorThread morning 分岐 + TutorWorkspace 初期 state 切替 = 朝振り返り 5 セクション skip して即ハブ挨拶。Interrupt/Suggestion 冒頭付与は維持) |
| **C64** | `960dd6c` | docs: ゆい mock の人格コメント + persona description を C58 新 PHILOSOPHY に整合 (Phase 6 Claude API system prompt 元、「コーチング・ファースト型 + 親⇄ゆい対話 A4 + 葵=受動的補助 A7 + 掘り起こし F4」明示) |
| **C65** | (本 commit) | docs: 第 1 段階 mock 反映 SSoT 同期 + F1 既に整合済確認 |

**F1 子供 UI ラベル「失敗」「達成」緩和の調査結果** (C65 で skip 判断):
- TodayTaskList は既に「完了 / 未完了 (中立)」のみで F1 違反なし
- 達成バッジ (C12) は ito19 さん明示「バッジ概念残す」= 維持
- weekly-report 「達成 → 学校 → 弱いところ → 来週」は「達成」をポジティブ感情表現として残し OK
- 「失敗」表現は全て内部 (型名 / mock description / 技術エラー画面) で子供 UI に直接出ない
- → 現状 Mock は偶然 F1 整合的に実装されていた、本格的な F1 内部 3 分類 (サボリ / 誤答 / お休み) は Phase 5 解体時に実装

**第 1 段階の動作確認動線** (dev server `cd web && npm run dev` 起動後):
1. `/philosophy` で C58 新 PHILOSOPHY (コーチング・ファースト型 + 5 章) が render されていることを目視確認
2. `/tutor` 初回アクセス → 朝振り返り 5 セクションに突入しない (C63)、ハブ挨拶「今日はどうする? 計画 / 教材 / 課題 / 今日のタスク」のみ表示
3. ゆいに「計画立てよう」発話 → 既存フロー (subject → material → duration → weak-node-picker → roadmap-preview) → 「これで OK」確定後の発話に「お母さん・お父さんにも伝えたよ ✉️」が出る (C62)
4. 「ペース変えて」「教材変える」等の Replan accept 発話にも「親にも変更点を伝えた」が出る (C62)
5. Interrupt 由来の Replan draft / pending Suggestion は朝振り返り skip しても従来通り冒頭付与される (C63)

**第 2 段階以降に持ち越し** (Phase 5 解体プラン確定後にまとめて実装):
- D2-1 OPT-OUT 親承認の親 chat UI 新設 / D2-2 24h 異議窓口バナー / D2-4 親発議 (= 親アカウント / parent ハブ未構想)
- F1 内部 3 分類 (サボリ / 誤答 / お休み) + 子供 UI 自動マッピング
- F3 carry-over + 3 日連続検知ロジック
- F4 AI 主導誤答ヒアリング (= Phase 6 Claude API 拡大と連動)
- F5 戻り誘導の親 OPT-OUT 通知 UI
- B1-B2 1 ヶ月更新化 (LearningPlan 期間 9 ヶ月 → 1 ヶ月)
- B3 二系統 (学校+塾+通信教育) UI
- ~~C カリキュラム DB (教材ノード生成廃止)~~ → **仮実装着手 (C66-C68、本書 末尾「### 2026-05-28 カリキュラム DB 仮実装 (C66-C68)」セクション参照)**
- E1-E9 試験前モード
- PlanType 5 種扱い (= 未確定 grill #1 後)

### 2026-05-28 カリキュラム DB 仮実装 (C66-C68)

C65 push 後、ito19 さんから **プロジェクトの核 = 「小〜高カリキュラム全体を地図として持って、AI がつまずきを認定 → ヒアリング → 親共有 → 再学習プラン」というスキーム、地図がないと議論進まない** と明示 → 英語 中1〜高3 体系図の **仮実装** を着手。カリキュラム DB grill (未確定 #2) で本格構造を詰める前に、画面で議論を進めるための仮地図。

| # | SHA | 内容 |
|---|---|---|
| **C66** | `30eba7e` | feat: カリキュラム DB 仮実装 (英語 中1〜高3 体系図) + /curriculum 画面 — 型定義 (CurriculumNode / Domain / Grade / State 5 種) + MOCK_CURRICULUM_EN 約 55 ノード + 新規ルート /curriculum + CurriculumMatrixView (マトリックス表示 + 凡例 + Footer) |
| **C67** | `578d39f` | feat: ゆいメニューに「カリキュラム」リンクボタン追加 — 教材とプランの間に Link 配置、/curriculum?subject=english へ遷移 |
| **C68** | (本 commit) | docs: カリキュラム DB 仮実装 SSoT 同期 (ARCHITECTURE「## カリキュラム DB 仮実装 (2026-05-28)」セクション追加 + 本 SESSION_HANDOFF + memory) |

**構造**:
- 6 分野 (文法 / 語彙 / 読解 / 聴解 / 作文 / 会話) × 6 学年 (中1〜高3) = 約 55 ノード
- 文法 36 ノード + 語彙 6 ノード + 学年区分なし 13 ノード (読解 4 + 聴解 3 + 作文 3 + 会話 3)
- 5 状態色分け: unlearned (グレー) / in-progress (青) / mastered (緑) / **weak-detected (黄、AI つまずき認定)** / **weak-confirmed (赤、戻り誘導候補)**
- `prerequisiteIds` で学年超え遡及の依存関係 (C1) を mock 化 (例: 高1 仮定法完成 → 中3 仮定法基礎 → さらに遡及可能)
- mock サンプルで 5 色全部画面で見える配分 (中1 = 緑 / 中2 不定詞 = 黄 / 中3 関係代名詞 = 赤 / 中3 現在完了 = 黄 / 高 1以降 = グレー)

**動作確認** (dev server `cd web && npm run dev` 起動後):
1. `/tutor` メニュー右側 (教材とプランの間) に **「カリキュラム」ボタン** が見える
2. クリックで `/curriculum?subject=english` 遷移 → 英語の中1〜高3 体系図全体俯瞰
3. 5 色の凡例 + マトリックス表示 (学年別ブロック + 学年区分なしブロック)
4. 中2「不定詞 3 用法」が黄 (AI つまずき認定) / 中3「関係代名詞」が赤 (戻り誘導候補) で目立つ
5. Footer の野球コーチアナロジー + 戻り誘導フロー説明
6. 「← ゆいに戻る」リンクで /tutor 復帰

**残課題 (= カリキュラム DB grill 未確定 #2 で詰める論点)**:
- ノード粒度 (不定詞 3 用法を 1 ノード vs 3 ノード)
- 状態遷移ロジック (テスト誤答 N 問で weak-detected / ヒアリング M 回で weak-confirmed)
- AI つまずき認定スキーム (F4 + 確認テスト連携、Phase 6 Claude API)
- ノード詳細画面 (クリックで葵 chat / 関連教材 / ヒアリング履歴 / 再学習プラン提案?)
- 再学習プラン生成 (weak-confirmed → 「ここから戻りませんか」発話 → 親承認 → LearningPlan に SI 追加、F5 + D2-1)
- 科目拡張 (数/国/理/社、5 教科ハードコード S2/S9 と整合)
- カリキュラム源の信頼性 (= 「全カリキュラムを事前に AI が検索して用意」C3 の具体方法) **← 2026-05-28 後段で C3 撤回、新 G3 推奨テキスト提案に置換**
- 進捗 % 集計 (分野/学年別)
- 親への共有 UI (D3 + A4)
- 戻り誘導の連鎖 (F6 細部 (3) 連鎖遡及最大 2 学年)

### 2026-05-28 後段: C2/C3 撤回 + 教材ベース体系図回帰 (C69)

C68 push 後、ito19 さんから **方針転換**: 「公的カリキュラム / ウェブ公開データから体系図を作るのは無理 (中学受験 / 塾教材 / 学校テキストでカリキュラムが大幅に異なる、特に中学受験は学習指導要領を大幅超過)。体系図は **読み込んだ教材から作る** しかない (= 当初 Phase 5 設計に回帰)。読まれていない範囲は **AI が検出 → 推奨テキスト提案 → 親承認** で補完」と確定。

**撤回された旧確定**:
- ~~**C2** 教材ノード生成廃止~~ → 撤回、教材アップロードから体系図を作る (当初設計復活)
- ~~**C3** 小〜高カリキュラム事前 DB~~ → 撤回、カリキュラム DB は持たない、教材ベースのみ

**新 grill 論点 (G1-G5)** (= 次セッション以降):
- **G1**: 教材ベース体系図の学年/分野マッピング (葵 AI が判定)
- **G2**: 「読まれていない範囲」検出ロジック
- **G3**: 推奨テキスト提案 (= 旧 C3 のミニ版、個別教材推薦)
- **G4**: 親承認フロー (推奨テキスト購入を D2-1 同型で承認)
- **G5**: 体系図の集約表示 UI (C66 マトリックス再目的化)

**既存 Phase 5/6F 設計が本流に戻る**:
- 教材セクション (C28-C54: MaterialEditWizard / MaterialDetailView / 体系図フローチャート / 葵 chat) = ✅ 本流
- 旧 MOCK_TREE (英語/不定詞、教材ベース) = ✅ 生きる、後で本格教材ベース DB に統合
- 葵先生による教材体系図生成 (旧 Phase 5 / Phase 6F 主役) = ✅ Phase 6 で本格実装する筆頭候補

**C66 仮実装の扱い** = **(b) 再目的化** (ito19 さん確定):
- /curriculum 画面 (マトリックス + 5 色凡例) は削除せず流用
- データ源 `MOCK_CURRICULUM_EN` (Claude 事前知識から作った仮データ) → 教材から葵 AI が抽出したノードに切替予定
- 教材未登録セル = 「ここの教材未登録、推奨テキストあり」エリア (G2/G3/G4 と直結)
- データ源切替の本実装は Phase 5 解体プラン確定後

**C69** = SSoT 同期: ARCHITECTURE「## 学習プラン再設計 grill (2026-05-27)」C2/C3 行を撤回マーク + 「## カリキュラム DB 仮実装 (2026-05-28)」セクション冒頭に方針撤回注釈 + 末尾に「### 2026-05-28 後段: 教材ベース回帰 + 読まれていない範囲フォロー (C2/C3 撤回)」セクション追加 + 本書 + memory 同期。

**Phase 5 解体プランへの影響**: 教材ベース回帰により既存実装 (C28-C54) が活きる → 解体規模は **縮小**。Phase 7 (Supabase 永続化) や Phase 8 (音声) の優先度判断に影響する可能性あり。

### 2026-05-28 後段後段: Phase 6 教材体系図 AI 抽出 Step A (C70-C72)

C69 push 後、ito19 さん「教材を実際取り込み、体系図を作るまで AI に処理させたらどういう風になるか見てみたい」要望 → 既存 MaterialEditWizard (固定 12 ノード mock) を実際の Claude Opus 4.8 で置換する **Step A 実装** を着手。

| # | SHA | 内容 |
|---|---|---|
| **C70** | `8064b06` | feat: 教材体系図 AI 抽出 Server Action `extract-claude.ts` 新設 (葵 persona system prompt + 教材メタ → Claude Opus 4.8 → JSON 体系図抽出) |
| **C71** | `acbf9ec` | feat: MaterialEditWizard で Claude API flag 分岐 + async 化 (mock-extraction の照合ロジック切り出し + handleExtractionDone async + Step2Extraction にローディング UI 追加) |
| **C72** | (本 commit) | docs: Phase 6 教材体系図 AI 抽出 SSoT 同期 |

**Step 段階分け**:
- ✅ **Step A** (C70-C72): 教材メタのみで Claude 推測 (PDF 解析なし)
- (Step B) PDF.js テキスト抽出 — 検討中
- (Step C) PDF を base64 で Claude native PDF support に渡す (= 「実際の教材取り込み」感最大) — 将来

**動作の前提 env** (web/.env.local):
- `AI_EDU_ANTHROPIC_API_KEY` (Phase 6 smoke test C56 と共通)
- `NEXT_PUBLIC_USE_CLAUDE_API=true`
- dev server **再起動必須** (Next.js は env hot reload しない)

**動作確認動線**:
1. /tutor → ゆいに「計画立てよう」発話 → subject (英語) → material picker
2. 「+ 新規テキスト追加」リンク → MaterialEditWizard 起動
3. Step1: 教材名 (例「中2 英語 教科書 (光村図書)」) + 何かの PDF アップロード (PDF 自体は Step A では使われない) → 「次へ」
4. Step2: 5 秒アニメーション → 「保存に進む」クリック
   - flag=true: ボタンが「葵が抽出中…」(spin) に変化 → 数秒待ち → Claude が JSON 抽出 → Step3 (保存) に進む
   - flag=false / 未設定: 即時 mock 12 ノードで Step3 に (従来通り)
   - 失敗時: 「葵 (Claude) の抽出に失敗、mock データで先に進めるよ」Card 表示 → mock fallback で Step3
5. Step3 で保存 → ゆい「葵先生が読んだよ」発話 + 教材詳細ページに切替 → 体系図フローチャートで Claude 抽出ノードを目視確認

**Phase 6 smoke test (C56 ゆい入口 1 発話) との関係**:
- 同 env / 同モデル / 同 flag / 同 mock fallback 規律 = 設計一貫
- C56 = ゆい (担任) の発話 1 つ、C70-C72 = 葵 (教科の先生) の構造化出力

**次の段階**:
- 動作確認 (ito19 さん dev server で実際に試す)
- プロンプト調整 (Claude の出力品質を見てから)
- Step C 拡張 (PDF native 解析、別セッション)
- G1: 抽出ノードの学年/分野マッピング → C66 マトリックスに乗せる
- G2: 「読まれていない範囲」検出 → 抽出ノードと C66 範囲を比較

詳細は ARCHITECTURE.md「## カリキュラム DB 仮実装 (2026-05-28) > ### Phase 6 教材体系図 AI 抽出 (C70-C72、2026-05-28)」セクション参照。

### 2026-06-04: Phase 6 拡大 ゆい/葵 全体 Claude 化 (C73-C76)

C72 push 後、ito19 さん「Claude が入らないとイメージがつかない、入れられるところは全部入れて」要望 → A (ゆい全発話) + B1 (葵 chat) + B2 (課題 chat) + B3 (葵評価コメント) を一気に Claude Opus 4.8 化。

| # | SHA | 内容 |
|---|---|---|
| **C73** | `b649279` | feat: ゆい Claude 共通基盤 + シーン汎用化で A1-A5 全発話 Claude 化 — tutorClaudeRespondToScene (Server Action) + buildNextTutorReplyAsync 拡張 (post-process パターン) + inferSceneFromResult + buildSceneContext で計画立案 / 帰宅儀式 / ending / 朝振り返り 全 state 網羅 |
| **C74** | `d4c2df4` | feat: 葵先生 教材評価コメント Claude 化 (B3) — lib/admin/review-claude.ts + MaterialDetailView の aoiReview を useEffect Claude ロードに改修 |
| **C75** | `405385e` | feat: 葵 chat 本実装 (B1) — lib/admin/aoki-chat-claude.ts + MaterialDetailView の placeholder/disabled を本実装 (履歴 + 送信 + 教材切替で初期化) |
| **C76** | `6f4b48a` | feat: 課題 chat (IssueChat) を Claude 化 (B2) — lib/learn/issue-chat-claude.ts + buildNextIssueChatReplyAsync (post-process) + IssueChat.tsx async 化 |
| **C77** | `d73ec12` | docs: Phase 6 拡大 ゆい/葵 Claude 化 SSoT 同期 |
| **C78** | `21b1e15` | fix: 「一般的な相談」等の fallback ルートも Claude 化 + generic シーン追加 — inferSceneFromResult に `plan-start` (= subject-picker 新規表示シーン) + `generic-{stateName}` (= 明示シーン非該当の全 mock 発話) を追加、tutor-mock 全 mock 発話がほぼカバー |
| **C79** | (本 commit) | docs: 次セッション繰り越し準備 |

**Claude 化マップ (現状到達点)**:

| カテゴリ | Claude 化 | 場所 |
|---|---|---|
| ゆい入口「計画立てよう」 | ✅ C56 | tutor-claude / buildNextTutorReplyAsync |
| ゆい計画立案フロー全発話 | ✅ C73 | 同上 (post-process パターン) |
| ゆい帰宅儀式 第 1 部 + 第 2 部 | ✅ C73 | 同上 |
| ゆい ending mode | ✅ C73 | 同上 |
| ゆい朝振り返り (D5 廃止 flag off、参考) | ✅ C73 | 同上 |
| 葵 体系図抽出 (教材登録) | ✅ C70-C72 | extract-claude / MaterialEditWizard |
| 葵 評価コメント | ✅ C74 | review-claude / MaterialDetailView |
| 葵 chat (教材詳細) | ✅ C75 | aoki-chat-claude / MaterialDetailView |
| 課題 chat (IssueChat) | ✅ C76 | issue-chat-claude / IssueChat |

**動作確認動線**:
1. dev server 再起動 (Next.js は env hot reload しない)
2. /tutor で「計画立てよう」発話 → 全フロー (subject → material → duration → weak-node → roadmap → 「これで OK」) で Claude 応答 (5-15 秒待ち)
3. 帰宅儀式 (16:00 以降 自動起動 or 「ただいま」発話) → 全 state で Claude 応答
4. 教材詳細ページ → 評価コメント (Claude ロード) + 葵 chat (実対話可能) + 体系図 (登録時に Claude 抽出)
5. 課題 → 個別課題で IssueChat → 「分からない」「例えば」等で Claude 応答

**残し** (= 次セッション以降):
- B4 PDF Step C (PDF を base64 で Claude native PDF support)
- C1 F4 AI 主導ヒアリング (誤答発見)
- C2 F5 戻り誘導 (AI + 親 OPT-OUT)
- C3 試験前モード (E1-E9)
- C4 WeakNodes / NodeReviewSuggestion 自動判定
- C5 F1 内部 3 分類
- D1-D4 親 chat / 24h 異議窓口 / ゆい仲介 / carry-over

詳細は ARCHITECTURE.md「## カリキュラム DB 仮実装 (2026-05-28) > ### Phase 6 拡大: ゆい / 葵 全体 Claude 化 (C73-C76、2026-06-04)」セクション参照。

---

### 2026-06-04 後段: モデル 4.8 統一 + PDF メタ自動検知 + 一覧反映 + 教材本文理解 grill (C80-C82)

C73-C78 で Claude 化した後、ito19 さんが実際に教材登録を試して 2 つの課題を発見 → grill + 実装 + 教材本文理解システムの設計 grill。

| # | SHA | 内容 |
|---|---|---|
| **C80** | `44a02ae` | refactor: 全 AI 呼び出しのモデルを claude-opus-4-7 → claude-opus-4-8 に統一 (コード 6 箇所 + docs/コメント) |
| **C81** | `63e3931` | feat: 教材登録 Step1 に PDF メタ自動検知 (pdf.js で表紙・奥付数ページ抽出 → Claude 4.8 で教材名/科目/種別/学年 自動入力、確認あり、部分フォールバック) |
| **C82** | `d1a0964` | fix: 登録教材を materials state に push → 一覧・詳細に反映 (残課題② 解消) |

**PDF メタ自動検知 grill 6 点 / 教材本文理解システム grill 6 点 + 2 段階実装**は ARCHITECTURE「## PDF メタ自動検知 + 教材本文理解システム grill (2026-06-04)」に集約。

**教材本文理解システム (★最重要・未実装★)**: ito19 さん指摘「ティーチング (葵) には本文内容の理解が必須、今それで進んでいない」→ 現状 葵の体系図/評価/chat は全部教材名からの推測で本文を読んでいない (証拠: 真英文法大全の体系図が 4 ノード)。RAG 設計確定: 段階1 = 取り込み基盤 + 本物の体系図 (実単元・ページ範囲) + 葵 chat 場所指定型 (単元→ページ画像を Claude vision に渡す、embedding 不要)、段階2 = 横断検索 (ベクトル/embedding) + 評価コメント本文化。図解対応のため元 PDF を保存し回答時に該当ページを切り出して渡す。Phase 7 Supabase (DB/Storage/pgvector) 着手を含む。

**動作確認 (未実施、要ログイン)**: PDF メタ検知 + 一覧反映は tsc/eslint 通過済だがブラウザ動作は未確認。次セッションで `/tutor` 教材登録 → PDF アップロードでメタ自動入力 + 保存後一覧反映を確認すること。

---

### 2026-06-04 末: 段階1-A 本物の体系図 実装 (C84 WIP → ★C85 で解決済★)

> **2026-06-04 さらに後段の C85 で「目次が届かないバグ」を完全解決**。原因は当初の想定 (pdf.js が 186MB を処理しきれない) ではなく、**真・英文法大全が自炊スキャン PDF (文字レイヤー無し)** だったこと。詳細と最終解は本セクション末尾の「#### C85: バグ解決 (スキャン PDF を vision で読む)」を参照。以下 C84 時点の記録はそのまま残す。

教材本文理解 段階1-A (本物の体系図、目次ベース、mock、Supabase なし) を実装。目的 = 教材登録時に PDF の目次から実単元 + ページ範囲を Claude 4.8 で抽出し、推測 4 ノードからの脱却。設計は Plan ファイル `C:\Users\ito19\.claude\plans\tidy-kindling-creek.md` (段階1-A) 参照。

**実装 7 ファイル (tsc/eslint クリア、C84 で WIP commit)**:
- `lib/learn/types.ts`: MaterialDraft.tocText + Material.extractedNodes
- `lib/admin/pdf-extract-text.ts`: extractIngestionText (1 回で cover + toc 抽出、目次は先頭40ページ)
- `lib/admin/extract-claude.ts`: tocText 引数で目次忠実抽出 + ノード数緩和 (最大60) + **一時診断ログ `[extract diag]`**
- `components/admin/steps/Step1MetaAndUpload.tsx`: 目次抽出→draft.tocText (メタ検知と分離、メタ検知失敗でも tocText 保持) + **一時診断ログ `[ingest diag]`**
- `components/admin/MaterialEditWizard.tsx`: handleExtractionDone で tocText を extract-claude に渡す
- `components/admin/steps/Step4Save.tsx`: Material に extractedNodes 格納
- `components/materials/MaterialDetailView.tsx`: extractedNodes 優先表示 + pageRange + DisplayNode 型

**★未解決バグ (次セッション最優先)★**: 真英文法大全 (186MB) を登録しても体系図が目次ベースにならず推測のまま (14-15 ノード、実際の目次 Chapter1 時制 p.41 等と不一致)。**サーバーログで `[extract diag] material: 真英文法大全 hasToc: false tocLen: 0` を 2 回確認** = tocText が extract-claude に一切届いていない。

**原因候補 (切り分け順)**:
1. **最有力 = extractIngestionText が 186MB で失敗 or 空テキストを返す** (pdf.js が巨大 arrayBuffer を処理しきれない)。→ ブラウザ F12 Console で `[ingest diag] coverLen: ◯ tocLen: ◯` の数字 + `[PDF 抽出] pdf.js 失敗` 赤エラーの有無を確認。tocLen 0 / エラーなら抽出方式を変更 (サーバー処理 / pdf.js range request / 読むページ数を絞る等)
2. draft.tocText の closure / 配線切れ (ただし handleFile 修正後も tocLen 0 なので可能性低)
3. (届いていればプロンプト問題だが tocLen 0 なので今は除外)

**注意**:
- 診断ログ (`[extract diag]` extract-claude.ts / `[ingest diag]` Step1MetaAndUpload.tsx) は **原因特定後に削除**すること
- メタ検知 (C81) も同じ extractIngestionText 由来なので、186MB で抽出失敗ならメタ自動入力も動いていないはず (ito19 さんは手入力で「テスト」等を登録していた)
- dev server: 末時点で `bvj08rtb1` 起動中 (診断ログ込み)。サーバーログ = そのタスク output ファイル

#### C85: バグ解決 (スキャン PDF を vision で読む、2026-06-04 さらに後段)

**真因 (当初の想定と違った)**: 真・英文法大全 (186MB) は **自炊スキャン PDF = 全ページ画像で文字レイヤーが無い**。`getTextContent()` は画像から文字を取れず空を返すので、目次テキストが永遠に取れなかった (= tocLen:0 の正体)。「巨大ファイルを pdf.js が処理しきれない」ではなかった。ユーザーに PDF 種別を確認して確定。

**最終解 (= 段階1-A の実装方針)**: 文字が取れないスキャン PDF は、**目次ページを画像化して Claude (葵) に vision で読ませる**。デジタル PDF は従来どおりテキスト抽出 (安い・速い)、スキャンのみ画像にフォールバックする 2 経路。

**実装した修正 (C85、デバッグで段階的に判明した 4 つの壁を全て突破)**:
1. **スキャン判定 + 画像化** (`pdf-extract-text.ts`): テキストが閾値未満なら pdf.js の canvas でページを JPEG 描画。`extractIngestionText` は `mode: text | outline | image | empty` を返す。
2. **画像を Server Action に渡す転送** (`extract-claude.ts` / `detect-meta-claude.ts` / 各呼び出し側): 画像配列を直接渡すと Next.js の **"Maximum array nesting exceeded"** ガードで 500 → 即 mock に落ちていた。**改行 (\n) 連結の 1 文字列**にして回避 (サーバー側で split)。`next.config.ts` の `serverActions.bodySizeLimit` を 24mb に。
3. **目次の在りか** (`pdf-extract-text.ts` + プロンプト): この本は前付け (はじめに) が長く、**目次が先頭 12 ページに無かった** (cover→title→著者→はじめに…)。先頭 12 → **32 ページ**に拡大 + プロンプトで「この中からもくじを探してページ番号を読め」と指示。加えて **PDF のしおり (outline) があればそれを最優先で目次に使う** 経路を追加 (真・英文法大全には無かったので 32 枚 vision にフォールバック)。
4. **出力の切れ** (`extract-claude.ts`): 多ノード + ページ番号 + description で出力が `max_tokens: 8000` を超え JSON が途中で切れて parse 失敗 → mock。**16000 に増量 + 途中で切れても最後の完全な `}` まで救う salvage パーサ**。

**結果 (ユーザー確認済「完璧に取れました」)**: 真・英文法大全 (自炊 186MB) を登録 → 表紙 vision でメタ自動入力 (「真・英文法大全 (KADOKAWA)」) + 目次 vision で **Part 0〜5 の本物の章立て + 実ページ番号 (例 p.24-37)** が 30+ ノードで体系図化。推測 mock からの完全脱却を達成。

**この経路のコスト/UX メモ (将来の最適化候補)**:
- スキャン PDF 1 冊の登録で **32 ページ描画 (クライアント) + 32 枚を Opus 4.8 に vision (~80-120 秒)**。一回限りの登録なので許容したが重い。最適化候補 = ①低解像度サムネで先にもくじページを特定→該当数ページだけ高解像度で送る 2 パス、②しおり付き PDF を推奨。
- デジタル PDF / しおり付き PDF はこの重い経路に入らない (テキスト or outline で完結)。

**診断ログ/デバッグcoはすべて削除済** (`[extract diag]`、`[体系図抽出]`、`[PDF 抽出] mode`、目次画像のディスクダンプ、`debug-toc/` は .gitignore 済)。残した console は実エラー (`console.error`) と salvage の `console.warn` のみ。

#### 段階1-C: 一緒にめくって読む読書ビュー + 葵 vision chat (2026-06-04 末、ユーザー「ここまで OK」)

段階1-A 完成後、ユーザーが 1-C (場所指定型 vision chat) を選択 → grill で「**PDF をアプリ内に表示して生徒がめくりながら葵と一緒に読む**」型に設計を寄せた。理由 = テキストを別端末/紙で開くと往復、1 画面で完結させたい (ユーザー明言) + 生徒と葵が**同じ物理ページ**を見るので「印刷↔物理ページのオフセット問題」が本質的に消える。

**設計 (grill 確定)**: ①PDF はセッション中だけブラウザメモリ保持 (session-pdf-store、リロードで消える割り切り、永続化は 1-B) ②専用フル幅2ペイン読書ビュー (`view=material-read`、ゆい左ペインを隠す集中モード) ③入口 = 教材詳細「一緒に読む」ボタン + 体系図ノードの「読む」ジャンプ ④めくりは生徒主導 (葵は言葉で促すが画面は勝手にめくらない) ⑤葵は**今表示中ページ**を vision で読む ⑥画像は配列でなく改行連結文字列で渡す (C85 と同じ array-nesting 回避) + image block に cache_control。

**実装ファイル**:
- 新規 `lib/admin/session-pdf-store.ts` (Map<materialId, File>)、`components/materials/MaterialReadPane.tsx` (読書ビュー本体)
- `lib/admin/pdf-extract-text.ts`: `loadPdfDocument` / `renderPageToCanvas` (画面表示用) / `renderPageToJpeg` (vision 用、export) 追加
- `lib/admin/aoki-chat-claude.ts`: `currentPageImagesPacked` + `currentPageNumber` で vision 対応
- File 配線: `types.ts` (MaterialDraft.file) → Step1 → Step4Save → MaterialEditWizard → TutorWorkspace.handleMaterialAdded で setSessionPdf
- routing: `types.ts` RightPaneView に `material-read`、TutorWorkspace の viewFromParam / navigate(page param) / view===material-read でフル幅描画
- `MaterialDetailView.tsx`: 「一緒に読む」ボタン + ノード「読む」ジャンプ

**UI 反復でユーザー指摘 → 修正した点 (重要、同種実装の教訓)**:
1. 見開き (2ページ) 追加 (ユーザー要望、default ON、葵には2ページ両方渡す) + 見開き⇄単ページトグル
2. 「余白が読みづらい」→ ページ周り `p-0`・見開き隙間 `gap-0` + バー類スリム化
3. 「ページが小さいまま余白だらけ」真因 = `max-h-full` は縮小のみで拡大しない + 高 DPI で canvas 表示サイズが狂う → **ページサイズを明示計算 (fit = 幅/高さの小さい方 × zoom)** + `canvas.style.width` を論理 px で固定。**Zoom 機能追加** (−/100%/+、% クリックでフィット)。ResizeObserver で初期/リサイズ再フィット。
4. 「チャットが枠からはみ出す」→ 読書ビューのルートを `h-full` (画面全体=ヘッダーぶん溢れる) → **`flex-1 min-h-0`** に
5. 「100% で上下逆さ、150% で直る」真因 = **同一 canvas への描画競合** (ロード時に縦横比実測・ResizeObserver・初期描画が連続発火) → `renderPageToCanvas` で**直前タスクを cancel + token で最新要求だけ描画**

**残課題 / 将来**: ①リロードで PDF が消える (= 1-B Supabase 永続化で解消) ②印刷↔物理ページの精密オフセット (現状ノード「読む」は印刷番号≒物理の近傍ジャンプ、手めくりで調整) ③横長画面で高さフィット時の左右余白 (zoom で拡大可) ④見開きの左右ページ並び順 (現状は若番=左、横書き本前提)。tsc/eslint クリア。

---

## §4. 現状確認方法 (dev server で動かす)

```bash
cd C:\dev\projects\home\Ai-Education\web
npm run dev
# → http://localhost:3000 (or 表示された port)
```

### 動作確認 動線

| 機能 (実装 ID) | 試し方 |
|---|---|
| **C1 markdown** | 全 chat バブルで `**強調**` が太字レンダリングされていることを確認 |
| **C6 ハードガード** | ゆいに「不定詞ってなに?」と話す → 3 肢選択 (今すぐ葵 / メモ / 自分で考える) |
| | 「数学って何のためにやるの?」→ メタ救済でゆいが受ける |
| **C8 計画立案** | メニュー [プラン] クリック or「計画立てよう」発話 → subject → material → duration → **C17 weak-node-picker (新規)** → roadmap-preview → 「これで OK」で LearningPlan + ScheduleItem 自動生成 |
| **C9-C10 帰宅儀式** | 平日 16:00 以降に初回アクセスで自動起動 (or 「ただいま」発話 / 「もっと ▼」→「帰ってきた」) → 時限数 → 各時限ヒアリング → extraEvents → 第 2 部 today-schedule → 課題ヒアリング → 開始 |
| **C11 週次レポート** | 「もっと ▼」→「今週のレポート」 or 発話 → 右ペインに 4 セクション (達成度 75% / 学校 5 日分 / 弱いところ 5 件 / 来週計画 + Action) |
| **C11 月次レポート** | 同様、月末週は + 来月 nextMonthPlan |
| **C12 親共有** | レポート画面のヘッダ右 [親と共有] → クリックで「✓ 親と共有済」に切替 (MOCK_SHARED_TO_PARENT に push) |
| **C13 新メニュー** | `/tutor` でメニュー = `[今日のタスク (青)] [課題] [先生 ▼] [もっと ▼]` ... `[プラン (青、右端)]` |
| **C17 weak-node-picker** | 計画立案フロー中、duration-picker 直後に「重点練習したいところある?」+ 候補リスト (デフォルト preChecked 数件) + 「これでいい」ボタン |
| **C17 PlanType 明示発話** | 「**試験対策の計画立てて**」「**苦手克服したい**」「**復習だけする**」「**長期記憶化したい**」発話で対応する PlanType セットで立案開始 |
| **C18 NodeReviewSuggestion** | ゆい chat 朝開く (リロード) → 挨拶の後に「inf-adv 浅め → inf に戻ろう」提案カード + 3 択 (復習する / あとで / いらない)。「復習する」で復習 GT/SI 即時生成 |
| **C19 Replan: Interrupt** | ゆい chat 朝開く → Interrupt (5/19 数学プリント) 由来の carry-over Replan draft 提示 → 「OK 反映して」で PlanRevision push |
| **C19 Replan: 明示発話** | 「**ペース変えて**」 → pace-change draft、「**教材変える**」 → material-change draft、「**再計画して**」 → carry-over draft (quickReplies で他種類も選択可) |

### Phase 5 動作シナリオ (mock データ前提)

1. `/tutor` を開く → 朝 morning モード起動
2. 挨拶の後に 2 件の AI 介入が連続提示される:
   - **(優先 1)** Interrupt 由来の Replan draft (5/19 数学プリント、carry-over)
   - **(優先 2)** NodeReviewSuggestion (inf-adv 浅 → inf 復習)
3. 各カードに 3 択 quickReplies、本人選択で副作用 (mock データ mutation)
4. メニュー [プラン] クリック → `/tutor?view=plans` (C21 で本実装予定)、現状は LearningPlan 一覧 + 詳細パネルの skelton
5. 「計画立てる」発話 → 立案フロー (subject → material → duration → **weak-node-picker** → roadmap)

### 現状のメニュー配置
```
[今日のタスク (強調)] [課題] [先生 ▼] [もっと ▼]     [プラン (強調、右端)]
   ↑ 毎日の起点                            ↑空白↑       ↑ 節目の儀式
```

---

## §5. 次セッションで進める論点 (Phase 5 完了 + 2026-05-25 追加 grill 完了、次の着手選択)

Phase 5 全実装 (C15-C24) + 2026-05-25 追加 grill (C26、教材アップロード設計 13 確定) 完了済み。**次セッションは以下のどれかから選択**:

### 選択肢 A: Phase 6 (Claude API 接続) 開始
- ゆい先生の発話を scripted mock → Claude API に置換
- **葵先生による教材読み込み (体系図テキスト忠実 + 評価コメント 2 レイヤ、2026-05-25 grill 1 確定 8, 10, 11)**
- **教材詳細ページ (`/tutor?view=material-detail`) 新設 + 教材ごと独立葵 chat (grill 1 確定 12)**
- **MaterialEditWizard の 3 step 化 (監修ステップ撤去、grill 1 確定 9)**
- **科目追加 UI (MOCK_SUBJECTS 5 教科ハードコード + ゆいハブ科目設定パネル `SubjectSettingsPanel` + SubjectPickerCard/Step1 に「+ 新規科目」リンク、2026-05-25 grill 2 由来 S2/S6/S8/S9)**
- WeakNodes 自動判定の AI 化 (P5-Q2 の半自動 → 完全自動候補)
- pace-change Replan の monthlyRoadmap 再計算 + 未来 GT[] 書き換え 本実装

### 選択肢 B: Phase 5 細部の改善 (運用上の不足を埋める)
- pending Suggestion / Interrupt の自動生成ロジック (現状は静的 mock 固定)
- WeakNodeAddSection の永続化 (現状ローカル mutation のみ)
- Replan の SI 日付付け替えの実装本体 (現状は PlanRevision 履歴のみ)
- TodayTaskDashboard 内の SI 順序を Plan Engine 推奨順に変更 (P5-Q5 配分使用)
- material-change Replan の新 LearningPlan 自動生成
- バッジビジュアル強化 (SVG / ステッカー風)

### 選択肢 C: Phase 7 (Supabase 永続化) 設計開始
- Phase 5 で MOCK_* がさらに増えたので、永続化スキーマを grill-me で詰める
- LearningPlan / GeneratedTask / NodeReviewSuggestion / InterruptEvent / PlanRevision
- **Material / KnowledgeNode / MaterialReview / 教材 chat スレッド (2026-05-25 grill 1 由来の新エンティティ)**
- **subjects テーブル + ハードコード 5 教科保護 + 手動追加分の削除運用 (2026-05-25 grill 2 由来)**
- + RLS で家族のみアクセス、admin 通知の DB 設計

### 選択肢 D: Phase 8 (音声対話) 着手

### 選択肢 E: Phase 4 ウィザード簡素化 + 科目追加 UI ガワ — **✅ 2026-05-25/26 C28-C34 で完了**

両 grill のガワ実装 (Mock 画面反映) を C28-C34 で全て実施済み。詳細は §3「2026-05-25/26 ガワ実装 (C28-C34)」セクション参照。次は A (本物の葵 Opus 接続) か C (Phase 7 永続化) に進むのが自然 (それぞれが Phase 6 / Phase 7 そのもの)。

### Phase 5 を超える長期論点
- **Phase 6**: Claude API 接続 + 葵先生による教材体系図生成 (2026-05-25 grill 由来) + WeakNode 判定 AI 化
- **Phase 7**: Supabase 永続化 (現在の MOCK_* + 教材関連 全部を migrate)
- **Phase 8**: 音声対話 (Web Speech + OpenAI TTS)

### 残未決事項 (Phase 5 実装で意識的に Phase 6 へ送ったもの)
- pace-change Replan の monthlyRoadmap 再計算ロジック (現状は PlanRevision 履歴のみ)
- carry-over Replan の SI 日付付け替えロジック (現状は履歴のみ)
- material-change Replan の新 LearningPlan 自動生成 (現状は旧 plan paused のみ)
- WeakNodes / NodeReviewSuggestion の AI 自動判定 (現状は固定閾値 + 静的 mock)
- Interrupt の自動生成 (現状は MOCK_INTERRUPT_EVENTS 固定 2 件)
- バッジビジュアル強化 (SVG / ステッカー風)
- 親側 admin 通知 UI (admin ルート未着手)
- AchievementBadgeChip の独立コンポーネント化
- 月末週判定の正確なロジック (最終週の自動判定)
- TodayTaskDashboard 内既存 lint warning (LearnSidebar 2 件、MaterialEditDialog 3 件)

---

## §6. 次セッション開始時のスタータープロンプト

新しい Claude セッションに以下を貼ると、即作業継続できる:

```text
AI-Education プロジェクトの作業を再開します。

1. C:\dev\projects\home\Ai-Education\SESSION_HANDOFF.md の Header (冒頭「最終更新: 2026-06-08 セッション完了②」) と §5 末尾の 2026-06-08 後段ブロックを読んで状況把握。
2. ARCHITECTURE.md「## 教材詳細・一覧の再構成 (2026-06-08 後段)」「## レジュメ構想」、PHILOSOPHY.md 章6 を確認。memory MEMORY.md / project_ai_education.md も確認。
3. 前回到達点 (origin/main = 91e68ba、全コミット/push 済、migration 2 本本番適用+REST 検証済):
   - 教材詳細を 4 カードに再構成 (メタ[名前/出版社/著者]+編集を最上部 / 課題[Issue 逆引き]独立 / 学習スケジュール / まとまり一覧[ConceptSegment 統一])。体系の地図・評価コメント・教材ごと葵 chat は撤去。
   - 出版社・著者フィールド (migration 20260608010000、detect-meta 自動検知+編集、メタ編集 DB 永続化の潜在バグ是正)。
   - 表紙サムネ (migration 20260608020000、PDF を読んだ時に生成し DB 保存) + 教材一覧を本棚風グリッドに。
   - 読書ビュー「まとまり選択で一旦止まる」(「ここから読む」でガイド開始、詳細『読む』も &unit=1 で同着地)。
   - カリキュラムページ(/curriculum)削除。
4. 次の候補: 2周目 G-C 改稿 / 文字起こし「整える」/ 図クリップ / N9③戻り提案・N9④スケジュール配分 / (任意) ゆい chat の open 振り返りナッジ重複表示の調査。
5. 設計の議論は grill-me モードで 1 問ずつ (推奨案を必ず添える)。dev server: cd web && npm run dev (NEXT_PUBLIC_USE_CLAUDE_API=true、real モード前提)。各コミットで tsc/lint/build クリア+conventional commit、末尾に Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>。
別件メモ: npm run lint の wasm 由来エラーは既知・無害 (eslint.config.mjs の ignore に public/pdfjs-wasm/** を足せば解消)。

※ 以下は過去セッションのスターター履歴 (参考。最新状態は上記と Header を正とする)。

**C58 PHILOSOPHY 全書き換え** `8c5b1f0`:
- 旧 PHILOSOPHY (AI 提案ベース、ito19 さん未納得、暗記からの脱却・体系図・なぜを問う) を全廃止
- 新中心宣言: 「コーチング・ファースト型 学習アプリ」
- 読者を子供 (毎回腹落ち儀式) → 親 (アプリ使う前に必ず読む) へ転換
- 5 章構成 + 親⇄ゆいコーチ対話チャネル明示
- 差別化軸: 「AI で質疑応答」はあるが「AI でコーチング」はいない、ここが構造的空白

**C59 SSoT 同期**:
- ARCHITECTURE.md 新セクション「## 学習プラン再設計 grill (2026-05-27)」追加
- 学習プラン構造 grill 16 問 33+ 論点確定 + 未確定 7 + Phase 5 解体級判断
- フェーズ別実装ロードマップ Phase 5/6 行に「2026-05-27 解体・再構築方向」追記
- SESSION_HANDOFF Header + §3 + §6 全更新、memory 更新

**確定 33+ 論点の要旨** (詳細 ARCHITECTURE「## 学習プラン再設計 grill (2026-05-27)」):
- 思想・対象 8: コーチング・ファースト軸 / 読者=親 / 旧 PHILOSOPHY 全廃止 / 親⇄ゆい対話 4 方向 / 通信教育 (Z会・進研ゼミ等) も対象 / 学年共通基盤 / 葵=受動的補助 / 高校拡張 2 年後
- プラン構造 6: 長期計画なし / 1 ヶ月更新 / 学校+塾二系統 / 学校>塾優先 / 外部スケジュール起点 / 今日+1ヶ月全タスク
- つまずき遡及 5: 学年超え / 教材ノード生成廃止 → 小〜高カリキュラム事前 DB / 中高一貫対応 / AI 対話駆動 / 親通知絶対
- 主体性等 7: 親承認モデル (小学生) / 中学生未確定 / 弱点絶対親共有 / 朝振り返り廃止 or 小学校のみ / 帰宅後フリーに / AI 通訳 / 主用途
- 試験前モード 9: 状態モデル / ハイブリッド発火 / 3 周×重点変化 / 学校停止+塾並走 / 3 周フェーズ別配分 / コーチング駆動振り返り / 3 週前発火 / 親手入力 / 親フィードバック救済

**Phase 5 実装 (C15-C24) の扱い = 🔴 解体・再構築方向**:
- LearningPlan 9 ヶ月 + 全期間 GT 化 → 1 ヶ月更新へ
- 教材ノード生成 (葵による体系図) → 小〜高カリキュラム事前 DB へ
- 系統 = 科目別 LearningPlan → 学校 + 塾 + 通信教育の二系統へ
- 完全本人主体 (Q15) → 親承認モデル (小学生)、中学生未確定
- 朝振り返り (morning モード) → 廃止 or 小学校のみ
- 本人同意制親共有 → 弱点絶対親共有 + 親⇄ゆい対話

**Phase 7 (永続化) 着手の前に Phase 5 解体・再構築が必要**。

**Phase 6 smoke test (C56) の扱い**:
- 「計画立てよう」入口 1 発話の Opus 4.8 化 (Server Action + feature flag + mock fallback) はそのまま残置
- system prompt 内 PHILOSOPHY.md は C58 で全書き換えされた新版が反映される (動作確認推奨)
- 元の Phase 6 拡大 A-G grill (ARCHITECTURE「## Phase 6: Claude API 接続」末尾) は着手前に方針転換で保留

【セッション末で追加完了: 失敗扱い grill 6 論点 F1-F6 (C60、grill 第 19-24)】

| # | 確定 |
|---|---|
| F1 | 子供 UI ゼロ + 内部 3 種類分け (サボり / 誤答 / お休み)、子供 UI ラベルは「完了 / 次回に持ち越し / つまずき発見の機会」のみ |
| F2 | AI 自動 + 親フィードバック (E9 と同じパターン) |
| F3 | 当月内 carry-over + 3 日連続検知で親通知 (別チャット案「破綻許容設計」採用) |
| F4 | 誤答発見 = AI 主導 (ヒアリング + ミニテスト出題)、子の発話曖昧度も拾う |
| F5 | 戻り誘導 = AI 自動判定 + 親 OPT-OUT 承認 (3 日経過自動 OK、親異議で再判定) |
| F6 | 細部 5 つ (お休み除外 / 誤答 3 分類 / 連鎖遡及最大 2 学年 / 復帰判定 80% / 試験前モード中は遡及抑制) |

詳細は ARCHITECTURE.md「## 学習プラン再設計 grill (2026-05-27) > F. 失敗扱い」セクション参照。

【セッション末で追加完了: 中学生主体性 grill 6 論点 D2-1〜D2-6 (C61、grill 第 25-30)】

| # | 確定 |
|---|---|
| D2-1 | 計画立案承認権 = **OPT-OUT 親承認** (F5 戻り誘導と同型) |
| D2-2 | 動けるタイミング = **即時子発火 + 親 24h 異議窓口** (計画立案は月のタスク表示そのもので止められない、F5 の 3 日とは別設計) |
| D2-3 | 月途中変更 (子発議) = **立案と同じパターン踏襲** |
| D2-4 | 親発議 (「数学厚くして」等) = **ゆい仲介コーチングフロー (E9 汎用化)** — A4 親⇄ゆい対話 4 方向すべて使う |
| D2-5 | 親通知の透明性 = **子に明示「親にも伝えたよ」** — 思春期信頼関係の基盤、親 chat 全内容は子に見せず親本音吐露の場を保護 |
| D2-6 | 親異議処理 = **D2-4 同型、再窓口 1 回まで** (永遠ループ防止) |

→ 3 つの主要更新フロー (子発議 D2-3 / AI 発議 F5 / 親発議 D2-4) が「動く側が即時発火 + 反対側が異議窓口 (24h、ゆい仲介)」で対称構造。

詳細は ARCHITECTURE.md「## 学習プラン再設計 grill (2026-05-27) > D2 詳細」セクション参照。

【セッション末で追加完了: C2/C3 撤回 + 教材ベース体系図回帰 C69】

C68 push 後、ito19 さんから方針転換: 公的カリキュラム / ウェブ公開データから体系図を作るのは無理 (中学受験 / 塾教材 / 学校テキストでカリキュラムが大幅に異なる、特に中学受験は学習指導要領を大幅超過)。**体系図は読み込んだ教材から作る** しかない (= 当初 Phase 5 設計に回帰)。読まれていない範囲は **AI が検出 → 推奨テキスト提案 → 親承認** で補完。

| # | SHA | 内容 |
|---|---|---|
| C69 | (本 commit) | docs: C2/C3 撤回 + 教材ベース体系図回帰 + 新 G1-G5 SSoT 同期 |

- ~~C2 教材ノード生成廃止~~ → 撤回、教材ベース体系図に回帰
- ~~C3 小〜高カリキュラム事前 DB~~ → 撤回、カリキュラム DB は持たない
- 新 G1-G5 (学年/分野マッピング / 読まれていない範囲検出 / 推奨テキスト提案 / 親承認 / C66 再目的化)
- C66 /curriculum 仮実装は (b) 再目的化方針で残置 (画面構造流用、データ源を教材ベースに切替予定)
- 既存 Phase 5/6F 教材セクション (C28-C54) が本流に戻る = 解体規模縮小

詳細は ARCHITECTURE.md「## カリキュラム DB 仮実装 (2026-05-28) > ### 2026-05-28 後段: 教材ベース回帰 + 読まれていない範囲フォロー (C2/C3 撤回)」セクション参照。

【セッション末で追加完了: カリキュラム DB 仮実装 C66-C68】

ito19 さん明示「プロジェクトの核 = 小〜高カリキュラム全体を地図として持って AI がつまずきを認定 → ヒアリング → 親共有 → 再学習プラン、地図がないと議論進まない」を受けて、英語 中1〜高3 体系図の仮実装を着手。

| # | SHA | 内容 |
|---|---|---|
| C66 | `30eba7e` | feat: カリキュラム DB 仮実装 (英語 中1〜高3 体系図 約 55 ノード) + /curriculum 画面 (マトリックス + 5 色凡例) |
| C67 | `578d39f` | feat: ゆいメニューに「カリキュラム」リンクボタン追加 (教材とプランの間) |
| C68 | (本 commit) | docs: カリキュラム DB 仮実装 SSoT 同期 |

**動作確認**: `/tutor` メニュー「カリキュラム」クリック → `/curriculum?subject=english` → 6 分野 × 6 学年マトリックス、5 状態色分け (黄=AI つまずき認定、赤=戻り誘導候補が目立つ配分)。

詳細は ARCHITECTURE.md「## カリキュラム DB 仮実装 (2026-05-28)」セクション参照。

【セッション末で追加完了: 第 1 段階 mock 反映 C62-C65】

C61 直後、ito19 さん指示「C58 以降全体を mock に反映 (第 1 段階のみ、軽量範囲)」で着手。Phase 5 解体プラン確定前の軽量・即効性ある思想反映だけに絞った。

| # | SHA | 内容 |
|---|---|---|
| C62 | `5aae267` | feat: D2-5 ゆい mock に「親にも伝えたよ」発話追加 (計画立案完了 + Replan accept の 2 箇所、「24h 異議窓口」明示) |
| C63 | `e4331d9` | feat: D5 朝振り返り (morning モード) を MORNING_MODE_ENABLED フラグで off (5 セクション skip → ハブ挨拶のみ、Interrupt/Suggestion 冒頭付与は維持) |
| C64 | `960dd6c` | docs: ゆい mock の人格コメント + persona description を C58 新 PHILOSOPHY に整合 (Phase 6 Claude API system prompt 元) |
| C65 | (本 commit) | docs: 第 1 段階 mock 反映 SSoT 同期 + F1 既に整合済を確認 (現状 mock の達成 / 完了表現は F1 整合的、内部 3 分類は Phase 5 解体時) |

**動作確認**: dev server `cd web && npm run dev` 起動後、`/philosophy` (C58 新版 render) + `/tutor` (ハブ挨拶 = 朝振り返り skip) + 計画立案完了発話の「親にも伝えたよ」を目視確認。

**第 2 段階以降に持ち越し** (Phase 5 解体プラン確定後にまとめて実装): 親 chat UI / 24h 異議窓口バナー / F1 内部 3 分類 / F3 carry-over 3 日連続検知 / B1-B2 1 ヶ月更新化 / B3 二系統 / カリキュラム DB / E1-E9 試験前モード 等。

【次セッションで進める論点 — 段階1-A/1-C/1-B 完成。次は 1-B のE2E確認 → 学習プラン grill or 段階2】

**★2026-06-08 後段 (最新): R10 レジュメ(冊)管理 Phase 2 を実装・E2E 確認済・コミット済 (`e7c17f7`)★**:

**【✅ R10 Phase 2 実装済 (grill→実装→法人税 2 冊で E2E)】**:
- **grill 確定**: (1) 別冊振り分けは**同一科目内のみ** (N4・1科目1冊) / (2) 冊 UI = **科目タブの下に冊タブ** / (3) 冊削除時は**中身をデフォルト冊へ移してから論理削除** (子の本文を失わせない) / (4) 振り分けは**カードの ⋯ メニュー** / (5) 新規冊は**手入力** (自動名「○○レジュメN」初期値) / (6) 科目付け間違い修正 (NotebookLM) は**別件に後回し**。
- **`resumes-repo`**: `insertResume`(作成 Resume を返す=新冊への移動/選択用) / `renameResume` / `setDefaultResume`(対象を先に true→他を false) / `softDeleteResume`(★中身をデフォルト冊へ退避してから論理削除) / `moveEntryToResume`。
- **`TutorWorkspace`**: `resumes` を起動時 `fetchResumes` で load + 冊管理ハンドラ (全て楽観更新)。
- **`NotesHomeView` 冊タブ**: 科目タブの下に冊タブ (★デフォルト・「⋯」で 名前変更/デフォルトにする/削除・「＋冊を追加」)。表示は**選択冊の resume_id でスコープ** (デフォルト冊は未割当ピースも拾う)。冊なし時は Phase 1 科目スコープにフォールバック。追加/リネーム=Dialog、削除=確認 Dialog (「中の N 個はデフォルト冊に移ります」)。カードの「⋯」に**別のレジュメに移す** (同科目の他の冊 + 新しい冊を作って移す)。
- **学習中の「入れる冊」セレクター (R5、ito19 実機指摘「学習中にどっちの冊に入れる?」)**: `ResumePane` 上部に「入れる冊：▼○○レジュメ」(新規作成時かつ冊1つ以上で表示、2周目は変えない)。普段デフォルト・別冊はその場選択・「＋新しい冊を作る」可。`resumes`/`onAddResume` を TutorWorkspace→MaterialReadPane→ResumePane で配線。commit 時は選択冊を使い未選択 (初回) のみ ensureDefaultResume。
- **UI 微調整**: ドロップダウン `min-w-[200px]`+`whitespace-nowrap` で冊名 1 行 (折り返し解消)。
- migration **不要** (Phase 1 のテーブルで足りる)。全 tsc/lint(既知 wasm 13)/build クリア。**ito19 実機確認済「OK」**。
- **【✅ 科目付け間違いの修正「科目を直す」も実装済 (`d834192`)】**: Phase 2 grill Q6 で別件に切り出した NotebookLM 救済。カードの ⋯ に「科目を直す」→ 現在以外の全科目から選ぶと、その科目のデフォルト冊へ着地 (subject_id+resume_id 更新、出典そのまま)。`resumes-repo.moveEntryToSubject` + `handleMoveEntryToSubject` (ensureDefaultResume で着地冊確保)。tsc/lint/build クリア。
- **【✅ 「ヒントちょうだい」も実装済 (R4、`8902aed`)】**: 書く pane の「💡 ヒント」で葵が教材(vision)+概念+書いた本文を見て**答えは言わず糸口を1つ**返す。grill 確定どおり**押すごとに段階的に濃く** (hintLevel+既出ヒントを葵に渡す、答えは最後まで言わない)。`note-gate-claude.getResumeHint` (Opus、max_tokens 300) + ResumePane の水色ヒントボックス (まとまり切替でリセット、mock 付)。これで R4 (音声+ヒント) 完全実装。tsc/lint/build クリア。
- **【✅ R10 Phase 3 = 冊のコピー も実装済 (`0f1006d`、R10 全 Phase 完結)】**: 冊タブ ⋯「この冊をコピー」(全冊) → 同科目に新冊 (is_default=false) を作り中身を新 id で全複製 (出典/本文/status/メモそのまま、コピー先は元と独立)。`resumes-repo.copyResume` + `handleCopyResume` + bookDialog copy モード (名前初期値「○○ のコピー」)。tsc/lint/build クリア。**★これで R10 (Phase1/2/3 + 科目修正) 完結。**
- **【✅ ガイド読書バグ修正 (`1207837`)】**: 青枠を別ブロックへ大きく動かしても `guidedIndex` が変わらず「ここを解説」が前のブロックを読む不具合 (ito19 実機指摘) を修正。pointerUp 時に枠の中心が別ブロック(同ページ)の bbox 内なら**そのブロックを選択し直す** (元ブロックの枠は pre-drag 位置へ戻す)。小移動は従来どおり微調整保存。`EditableHighlight.onDragStart`+`preDragBboxRef`+`commitGuidedBbox`。**さらに見開きで「ページまたぎ移動」対応 (`8f77e26`)**: 選択判定を bbox 中心→指を離した画面座標 (dropClientX/Y) に変更し、各ページ canvas 矩形でヒットテスト→ドロップ先ページのブロックを選択 (反対ページへドラッグして離せる)。ito19「素晴らしい」。
- **【✅ サムネをレール幅追従で拡大表示 (`12f3c35`)】**: ito19「一枚一枚のページが小さすぎる」。`PageThumbnailRail` が ResizeObserver でパネル幅測定 (debounce 150ms) → thumbWidth [56,400]px でその解像度再描画、レール `maxSize` 240→420px。広げるとサムネが大きく・くっきりになり細部が読める。
- **【✅ 旧学習画面 /learn を廃止 (`29aab28`)】**: ito19 判断「ここで学習することはまずなくなった」。学習は読書ビュー (教材の「一緒に読む」→まとまり→レジュメ) に集約済 → `app/learn/page.tsx` を `redirect("/tutor")` に。TutorWorkspace の「学習画面へ」ボタン削除 / 学習開始系リンク (今日の学習を始める/始める/復習する/開始/StartStudyCard) を `/tutor?view=materials` へ / 各画面の「学習画面に戻る」→「司令室に戻る」(`/tutor`) / `?node=` ディープリンク → `/tutor`。**`components/learn/` のコードは残置** (MindMapPane 等が レジュメ体系図/教材詳細 で共有のため安全に削除不可)。司令室 (/tutor) が実質トップに。
- **【★次にやる候補】**: 2 周目 G-C で自分のレジュメ改稿 / 文字起こしを葵が整える「整える」/ 図クリップ / (任意) ゆい chat の open 振り返りナッジが実機で重複表示されるのを調査。

← 以下は同日 Phase 1: **R10 レジュメ(冊)管理 Phase 1 + 出典→レジュメ往復 を実装・E2E 確認済・コミット済 (`74e46a7`)★**:

**【✅ R10 Phase 1 実装済 (grill→実装→本番 migration 適用→英語/法人税 2 科目で E2E)】**:
- **grill で残り設計確定**: (a) NotesHomeView は上部**科目タブ** / (b) デフォルト冊の ensure・backfill は**オンデマンド** (ResumePane 保存直前) / (c) `resumes.subject_id` は **text** (ハードコード科目+カスタム両対応) / (d) 冊名「科目名＋レジュメ」。
- **migration `20260608000000_init_resumes.sql` (本番適用済)**: `resumes` (id/owner_id/subject_id **text**/name/is_default/deleted_at) + RLS (本人/admin) + `note_entries.resume_id uuid FK(on delete set null)` + index。
- **`lib/notes/resumes-repo.ts` 新規**: `fetchResumes` / `defaultResumeName(科目名)→"○○レジュメ"` / **`ensureDefaultResume`** (①デフォルト冊探す ②無ければ作る ③同科目の resume_id 未割当ピースを backfill ④返す)。
- **`ResumePane`**: 保存直前に ensureDefaultResume→`resumeId` を `insertNoteEntry` に渡す (冊確保失敗でも note 保存続行)。`notes-repo` は `resume_id` 列なし環境でもキー省略で保存可。
- **`NotesHomeView` (N4 違反是正)**: 科目タブ (エントリある科目のみ、override+描画時解決で **set-state-in-effect 回避**) + 科目スコープ表示 (カウント/リスト/体系図すべて) + 冊名見出し。表示は subject_id 絞りで resume レコード非依存。
- **出典→レジュメ往復 (ito19 実機指摘「出典からレジュメに戻ることも重要」)**: `MaterialReadPane` ヘッダーに「📒 レジュメを見る」(`onOpenResume`) → `navigate("notes", {subjectId})`、`NotesHomeView` の `initialSubjectId` で該当タブ初期選択 (navigate が notes view の `?subjectId=` 対応)。
- 型 `Resume` / `NoteEntry.resumeId` 追加。全 tsc/lint(既知 wasm 13 のみ)/build クリア。**ito19 実機確認済**。

**【★次にやる候補】**:
- **R10 Phase 2**: 冊の 追加 / 削除 (★デフォルト冊は削除不可・科目に常に最低1冊+デフォルト1つ) / デフォルト変更 / **別冊への手動振り分け (R5 呼び出し)**。NotesHomeView の科目タブ横に冊セレクターを足す。要 grill (UI 動線)。
- **Phase 2 で解消すべき既存データ**: 「NotebookLM 税務 AI 教材」レジュメが英語タブに居る (登録時 subjectId が subj-english)。別科目/別冊へ振り分け動線で救う。
- **R10 Phase 3**: 冊のコピー。
- その他: 「ヒントちょうだい」(答えは言わず糸口) / 2 周目 G-C で自分のレジュメ改稿 / 文字起こしを葵が整える「整える」ボタン / 図クリップ。
- **別件メモ**: `npm run lint` の wasm 由来 13 errors は `eslint.config.mjs` の ignore に `public/pdfjs-wasm/**` を足せば解消 (未対応・無害)。

← 以下は 2026-06-07 後段3: **レジュメ構想 ①+②+④core 実装・E2E 確認済 + ガイド読書 永続化★**:

**【✅ レジュメ構想 実装済 (commit `7e07fd2`〜`da0f7e3`、push 済、ito19 実機「すごくいい」)】**:
- **フェーズ① 呼び名リネーム** (子文言のみ ノート→レジュメ、`tutor-mock` の NL 分類器も同期=右ペインが開かなくなる落とし穴を回避、内部据え置き)。
- **フェーズ②+④core 横並びレジュメ pane**: 新 `components/notes/ResumePane.tsx` (教材の横で子が自分の言葉で書く) + 新 `lib/notes/note-gate-claude.ts > reviewResume()` (教材画像を vision で直接読み ◎/△/✕ の3色添削・答えは書かない・Opus 4.8・mock 付)。`MaterialReadPane` に `resumeMode` + `openResume()` (旧モーダル create を撤去)。レイアウト ［サムネ｜教材単一｜レジュメ書く｜葵 chat］横並び、**教材は単一ページ強制 (見開き禁止)**、**ガイド操作 (前/次・ここを解説・やさしく・詳しく) はレジュメ中も維持** (書きながら葵に教われる)。本文は `note_entries.ai_summary` 流用 (migration 不要)。
- **誤マッチ修正**: `ConceptSegment.id` は教材内ユニーク → 既存レジュメ検索・緑チェックを `sourceMaterialId` で必ず絞る (英語レジュメが法人税に出た実機バグ)。
- **確定フロー 3 アクション**: 任意「葵に見てもらう」(途中チェック) / **「このまとまりを仕上げる」= 関所 (必ず葵の添削、スキップ不可)** → resolved で本人が「理解済みで確定」/ 残れば「直す・今は Issue で残す」 / 「今日はここまで」= 中断 (添削なし→open)。★「税語」=「ぜいこ先生」の聞き間違い、書くのは子・AI はチェックのみ。

**【✅ R4 音声入力 実装済 (`b2442f3`、ito19「いい感じ」)】**: `types/speech-recognition.d.ts` + `hooks/use-speech-recognition.ts` (ja-JP/continuous/interim) + ResumePane に「🎤 話す/停止」(本文へ追記・live 表示・非対応はテキストのみ)。

**【★次にやる = R10 レジュメ(冊)管理 (grill 確定・段階実装、Phase1 未着手)】** (詳細 ARCHITECTURE「## レジュメ構想 > ### レジュメ(冊)管理」):
- 確定: **1 科目 1 冊が原則** (バラバラが 1 つの体系に統合)、例外で分割可 (相続税の財産評価/計算など)。科目作成で**デフォルト 1 冊自動**、まとまりがそこに溜まる。2 冊目追加・コピー・削除可。**★デフォルト冊は削除不可** (常に最低 1 冊+デフォルト 1 つ、デフォルトを消すなら別冊をデフォルトにしてから)。「レジュメにする」はデフォルト冊に自動、別冊は呼び出しで選択 (R5)。
- 要 migration: 新 `resumes` テーブル (subject_id/name/is_default) + `note_entries.resume_id`、既存ピースは科目のデフォルト冊へ backfill。**★現状の穴**: NotesHomeView が全科目混在表示 (科目で閉じてない、N4 違反) → Phase1 で修正。
- **段階**: Phase1 = デフォルト1冊自動+体系図を冊/科目スコープに+既存移行+ResumePane が resume_id を書く+冊名表示。Phase2 = 追加/削除(デフォルト保護)/デフォルト変更/別冊振り分け。Phase3 = コピー。**次セッションは Phase1 から** (migration 適用が要る)。
- その他後続: 「ヒントちょうだい」/ 2 周目 (G-C) 改稿 / 文字起こしを葵が整える「整える」/ 図クリップ。

← 以下は同 grill 確定の要旨 (R1-R8):
- R1 呼び名: ノート→**レジュメ** / ノートにまとめる→**レジュメにする** / ノート体系図→**レジュメ体系図** / 一覧→**レジュメ** / Issue 据え置き。**範囲 A = 子に見える文言のみ**改名 (内部コード `NoteEntry`/`note_entries`/`lib/notes`/型は据え置き、migration リスク回避)。
- R2 **レジュメ本文を書くのは子** (これまで能動ゲートで判定後に捨てていた"自分の言葉の説明"を本文に昇格、葵は添削だけ)。N3「AI 要約」から方針転換 (PHILOSOPHY 章 6 の原点に回帰)。
- R3 **AI のお手本要約は見せない** (写経防止の核心、添削の裏でだけ使う)。教材そのものは横に見えて OK。
- R4 **音声メイン+テキスト併用** (Web Speech API=無料・Chrome 内蔵・日本語、葵が文字起こしを軽く整えるだけ=内容は足さない、詰まったらヒント)。精度不足なら後で Whisper。
- R5 リンクは**学習しながら自動** (まとまり=1レジュメ自動オープン、必要時だけ別レジュメ呼び出し=教材横断は後乗せ)。
- R6 レイアウト: レジュメモード時 ［サムネ(任意)｜教材**単一ページ**｜**レジュメ pane**］。レジュメ pane が**葵 chat 枠を置換** (会話はその中で起きる)、教材は自動で単一ページ化。
- R7 **3 色添削** (◎合ってる/△抜け/✕違う・答えは書かず方向だけ示す)。R8 誤りゼロ&重大な抜けゼロで理解済み、中断は Issue 保存。
- **実装順 (案)**: ①リネーム (範囲 A) → ②レジュメ pane+教材単一ページ切替 → ③音声入力 → ④子が書く+3 色添削フロー (`NoteGateDialog`/`note-gate-claude` 改造、`summarizeConceptForNote`→子が書く・`judgeExplanation`→3 色添削) → ⑤自動リンク。**未決**(実装時): レジュメ本文の保存先 (`aiSummary` 流用 or 新カラム) / 「整える」と「添削」の AI 呼び出し 1 本化か / 図クリップ(後乗せ) / 2 周目 G-C 統合 / 通読→レジュメ遷移 UI。

**【ガイド読書 永続化 (commit `020bee2`・push 済、✅ E2E 実機確認済 2026-06-07)】**: `materials.guided_plans` JSONB (migration `20260607010000`・本番適用済) にガイドプランを固定保存→2 回目以降 Opus 再生成なし+青枠調整 (`block.bbox` 焼き込み) がリロード後も維持。`bboxOverrides`→`guidedPlansMap` に統一。**✅ 法人税(TAC) で実機確認** (リロード後も即表示 / 青枠ドラッグ→リロードで位置維持)。詳細 ARCHITECTURE「### 2026-06-07 後段 > #### 2026-06-07: ガイドプラン + 青枠調整を DB 永続化」。

**【別件メモ】** `npm run lint` が vendored な pdf.js wasm バンドル (web/public/pdfjs-wasm) 由来で 13 エラー (HEAD でも既存・本変更とは無関係)。`eslint.config.mjs` の globalIgnores に `public/pdfjs-wasm/**` を足せば解消 (background task 化済)。

---

**★2026-06-07 前段: 実機課題対応 — 科目永続化 + 読書ビューUI + まとまり生成 + スキャン本ページずれ + ガイド読書 (全て実機確認済・コミット済)★**:
ito19 さん実機で連続発見した課題を対応 (詳細は ARCHITECTURE「### 2026-06-07: …」+「### 2026-06-07 後段: ガイド読書…」)。
- **科目(subject)永続化** (重大欠落だった): `subjects` テーブル (migration `20260607000000_init_subjects.sql`・**本番適用済**) + `lib/subjects/subjects-repo.ts`。カスタム科目のみ DB 保存→起動時に5教科へ id dedupe マージ。`TutorWorkspace.handleSubjectAdded`/`/admin/subjects` を async DB 保存に。実機「法人税」科目+教材は REST で復旧 (孤児を新科目 uuid に再リンク+重複論理削除)。
- **読書ビュー 3 ペインのリサイズ** (`MaterialReadPane`、`ResizablePanelGroup`)。★ライブラリ仕様: 数値=px / **% は文字列 (`"15%"`)**★。狭画面は縦スタック。
- **サムネ縦スライダーのキーボード操作** (`PageThumbnailRail`、↑↓/PageUp/Down/Home/End)。
- **まとまりをアップロード時にBG生成** (`runSegmentation` を C-8 スキャン本対応に拡張)。on-demand は安全網継続。
- **スキャン本まとまり +N ずれ → vision 経路に固定 + PDFページラベル焼き込み** (`scan-segment-builder.ts` `USE_HYBRID=false` / `renderPageToJpegAt` の label 引数で左上に「PDF-N」赤バッジ → AI はそれを読んで startPdfPage を返す)。✅実機「わかりやすく」で LESSON 01=PDF22-23 (印刷14-15) と一致確認。
- **ガイド読書 (後段)**: page-walk 改修を一旦実装→ito19「子は今どこ読んでるか見えないとやりづらい」で**ブロック+「ここを解説」+青枠の元仕様に巻き戻し** (git checkout)。ズレは**青枠を直接ドラッグで手動調整** (`EditableHighlight`、移動+四隅リサイズ、`bboxOverrides` でセッション内記憶) で解決。✅実機「すごくいい」確認。レールも細く (60px) +非表示トグル。詳細 ARCHITECTURE「### 2026-06-07 後段」。
- ✅ **全て tsc/lint クリア + 実機確認 + コミット済**。

**★改善候補 (未着手・ito19 さん要望で記録): まとまり生成をサーバー側BGジョブ化★**: 現状はブラウザのタブ内で動くため (1) 完了までタブを開いたままにする必要 (2) 「アップロードだけして PC を閉じ、後で来たら全部完成」ができない。理想=使うテキストを事前一括登録→後で来たら単元一覧もまとまりも完成済み。実現には区切り処理 (vision) を Supabase Edge Function / キュー等のサーバージョブへ。Vercel 実行時間上限と vision コストに注意。**着手前に設計 grill 推奨**。詳細 ARCHITECTURE 同節末。

**✅ C85 段階1-A 完成**: 真・英文法大全 (自炊スキャン 186MB) から目次を vision で読み、Part 0〜5 + 実ページ番号を 30+ ノードで抽出。ユーザー「完璧」確認済。
**✅ 段階1-C 読書ビュー完成**: PDF をめくりながら葵と一緒に読む (見開き/ズーム/フル幅/葵が現在ページを vision)。ユーザー「ここまで OK」確認済。詳細は §3「#### 段階1-C」。
**✅ 段階1-B 永続化 実装 + E2E 確認済 (2026-06-05)**: 教材 + 体系図ノード + 元 PDF を Supabase に永続化 (リロード/別セッションで読書ビュー成立)。grill 7 点確定 + 実装 + tsc/lint/build クリア。**本番 DB (project ref rorpvpuoquobprudyrif) にマイグレーション適用済 + 無料プラン + 小 PDF で E2E 実機確認済** = 登録→裏アップロード完了通知→リロード後も一覧に残存→読書ビューが Storage から復元してめくれる、を確認。詳細は ARCHITECTURE「### 段階1-B 教材・PDF 永続化」。

**セットアップ状況 (2026-06-05 時点)**:
- ✅ マイグレーション適用済 (SQL Editor で実行、`materials` テーブル + RLS + バケット `material-pdfs` 作成済)
- ✅ `.env.local` に SUPABASE URL/ANON_KEY 設定済 → real モードで動作中
- ⏳ **Supabase Pro 化は未 (= 現状 無料プラン)**。無料は 1 ファイル 50MB 上限。**186MB の自炊スキャン本を入れる時に Pro 化 ($25/月) が必要**。それまでは ~50MB 未満の PDF なら永続化フルに動く
※ Supabase 未設定環境では自動的に mock モード (デモ 3 件、リロードで消える) にフォールバック。

**★2026-06-05 末: プロダクトの最終ゴール確定 = 「まとめノート構想」(北極星) + grill 完了 (N1-N9)★**:
ito19 さんが長い試行錯誤の末に最終ゴールを確定 → **子ども自身が AI 対話で作る、教材横断の「オリジナルまとめノート」**。コーチ(ゆい)もティーチ(葵)も最終的にこの 1 冊を育てるために働く。会計士試験の「頭の中のツールセットを外部化」= まとめノート、「分かった気」は能動ゲートで排除して刻む。**明文化 (PHILOSOPHY「章6」+ ARCHITECTURE「## まとめノート構想」) → grill-me で N1-N9 全確定** (ito19 さん「明文化→grill」指示通り)。確定内容は ARCHITECTURE「### grill 確定 (2026-06-05、N1-N9)」参照。

**N1-N9 確定要旨**: N1 概念単位(中身AI要約) / N2 子が見る地図はノート体系図③1枚のみ・教材は目次リスト・差分は内部信号でゆい小出し / N3 中身=AI要約+能動ゲート(説明orミニ確認、受け身NG) / N4 科目またがず・科目内複数可だが追加は自動メイン / N5 問題はリンクで飛ばす・**論点認定がエンジン土台** / N6 2段階戻り提案(手持ち前提→別テキスト)・前提はAI都度判断 / N7 本体は守り子は自分メモ/削除で所有・ゆいメニュー主動線 / N8 **学習概念は全部ノート・理解済み/未理解(=Issue)ステータス・未理解は定期振り返り** / N9 実装順=①ノート中核MVP→②Issue統合→③戻り提案+段階2→④プラン再設計。**北極星確定でプランの目的が「ノートを育てる」に再定義**。

**✅ N9①→②→フロー再設計 まで実装済 (2026-06-05、C91-C95)**:
- **N9① 中核 MVP (C91、E2E 確認済)**: 読む→能動ゲート→理解済みエントリ生成・永続化→ノート体系図③→出典リンク。本番 DB で実機確認 (リロード後も残存)
- **N9② open+振り返り (C93)**: 未理解(open)ステータス / NoteGateDialog 2出口+本人決定+review モードで昇格 / NotesHomeView 黄バッジ+件数 / 体系図 緑(理解済み)・黄(open) 色分け / ハブで open 1件小出し。既存 Issue は触らず加算式
- **ノート作成フロー再設計 (C94)**: 「▶ 学習を開始する」(葵が説明)+対話を反映した要約+「メモしたいことある?」取り込みで**オリジナルノート化**。まとめは常時可、ゲート任意(通過→理解済み/スキップ→open)
- **葵 chat 装飾 (C95)**: 先生アバター+吹き出し+Markdown 描画
- migration は N9① の note_entries のみ (status/user_note 列含む)、適用済。real モード稼働。詳細 ARCHITECTURE「## まとめノート構想」各サブ節

**★2026-06-06: まとめノートの「まとまり (一単元) 区切り」設計を grill 確定 (M1-M10) → 下記の通り実装済★**:
ito19 さんが読書ビューを実機で触り、**最大の欠点 = ノートが「今ページ要約」で「一単元 (まとまり) 要約」になっていない**を指摘。一単元はページにまたがるので**先に区切りを作る必要がある**。grill 結論: ①まとまり=1概念=1ノート ②範囲は AI が中身を読んで確定 (子はドラッグも数値も触らない、修正は言葉で粗く) ③(Y) AI は PDF 紙番号で中身ベース区切り、目次/印刷番号はヒント格下げ・ズレ問題消滅 ④全書プリ区切りを**登録時バックグラウンド** (スケジュールが全書区切りを要するため、PDF 種別 2 段階: デジタル=テキスト激安/スキャン=低解像度 vision) ⑤左に**縦スライダー (全ページサムネ+概念境界+色帯+ノート化済み緑、見る専用)** ⑥**2 フェーズ: 通読 (まだ刻まない) → 概念ごとまとめ** ⑦範囲提示=ノート進捗で次の未まとめ概念 or 飛んだ先の単元 ⑧要約=範囲全体 vision+対話反映 ⑨今日の範囲は複数まとまり可だがノートは概念別 ⑩**まとまり=N9④スケジュール配分の最小単位**。詳細 + 未決 (体系図②との関係/データ構造/スキャン本コスト/「学習を開始する」再構成/`findConceptForPage` の PDF-index 化) は ARCHITECTURE「### まとめノートの「まとまり (一単元) 区切り」設計」。**次 = この設計のプラン化 → 実装**。

**★2026-06-06: まとまり区切りを実装・✅デジタル本で E2E 完成 (migration 本番適用済・real 稼働)★**:
grill 確定 (M1-M10) → 実装 → 実機検証で完成。ConceptSegment 型 + migration 2本 (materials.concept_segments JSONB / note_entries.source_segment_id、**本番適用済**) + findSegmentForPage(PDF-index) + segment-claude(**Haiku 4.5**、本文を【pdf:N】タグで渡しPDF紙番号出力=ズレ消滅) + PageThumbnailRail(縦スライダー、遅延描画+概念ハイライト+緑チェック) + 読書ビュー入口=**まとまり一覧から選ぶ** (前付け除外・ページ範囲付き→選択でジャンプ+オリエン) + オンデマンド生成&DB永続化 (既存教材も再登録不要) + 評価コメント sessionキャッシュ高速化。**実機バグ3連退治**: ①前付け混入 (segmentプロンプト強化+isFrontMatterName) ②スキャン本無限ループ (attemptedSegmentation で1回) ③**自己キャンセル固着** (エフェクト deps の segmenting を除去・cancel機構撤去)。commit `53ee46c`〜`ca1b3f3` (13本)。詳細 ARCHITECTURE「### まとめノートの「まとまり (一単元) 区切り」設計 > #### 実機 E2E 確認 + 高速化 + バグ修正」。

**✅ E2E 確認済**: デジタル本「基本マスター BASIC 英文法」で 開く→数秒で単元一覧→選択でジャンプ+オリエン→ノートにまとめる→リロードで即一覧 (DB永続)。
**✅ 2026-06-06 後半: C-8 スキャン本まとまり区切り 完成 + JBIG2 wasm 描画修正 + 「AI 主導ガイド読書」設計確定**:
- **C-8 完成** (commit `7b1dc4c` wasm / `699f8cd` C-8): スキャン本でも まとまりが出る。ハイブリッド (目次体系図を Opus が 1 概念へ再グルーピング + 印刷→PDF オフセット 2 点較正) + 全ページ vision 経路。実物 TAC 法人税 (182p 自炊) で第1〜4章 26 まとまり、ito19 さん「完璧」。
- **JBIG2 wasm 修正**: pdfjs 6 の wasm 未配置で JBIG2 スキャン本のページが真っ白だった → `public/pdfjs-wasm/` 配置 + `wasmUrl` + proxy 除外で解決。スキャン本全般に効く。
- **★Lesson★**: wasm 修正前に登録したスキャン本は体系図 (`extractedNodes`) が不完全 (抽出時に目次が真っ白で読めず)。C-8 はそれを土台にするので再抽出が必要。今回は一時スクリプトで TAC を 38 ノードへ修復。**既存スキャン本の「体系図 再抽出」動線は未実装** (要追加検討)。
- **「AI 主導ガイド読書」設計確定 (G-1〜G-7) → G-A/G-B/G-C 実装済** (commit `f107ced` G-A / `c4047bf` G-B / `cf6d5e4` G-C): 受け身の生徒に葵が一区切りずつ解説。**G-A** = `buildGuidedReadingPlan` (Opus vision で教える順序ブロック列、POINT/MEMO 末尾、bbox 付き) + 1 ブロックずつ解説。**G-B** = 青枠ハイライト + タップ選択 + 見開き対応 + **選択(前/次/タップ)と解説(「ここを解説」)を分離** (順序を手動調整可)。**G-C** = 2 周目 (既ノート有無で検知、migration 不要) は難易度↑ + 要約を正式用語で深化 + 既存ノートを更新 (重複作らず open→understood 昇格)。**G-A/G-B は ito19 さん実機確認済、G-C は実機 E2E 未検証**。詳細 ARCHITECTURE「### AI 主導ガイド読書 > #### 実装 G-A/G-B/G-C」。

**次セッションの主な選択肢**:
- **G-C の実機 E2E 確認** ← まず最初に。2 周目で「難易度↑・要約が深化・既存ノートが更新 (一覧に重複しない)・open→understood 昇格」を本番 DB で確認。`cd web && npm run dev` (real モード)。
- **ガイド読書の磨き**: 青枠 bbox の精度体感 / 周回数の厳密カウント (現状 1周目/2周目以降の 2 値、必要なら `note_entries.study_count` 列) / 既存「学習を開始する」(まとまり無し本) との統合 / まとまり切替時の history クリア要否。
- **既存スキャン本の体系図 再抽出 動線** (wasm 修正前登録の本を救う、再登録なしで)。今回 TAC は一時スクリプトで修復済。
- **まとまり区切りの磨き** (任意): C-10 大きすぎ分割提案 / C-11 言葉での区切り修正 / 評価コメントの DB 永続化。
- **N9③ 戻り提案 (N6) + 段階2 横断検索 (embedding)** / **N9④ 学習プラン再設計** (まとまりが土台)。
- **1-B 仕上げ** (任意、Pro 化して 186MB 本)。

**(段階1-A 完成後の続き — 段階1 全体)**
2026-06-04 後段の grill で「葵ティーチングには教材本文の理解が必須、今それで進んでいない (体系図/評価/chat 全部推測)」が判明 → RAG 設計確定 (詳細 ARCHITECTURE「## PDF メタ自動検知 + 教材本文理解システム grill (2026-06-04)」)。段階1 全体の構成:
- 取り込み基盤 (本文全ページ抽出 → 単元ごとページ範囲 → Supabase 保存、バックグラウンド + 完了通知)
- 本物の体系図 (真英文法大全の実単元・ページ範囲、現状 4 ノード推測からの脱却)
- 葵 chat 場所指定型 (単元→ページ画像を Claude vision に渡す、embedding 不要)
- 図解対応 = 元 PDF 保存 + 回答時に該当ページ切り出し
- ※ Phase 7 Supabase (DB/Storage/pgvector) 着手を含む大規模。実装前に Plan 推奨。未決 (スキャン PDF/OCR、印刷ページ番号、Storage、embedding モデル、ページ範囲特定) は ARCHITECTURE 参照
- 段階2 (横断検索 ベクトル/embedding + 評価コメント本文化) はその後

**その前に動作確認 (未実施)**: C81 PDF メタ検知 + C82 一覧反映はブラウザ未確認 → 教材登録で PDF アップロード → メタ自動入力 + 保存後一覧反映を確認。

---

【その後の論点 — 学習プラン再設計 grill 残り 5 論点】

未確定 5 件 (本文理解システム段階1の後)、推奨着手順:

| # | 論点 | 性格 |
|---|---|---|
| 1 | **PlanType 5 種の扱い** ← 推奨スタート | 中 (Phase 5 解体級判断と直結、現行 5 種 regular/exam/weakness/review/long-term をどうするか) |
| 2 | カリキュラム DB の作成・運用 | 中 (AI 検索駆動、具体運用、信頼性担保、つまずき遡及エンジンの基盤) |
| 3 | 系統 A/B 子に見せるか | 軽 (ito19 さん「全タスク見せていい」発言、確認のみで完結可能性) |
| 4 | 時間予算自動制御 | 軽 (別チャット案、ito19 さんスルー、保留 or 採用?) |
| 5 | 2 系統の統合管制エンジン | 中 (別チャット案の核、採用?) |

**+ 2026-05-28 後段 C2/C3 撤回で新規追加された G1-G5** (= 教材ベース体系図 + 読まれていない範囲フォロー):

| # | 論点 | 性格 |
|---|---|---|
| G1 | 教材ベース体系図の学年/分野マッピング | 中 (葵 AI が判定、本流復活) |
| G2 | 「読まれていない範囲」検出ロジック | 中 (新メカニズム) |
| G3 | 推奨テキスト提案 | 中 (= 旧 C3 のミニ版、個別教材推薦) |
| G4 | 親承認フロー (推奨テキスト購入) | 軽 (D2-1 同型で吸収可能) |
| G5 | C66 マトリックス再目的化の設計 | 軽 (画面構造流用、データ源切替) |

**次セッション開始時のアスク**:
「学習プラン再設計 grill 残り 5 論点のうち、(1) PlanType 5 種扱い から始める? それとも別の論点から?」

推奨: (1) PlanType 5 種扱い = Phase 5 で実装した PlanType 5 種 (regular-study / exam-prep / weakness-fix / review / long-term) を新方針 (1 ヶ月更新・学校+塾二系統) でどう扱うか。廃止 / 再編 / 系統 (学校/塾) との関係 (= 同じ PlanType を 2 系統で使う? 系統別に PlanType セット?) を詰める。Phase 5 解体級判断と直結する論点。

なお、D2 grill のスコープ外で次に詰めるべき隣接論点 (D1→D2 切替時期 / 24h タイマー後確定処理 / 親未参加家庭フォールバック) は実装着手段階の運用 grill として残置。

【grill アプローチ】
- grill-me モード厳守 (memory feedback_grill_me.md 規律)、1 問ずつ詰める、推奨案必ず添える
- 確定論点は即 SSoT 同期: ARCHITECTURE「## 学習プラン再設計 grill (2026-05-27)」セクションへ追記 + SESSION_HANDOFF + memory
- 実装着手は 全 grill 完了 + Phase 5 解体プラン確定後 (現状 Phase 5 mock 実装は残置、新方針への移行設計を先に詰める)

【env / 動作確認時の注意】
- dev server: cd C:\dev\projects\home\Ai-Education\web && npm run dev
- env 変更後は dev server 再起動 (Next.js は env hot reload しない)
- 親 harness の env 衝突回避: Claude 関連 env は AI_EDU_* prefix (Phase 6 Lesson Learned)
- NEXT_PUBLIC_USE_CLAUDE_API=false で mock fallback 確認可能

各 commit ごとに tsc --noEmit + eslint クリアを確認、conventional commit
(feat: / fix: / docs: / refactor:) + 「なぜ / 何を / どう動くか」を本文に書く。
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com> を末尾に。

ito19 さんは grill-me モード前提 (memory feedback_grill_me.md 参照)、
SSoT 規律重視、AI 駆動開発の非エンジニア。フランクな砕けた文体で。
実装中に設計の曖昧さに気付いたら勝手に決めず grill-me で確認。
```

---

## §7. ito19 さんの開発スタイル (引継ぎポイント)

| 項目 | 流儀 |
|---|---|
| **grill-me モード** | 設計・計画議論は 1 問ずつ詰める (memory `feedback_grill_me.md` 参照)、推奨案を必ず添える |
| **SSoT 規律** | ARCHITECTURE.md と実装の乖離を嫌う → 実装時は ARCHITECTURE.md 逐次更新 |
| **commit 粒度** | 細粒度 (1 commit = 1 まとまり)、conventional commit (`feat:` / `fix:` / `docs:`) |
| **commit メッセージ** | 「何を」+「なぜ」+「どう動くか」+ ARCHITECTURE.md 連動 を必ず書く。日本語 OK |
| **branch 戦略** | main 直 push (1 人開発、feature ブランチ不使用) |
| **Co-Authored-By** | `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` を末尾に |
| **コミット前** | `tsc --noEmit` + `eslint <changed-files>` でクリアを確認 |
| **非エンジニア配慮** | ボタン名 / フロー / 挙動を chat で説明する。技術用語は最小限 |
| **メモリ重視** | 過去の決定を覚えてる前提 (memory MEMORY.md 参照)、ARCHITECTURE.md に記録された決定は尊重 |

---

## §8. 重要ファイルパス (絶対)

```
C:\dev\projects\home\Ai-Education\
├── PHILOSOPHY.md                    # 憲法
├── ARCHITECTURE.md                  # 設計 SSoT (Phase 0〜5 全て)
├── TUTOR-ROLE.md                    # ゆい先生像
├── REVIEW-2026-05-24.md             # Phase 3 レビュー
├── SESSION_HANDOFF.md               # ← 本書
├── README.md                        # プロジェクト概要
└── web/
    ├── lib/learn/
    │   ├── types.ts                 # 全型定義 (Phase 5 試作含む)
    │   ├── mock-data.ts             # mock データ全部
    │   ├── tutor-mock.ts            # ゆい先生 scripted state machine
    │   ├── tutor-teaching-guard.ts  # C6 ハードガード
    │   ├── issue-chat-mock.ts       # 葵先生 課題 chat
    │   ├── tutor-thread-storage.ts  # 1 日 1 chat 永続化
    │   ├── session-storage.ts       # セッション永続化
    │   ├── use-learning-session.ts  # セッション auto-tracking hook
    │   ├── subject-history.ts       # 科目履歴集約
    │   ├── subject-resolver.ts      # nodeId → subjectId
    │   └── mindmap-layout.ts        # 体系図レイアウト
    └── components/
        ├── chat/MarkdownText.tsx        # C1 chat 共通 markdown
        ├── reflections/ReflectionListView.tsx       # C4
        ├── reports/WeeklyMonthlyReportView.tsx       # C11-C12
        ├── tutor/
        │   ├── TutorWorkspace.tsx       # 2 ペイン司令室
        │   ├── TutorChat.tsx            # 左ペイン (C13 メニュー更新)
        │   ├── RightPaneRouter.tsx      # 右ペイン view 切替
        │   ├── TutorMessageBubble.tsx   # メッセージ + カード分岐
        │   ├── TutorArchiveView.tsx     # ゆい対話アーカイブ
        │   ├── topic-display.tsx        # 話題チップ
        │   └── cards/
        │       ├── SubjectPickerCard.tsx
        │       ├── MaterialPickerCard.tsx
        │       ├── RangePreviewCard.tsx
        │       ├── StartStudyCard.tsx
        │       ├── IssueListCard.tsx
        │       ├── TodayScheduleCard.tsx
        │       ├── ChatSearchResultCard.tsx
        │       ├── DurationPickerCard.tsx           # C8
        │       └── RoadmapPreviewCard.tsx           # C8
        ├── issues/
        │   ├── IssueChat.tsx            # 課題 chat + C5 バナー
        │   ├── IssueChatBubble.tsx
        │   ├── IssueChatComposer.tsx
        │   ├── HandoffBanner.tsx        # C5 ゆいから N 件
        │   └── cards/
        ├── subjects/SubjectHistoryView.tsx  # 科目の先生 履歴
        ├── learn/                       # 4 ペイン学習画面
        ├── schedule/                    # スケジュールダッシュボード
        ├── history/                     # 学習履歴
        ├── philosophy/PhilosophyView.tsx
        └── admin/                       # 教材登録 admin
```

---

## §9. memory ファイルとの整合

`C:\Users\ito19\.claude\projects\C--Users-ito19\memory\` の以下が関連:
- `MEMORY.md` (index)
- `user_ito19.md`
- `project_ai_education.md`
- `feedback_grill_me.md`

**memory 更新候補 (本セッション末尾で Claude が draft を出して ito19 さん確認)**:
- `project_ai_education.md` を「Phase 4 完了 + Phase 5 grill 確定 + 実装 C15-C19 完了 (C20-C23 残)」状態に更新
- C1-C19 の commit SHA リスト
- Phase 5 grill (P5-Q1〜Q7 + サブ問い) の確定内容
- 次セッションは C20 から実装継続

**memory 更新ルール (ito19 さん主導、本人指示あり)**:
- memory はユーザー主導なので、Claude が draft を出して ito19 さんが確認・保存する
- 自動で Edit せず、必ず draft 提示 → 確認の 2 ステップで進める

---

## §10. 既知の制約 / 注意事項

1. **MOCK_* は in-memory mutation**: 動的 push (C3 派生 / C8 計画 / C9-C10 帰宅 / C12 親共有) は **ページリロードで消える**。Phase 7 で Supabase 化
2. **dev server cwd**: `web/` ディレクトリで `npm run dev` 必須
3. **shell の cwd reset**: bash コマンド毎に `cd /c/dev/projects/home/Ai-Education && ...` を chain する必要 (Git Bash の挙動)
4. **CRLF warning**: `git commit` 時に `LF will be replaced by CRLF` warning が出るが無害
5. **Phase 5 試作は確定じゃない**: C14 の型 + mock は議論の叩き台、grill で詰めて書き換え前提
6. **「今日のタスク」クリック時の挙動**: C13 で UI は配置したが、クリック後の専用挙動は未実装 (既存「スケジュール」keyword 分岐に流れる)
7. **平日 16:00 以降の帰宅儀式自動起動**: 開発時に時間条件を満たさない場合、「もっと ▼ → 帰ってきた」で明示起動可能

---

## §11. grill-me モード前提 (重要)

ito19 さんは設計・計画の議論を **必ず grill-me モード (1 問ずつ詰める、推奨案を添えて聞く)** で進めたい。memory `feedback_grill_me.md` 参照。

**やってはいけない**:
- 質問を一度にまとめて投げる
- 「どう思いますか?」だけで推奨案を添えない
- 勝手に決めて実装に入る (実装中の細部判断は OK、設計レベルの判断は grill)

**やるべき**:
- AskUserQuestion で 2-4 択を出す
- 推奨案を 1 つ目に置き、理由を添える
- ito19 さんが「Other」で補足したら、すり合わせて 1 問追加

---

引継ぎ完了。次セッションは §6 のスタータープロンプトから始めてください。
