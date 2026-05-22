# ARCHITECTURE — AI-Education

実装の設計判断と全体像をまとめたドキュメント。哲学（[PHILOSOPHY.md](./PHILOSOPHY.md)）が「何のために作るか」、本書は「どう作るか」。

最終更新: 2026-05-22

---

## 全体像

### 2 層 AI アーキテクチャ

このアプリの「顔」は **担任の先生「ゆい」さん**。生徒が会いに行く・話す相手は基本的にゆい先生で、教科の中身を教える時だけ **科目の先生** にバトンが渡る。東進ハイスクールのチューター + 科目担当の関係。

| 層 | 役割 | コンテキスト範囲 | 場面 |
|---|---|---|---|
| **担任（ゆい先生）** | 生活と学習の総合アドバイザー、ルーティング、感情の受け止め | 全部（学習履歴・課題・スケジュール・過去の担任会話）| ログイン直後 / 学習の入口 / 終わり / 体調や気分の話 |
| **科目の先生**（教科ごと N 人）| 教える、論点を掘る、説明する | その科目のノード・ノート・チャット履歴 | `/learn` の DialogPane / 課題への chat（Phase 3）|

「ノードに紐づく chat」はそのまま **科目の先生の対話の保存場所** として残る。担任は別の独立スレッドを持つ（時系列に、日々の蓄積として）。

### メタ原理: 「AI と対話で全てが回る」

このアプリの操作は基本的に **ボタン1つでクリア** より **AI と話して結論を出す** が主。具体的には:

- 課題のクリア: ボタンもあるが、本来は AI と対話して詰めて消す
- 試験対策の計画: AI 壁打ちで立てる
- 朝の学習開始: 担任との対話で「今日何やる?」を決める
- 宿題: AI 伴走で「考え方を一緒に確認しながら」進む

ボタン UI はバックアップ。本道は会話。

---

## ルート構成

| ルート | 説明 | 状態 |
|---|---|---|
| `/` → `/tutor` | ログイン後の自動着地 | ✓ |
| `/tutor` | **担任ゆい先生との chat（リッチカード埋込）** | ✓ Phase 2 mock |
| `/schedule` | 学習スケジュールのダッシュボード（時間軸） | ✓ Phase 1 骨格 |
| `/learn` | 学習画面（4 ペイン: サイドバー / 体系図 / 対話 / ノート + 課題）| ✓ |
| `/learn?node=xxx&startDay=1` | 担任からのハンドオフで体系図 復元テスト → 学習 | ✓ |
| `/issues` | 課題一覧（本人発 + AI 発、状態フィルタ、AI クリア提案） | ✓ |
| `/history` | 学習履歴（サマリー + カード / カレンダー切替）| ✓ |
| `/philosophy` | AI-Education の憲法（PHILOSOPHY.md レンダー）| ✓ |
| `/test` | 悪い癖の強制矯正テスト | ✓（先行実装） |
| `/chapter-test` | 単元完了テスト（遡及式診断）| ✓（先行実装） |

---

## データモデル（mock 段階の主要型）

### 課題（イシュードリブン思考の本体）

```ts
// 本人発 / AI 発を統合した 1 つの型
Issue {
  id, nodeId
  source: "self" | "ai-detected"
  title, detail?
  status: "open" | "resolved"
  aiSuggestedClear?, aiSuggestedClearReason?
  occurrences?: IssueOccurrence[]   // 複数回発生した時の履歴
}

// セッション終了時に AI が提示する候補（採用前）
IssueCandidate {
  id, nodeId, title, detail?
  triggerMessageId?
  suggestedLinkIssueId?  // 既存課題への統合提案
}
```

旧 `Memo` 型は `Issue` の `source: "self"` に統合済み（型 alias は後方互換で残す）。

### 学習スケジュール（時間軸）

```ts
// 4 種類の source を統一して扱うための view-model
ScheduleItem {
  id
  type: "issue" | "lesson-review" | "exam-prep" | "homework"
  sourceId      // 元 source の id
  nodeId?, title, detail?
  date          // YYYY-MM-DD
  estimateMinutes?
  status: "todo" | "doing" | "done" | "skipped"
  aiRationale?  // AI がこのタスクを今日入れた理由
  doneAt?
}

ExamPrep      { id, subjectId, name, examDate, scopeNodeIds[], pageRangeNote?, ... }
Homework      { id, subjectId, name, dueDate, materialIds[], amountNote? }
LessonReview  { id, subjectId, lessonDate, topic, nodeIds[] }
```

### 担任 chat

```ts
TutorMessage {
  id, role: "tutor" | "learner"
  text?
  card?:                              // 埋め込みリッチカード（最大 1 つ）
    | SubjectPickerCard
    | MaterialPickerCard
    | RangePreviewCard                // 体系図の範囲ハイライト
    | StartStudyCard                  // /learn?node=...&startDay=1 への CTA
  quickReplies?: string[]             // クイック返信チップ
  createdAt
}

TutorThread { id, learnerId, messages: TutorMessage[] }
```

### 学習セッション

```ts
LearningSession {
  id, learnerId
  startedAt, endedAt?, endReason?
  visitedNodeIds[], messageCount, noteEditCount
  reconstructionResult?     // 復元テスト 正解 N/N
  summary?: { learned[], questions[] }
  subjectId?, comprehensionScore?
}
```

---

## フェーズ別 実装ロードマップ

| フェーズ | 内容 | 状態 |
|---|---|---|
| **Phase 0**（先行） | `/learn` 4 ペイン、`/test`、`/chapter-test`、認証、Supabase 基盤 | ✓ 完了 |
| **Phase 1** | `/schedule` ダッシュボード骨格 + 4 task type の mock データ + サイドバー最上位 | ✓ 完了 |
| **Phase 2** | 担任「ゆい」chat (mock)、リッチカード（教科 / 教材 / 範囲 / 開始）、`/` → `/tutor` redirect | ✓ 完了 |
| **Phase 3** | 課題（Issue）への chat 統合: 各課題に専用 chat スレッド、AI と対話してクリア | 未着手 |
| **Phase 4** | 宿題タスク + AI 伴走 chat（「考え方を一緒に確認しながら」）| 未着手 |
| **Phase 5** | 授業の新しい学び（本人入力 → 復習タスク自動生成）| 未着手 |
| **Phase 6** | Claude API 接続、scripted mock を本物の対話に置換 | 未着手 |
| **Phase 7** | Supabase スキーマ + mock → 永続化 | 未着手 |
| **Phase 8** | Web Speech API（STT）+ OpenAI TTS で音声対話 | 未着手 |

---

## 設計判断 — grill-me で確定したもの

### 課題機能（`/issues`）

| 論点 | 確定 |
|---|---|
| 発生源 | AI 発（会話の中で「届いていない」と検知）+ 本人発（手動）の 2 系統 |
| AI 発の登録 | セッション終了時にまとめ提示 → 本人がチェック |
| クリア条件 | 本人手動 + AI 提案 を両方用意 |
| メモとの関係 | 既存 Memo を `Issue (source: "self")` に統合（一本化） |
| 単位（同トピック複数発生）| AI が「既存課題に紐付け?」と毎回提案 → 本人選択 |
| クリア儀式 | 即クリア（本人信頼）。AI は裏で見ている |

### スケジュール（`/schedule`）

| 論点 | 確定 |
|---|---|
| 画面表示 | ダッシュボード型（上ヘッダ + 今日 + カレンダー 並列） |
| 「今日のタスク」生成 | AI 提案 → 本人編集 → 確定（毎朝の儀式） |
| 試験対策の作成 | AI 壁打ち chat 形式（Phase 2+ で実装） |
| 宿題への AI 関与 | 答えではなく「考え方を伴奏」する形 |

### 担任 chat（`/tutor`）

| 論点 | 確定 |
|---|---|
| 担任の登場 | 毎ログイン必ず担任ランディング（東進「チューター席に必ず座る」スタイル） |
| chat の構造 | 会話 + リッチ UI 部品が埋め込まれる |
| 担任のキャラ | 大学生のお姉さんチューター（フランク敬語ベース、20 代前半、距離近め） |
| 名前 | ゆい |
| 科目の先生との関係 | 担任は教えない。教えるのは科目の先生。担任はルーティング + 感情の受け止め + 横断的把握 |

### 復元テスト（体系図 思い出す訓練）

| 論点 | 確定 |
|---|---|
| 表示タイミング | デフォルト非表示。担任 chat の「学習を始める」ボタン経由（`?startDay=1`）でのみ表示 |
| ドラッグ正解 | 即時 ✓ で確定、ラベルはトレイから消える |
| ドラッグ誤答 | 即時 ✗ で 1 秒赤フラッシュ → ラベルがトレイに戻る（再挑戦可）|
| 一括「答え合わせ」 | 撤去（即時判定で不要） |

---

## コンポーネント構成

```
app/
├── page.tsx                        # / → /tutor へ redirect
├── tutor/                          # 担任 chat（Phase 2 のメインランディング）
│   ├── page.tsx
│   └── TutorClient.tsx
├── schedule/                       # 学習スケジュール ダッシュボード
│   └── page.tsx
├── learn/                          # 学習画面（4 ペイン）
│   └── page.tsx
├── issues/                         # 課題一覧
│   ├── page.tsx
│   └── IssuesClient.tsx
├── history/                        # 学習履歴
│   └── page.tsx
├── philosophy/                     # AI-Education の憲法
└── test/, chapter-test/, login/, auth/, admin/

components/
├── tutor/                          # ★ 担任 chat
│   ├── TutorChat.tsx               # 全体レイアウト、scroll、AI 応答演出
│   ├── TutorAvatar.tsx
│   ├── TutorMessageBubble.tsx
│   ├── TutorComposer.tsx           # テキスト + クイック返信 + 音声入力ボタン
│   └── cards/
│       ├── SubjectPickerCard.tsx
│       ├── MaterialPickerCard.tsx
│       ├── RangePreviewCard.tsx
│       └── StartStudyCard.tsx
├── schedule/                       # ★ ダッシュボード
│   ├── ScheduleDashboard.tsx       # 全体レイアウト
│   ├── ScheduleHeader.tsx          # 試験まで / 未クリア課題 / 今週の予定
│   ├── TodayTaskList.tsx           # 今日のタスク（タイプ別アイコン、AI rationale）
│   ├── ScheduleMiniCalendar.tsx    # 2 週間ミニカレンダー
│   ├── TaskSourcesPanel.tsx        # 試験対策 / 宿題 / 授業 / 課題の登録パネル
│   └── ScheduleTaskTypeIcon.tsx    # 4 task type 共通の icon / tone / label
├── issues/                         # ★ 課題一覧
│   └── IssueListView.tsx
├── history/                        # ★ 履歴
│   ├── HistoryView.tsx
│   ├── HistorySummary.tsx          # 週/月の集計 + 科目別バー
│   └── HistoryCalendarView.tsx     # 月単位カレンダー
├── learn/                          # 学習画面
│   ├── LearnWorkspace.tsx          # 親 + state
│   ├── LearnSidebar.tsx            # サイドバー（担任 / スケジュール / 課題 / 履歴 / 憲法 / 教材 / ゴミ箱）
│   ├── LearnHeader.tsx
│   ├── MindMapPane.tsx
│   ├── DialogPane.tsx
│   ├── NotePane.tsx                # ノート + 課題（本人発 新規追加 UI）
│   ├── MindMapReconstructionTest.tsx   # 即時 ✓ / ✗ フィードバック
│   ├── SessionEndDialog.tsx        # 終了時の AI 候補チェックリスト
│   ├── TrashSheet.tsx
│   └── MaterialEditDialog.tsx
└── philosophy/

lib/learn/
├── types.ts                        # KnowledgeNode / Issue / ScheduleItem / TutorMessage / ...
├── mock-data.ts                    # 中2 英語文法 33 ノード + 全 mock データ
├── tutor-mock.ts                   # 担任の persona + 状態機械（scripted）
├── use-learning-session.ts         # セッション auto-tracking hook
└── mindmap-layout.ts
```

---

## ユーザー体験フロー（現状の mock）

### 朝の儀式（理想形）

1. 娘さん、`/` を開く → `/tutor` に redirect
2. ゆい先生「**おかえり！今日はどんな一日だった?**」+ クイック返信チップ
3. 「ちょっと疲れた」を選ぶ → ゆい「**そっか、それはキツいね…無理しすぎないでね**」+「軽めにする? いつもどおり?」
4. 「軽めにしたい」 → ゆい「**了解！短めでいこう。何の教科にする?**」+ **教科ピッカーカード**
5. 英語選択 → ゆい「**英語ね！テキストはどれにする?**」+ **教材ピッカーカード**
6. 教科書選択 → ゆい「**OK、教科書ね。今日のところはこのへんを考えてる。**」+ **体系図プレビューカード**（不定詞 3 用法 にハイライト）
7. ゆい「**じゃあ始めようか！**」+ **「今日の学習を始める」CTA**
8. クリック → `/learn?node=inf-noun&startDay=1` へ → **体系図 復元テスト**（ドラッグで思い出す訓練、即時 ✓ / ✗）
9. テスト終了 → 学習画面 (`/learn`) で対話学習
10. 「学習を終了」 → SessionEndDialog → AI が見つけた課題候補をチェック → `/issues` に追加
11. 翌朝 1. に戻る

### 担任の対話とハンドオフ

担任は学習中ずっと張り付いているわけではない（Phase 2 では）。**入口** で会い、**出口** で振り返る（後者は今後実装）。学習中の対話は科目の先生（既存 DialogPane）が引き継ぐ。

---

## 意図的に未実装（次の指示待ち）

| 項目 | フェーズ |
|---|---|
| Claude API 接続（mock スクリプトを本物の対話に置換）| Phase 6 |
| Web Speech API (STT) + OpenAI TTS（音声対話）| Phase 8 |
| Supabase スキーマと mock → 永続化 | Phase 7 |
| 課題（Issue）への専用 chat スレッド | Phase 3 |
| 試験対策の AI 壁打ち作成画面 | Phase 2+ |
| 宿題の伴走 chat（考え方を一緒に確認）| Phase 4 |
| 授業の新しい学びの登録 → 復習タスク自動生成 | Phase 5 |
| セッション終わりに担任が「お疲れさま」儀式 | Phase 2+ |
| 複数日の担任 chat の永続化と継続性 | Phase 7 |
| Vercel 本番デプロイ + ドメイン設定 | MVP 完成後 |

---

## 設計の核（一行で）

> ログインしたら担任「ゆい」さんが必ず出てくる。会話してから学習に行く。学習中の詰まりは AI が拾って課題一覧に積み、後で対話で潰す。すべて時間軸（スケジュール）の上で動く。**「自分一人で決めない、AI と対話しながら決める」を全体の仕組みに**。
