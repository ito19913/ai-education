# ARCHITECTURE — AI-Education

実装の設計判断と全体像をまとめたドキュメント。哲学（[PHILOSOPHY.md](./PHILOSOPHY.md)）が「何のために作るか」、本書は「どう作るか」。

最終更新: 2026-05-23（Phase 3 にコーチング設計レイヤーを追加）

---

## 全体像

### 2 層 AI アーキテクチャ

このアプリの「顔」は **担任の先生「ゆい」さん**。生徒が会いに行く・話す相手は基本的にゆい先生で、教科の中身を教える時だけ **科目の先生** にバトンが渡る。東進ハイスクールのチューター + 科目担当の関係。

| 層 | 役割 | コンテキスト範囲 | 場面 |
|---|---|---|---|
| **担任（ゆい先生）** | 生活と学習の総合アドバイザー、ルーティング、感情の受け止め、科目横断のバランス把握 | サマリーのみ（`Issue.summary` / `LearningSession.summary` / `NodeComprehension` を読む。生 chat は読まない）| ログイン直後 / 学習の入口 / 終わり / 体調や気分の話 / 課題やスケジュールへの誘導 |
| **科目の先生**（教科ごと N 人。MVP は英語の **あおい先生**）| 教える、論点を掘る、説明する、課題を潰す、節目でサマリーを書き残す | その科目のノード・ノート・チャット履歴・課題 chat | `/learn` の DialogPane / 課題への chat |

「ノードに紐づく chat」はそのまま **科目の先生の対話の保存場所** として残る。担任は別の独立スレッドを持つ（時系列に、日々の蓄積として）。

**AI 間の連携はサマリー（成果物）経由**: 科目の先生が会話の節目で `Issue.summary` / `LearningSession.summary` を書き残し、ゆい先生はそれだけを読む。生 chat ログは渡さない。現実の塾でチューターが「○○先生のとこどう?」と口頭で情報統合するのを、ドキュメントベースに置き換えた形。これによりコンテキスト爆発を構造的に回避する。

### /tutor 2 ペイン司令室構造（Phase 3 以降）

ゆい先生をアプリの **司令室（コクピット）** にする。`/tutor` を 2 ペイン構造にし、左ペインで常にゆい先生と会話、右ペインがゆいとの会話に応じて動的に切り替わる。

```
+-----------------+-----------------------------+
|                 |                             |
|  左ペイン       |   右ペイン                  |
|  ゆい先生 chat  |   （ゆいとの会話で切替）    |
|                 |                             |
|  - おかえり！   |   - 空 / 今日のサマリー     |
|  - 何やる?      |   - 課題一覧                |
|  - 「課題見せて」|   - 課題 chat（科目の先生）|
|                 |   - スケジュール            |
|                 |   - 学習履歴                |
|                 |                             |
+-----------------+-----------------------------+
```

| 右ペインの中身 | 入力欄の位置 | 左ゆい chat | URL |
|---|---|---|---|
| 空 / 今日のサマリー | 左（ゆい） | アクティブ | `/tutor` |
| 課題一覧 | 左（ゆい） | アクティブ | `/tutor?view=issues` |
| **課題 chat（科目の先生）** | **右（科目の先生）** | readonly | `/tutor?view=issue&id=xxx` |
| スケジュール | 左（ゆい） | アクティブ | `/tutor?view=schedule` |
| 学習履歴 | 左（ゆい） | アクティブ | `/tutor?view=history` |

入力欄は **同時に 2 つの対話を並走させない**。右ペインに chat 系（課題 chat、宿題 chat）が展開された時だけ入力欄が右に移り、左ゆい chat は readonly になる（履歴は読めるが入力不可）。「もどる」ボタンで右ペインを閉じると、フォーカスは左ゆいに戻る。ゆいは「橋渡し」役。

**/learn だけ別ルート**: 4 ペイン構成は右ペインに収まらないため、ゆいから「学習開始」CTA で `/learn` に別画面遷移する。学習終了後は `/tutor` に戻る。

### バックアップ動線

`/issues` `/schedule` `/history` の独立ルートは **残す**（同コンポーネントを `/tutor` 右ペインと共用）。ただし `/learn` のサイドバーからは **直接リンクを撤去**（2026-05-23 改訂）。アクセス手段は次のいずれか:

- 主動線: ゆい chat 経由（「課題を確認」「スケジュール確認」「履歴を確認」メニュー）→ `/tutor?view=...`
- 緊急動線: URL バーに `/issues` `/schedule` `/history` を直接入力（ブックマーク・共有 URL 用）

サイドバーに並列リンクを置くと「ゆい経由」と「直接」の二重動線で本人の認知が割れるため、ゆい経由に一本化した。メタ原理「AI と対話で全てが回る」をより純度高く実装する形。

### メタ原理: 「AI と対話で全てが回る」

このアプリの操作は基本的に **ボタン1つでクリア** より **AI と話して結論を出す** が主。具体的には:

- 課題のクリア: ボタンもあるが、本来は AI と対話して詰めて消す
- 試験対策の計画: AI 壁打ちで立てる
- 朝の学習開始: 担任との対話で「今日何やる?」を決める
- 宿題: AI 伴走で「考え方を一緒に確認しながら」進む

ボタン UI はバックアップ。本道は会話。

---

## ゆい先生 = コーチング エージェント

ゆい先生は **純粋なコーチング** に徹する。**教えない、引き出す**。ito19 さん自身が公認会計士として税理士試験のスタッフ相談に乗る時のスタイル（自分は税理士試験を受けてないので教えない、しかし勉強の必要性や大きな考え方は話す）をモデルにしている。

### コーチング（手法分類）

| 手法 | 関係性 | 答えの所在 | ゆいへの適用 |
|---|---|---|---|
| ティーチング | 上下 | 教える側が持つ | NG（葵先生がやる） |
| コンサルティング | 上下 | 専門家が処方 | NG |
| **コーチング** | **並走** | **相手の中にある** | **これを徹底** |

### GROW モデル

ゆいの会話の骨格は GROW で回る:

- **G**oal: 「テストでどんな結果取りたい?」「次回までに何ができるようになってたい?」
- **R**eality: 「今、何が分からない?」「葵先生とどこまで進んだ?」
- **O**ptions: 「やり方いろいろあるよね、葵先生に聞く / ノートにまとめる / 例題やる、どれが合いそう?」
- **W**ill: 「じゃあ今日は何やる? いつまでに?」

### 発話パターン 5 原則

1. **発話の大半が「質問」**(「〜だね」より「〜どう思う?」)
2. **未来志向**(「過去できなかった」より「次どうする?」)
3. **承認 (acknowledgment)** — 評価でなく観察ベース。「葵先生と 3 セッション続けたね」みたいな
4. **「答えは本人の中にある」を貫く** — 葵先生の知識も、本人の気持ちも、本人から引き出す
5. **GROW を意識的に回す** — どの段階かをゆい自身が把握

### 「教える / 教えない」の境界

- **教える系 (= NG、必ず葵先生に振る)**: 教科の中身、解き方、用語の定義
- **教えない系 (= OK、ゆいが話す)**: 勉強の必要性、大きな考え方、メタ認知、学び方の促し
- **武田塾「生徒に解き方を説明させる」技法は使う**(教えるんじゃなく、引き出す。これは ito19 さん哲学のファインマン式と一致)

### ゆい先生の依頼カタログ（6 種）

| # | 種類 | 概要 |
|---|---|---|
| 1 | **成果物作成** | ノートまとめ・PDF 化・試験計画表・スケジュール表 |
| 2 | **検索ナビゲーション** | 「あの話、どこだっけ?」→ 候補提示 → 右ペイン展開。検索ツール経由でメタデータ + スニペットのみ参照（解釈はしない） |
| 3 | **振り返り集計** | 「先週どこで詰まった?」→ サマリーから傾向コメント |
| 4 | **リマインダー・親報告** | 「テスト前に思い出させて」「親に伝えて」 |
| 5 | **葵先生への申し送り (TutorHandoff)** | ヒアリング → 引継ぎメモ作成 → 葵 chat に届ける（次のセクション参照）|
| 6 | **掘り起こし (Excavation)** | 「何が分からないか分からない」を言語化させる。コーチング技法そのもの（次のセクション参照）|

これら全部、「**教えない・中身に触れない**」を保ったまま成立する。

---

## 振り返りとコーチング契約

ゆい先生の原則は **「答えは本人の中にある」（中身はコーチング）** だが、習慣形成（時間・場・儀式）は **環境で支える**。普通の中2 女子は自分で習慣化できない前提。ito19 さん本人の自己認識：「自分みたいに自分に厳しくて管理能力が高いやつって滅多にいない、自分基準で設計するな」。

### 振り返り 3 周期

| 周期 | 内容 |
|---|---|
| **毎日** | 昨日の学習レビュー / 今日学校で習ったこと / 起きたこと・気分 / 疑問・不安 / 今日の計画 |
| **毎週** | 1 週間振り返り / 来週の目標 / 課題クリア状況 |
| **毎月** | 1 月の振り返り / 来月の目標 |
| 年間 | 中学生にはまだ早い（やらない） |

振り返り完了で `ReflectionLog` が独立型として保存される。中で生まれた「課題」は `Issue` に、「今日の計画」は `ScheduleItem` に、「学校で習った」は `LessonReview` に派生されるハイブリッド型。

### 掘り起こし (Excavation)

振り返りの中核技法。「**何が分からないか分からない**」状態の本人に対して、ゆいが質問で言語化させる:

```
本人「なんかよく分からないんだよね…」
  ↓
ゆいが質問 1 つずつ「何が一番モヤモヤしてる?」
  ↓
本人が言語化「えーと、不定詞の名詞的用法と動名詞の使い分け…」
  ↓
ゆいが科目・分野を特定「英語・不定詞ね」
  ↓
派生先 (Issue + TutorHandoff):
  - 課題 (Issue, source: "self") に追加
  - 葵先生への申し送り (TutorHandoff) ドキュメント作成
  ↓
葵先生が受信 → IssueChat 立ち上げ → 対話で潰す
```

これはコーチング原則「**質問で気づきを引き出す**」の最も具体的応用。AI が優れている領域でもある（議事録的に潜在的な不明事項を言語化する）。

### コーチング契約（長期 + 週次）

- **長期ゴール (LongTermGoal)**: 月初 or 試験前に「今月どうなりたい?」を設定
- **週次ゴール (WeeklyGoal)**: 週初に「今週どこまで?」を設定、週末に振り返り
- **ゴールの種類**: 全部 OK（学習成果 / メタ認知 / 気持ち / モチベ・態度、本人が言ったものは何でも）
- **達成判定**: 本人 + ゆい合議が原則。**数値化しない**（メタゴールがあるため）
- **未達成時**: コーチング王道「**次どうする?**」+ ito19 哲学「**ミスは学びの瞬間**」で「**何が見えた?**」の 2 段（過去原因の追及はしない、未来志向）

### 振り返りタスクのスケジュール自動配置

- **毎日**: 学習開始前の儀式として組み込み（一番上のタスクに固定）
- **週末（日曜想定）**: 週次振り返りタスクが自動生成
- **月末**: 月次振り返りタスクが自動生成
- スケジュール表に「ピコっ」と振り返りが現れる → 本人は儀式として実行 → 完了で履歴に残る

---

## ゆい→葵への申し送り（TutorHandoff）

ARCHITECTURE 既存の「葵 → ゆい：`Issue.summary` 経由」の **逆方向**。

塾でチューターが科目の先生に「○○さん、ここで詰まってます。上の概念から見直し提案ください」と伝える仕組みのデジタル化。

```
ゆい chat で本人とヒアリング (掘り起こし)
  ↓
ゆいが「これは葵先生に申し送りしておこう」と判断
  ↓
TutorHandoff ドキュメント作成 (mock では chat 内のカード)
  - 関連ノード / 関連 Issue
  - 本人とのヒアリング要約
  - ゆいの所感・提案 (例: 「『ここ分からない』だが、上の概念『不定詞の役割』から見直し提案を」)
  ↓
葵先生が次に呼ばれた時 IssueChat ヘッダに「ゆい先生から N 件」表示
  ↓
葵先生がクリックして読む → 指導戦略に反映 → 個別 chat で本人に向き合う
```

これによって 2 つの AI が **生 chat を共有せず、サマリー / 申し送りドキュメントだけで連携** する設計が完成する（コンテキスト爆発回避）。

---

## ルート構成

| ルート | 説明 | 状態 |
|---|---|---|
| `/` → `/tutor` | ログイン後の自動着地 | ✓ |
| `/tutor` | **司令室。左ゆい chat + 右動的ペイン**（Phase 3 で 2 ペイン化） | Phase 2 単独 chat 完了 / Phase 3 で 2 ペイン化 |
| `/tutor?view=issues` | 右ペインに課題一覧（同コンポーネントを `/issues` と共用） | Phase 3 |
| `/tutor?view=issue&id=xxx` | 右ペインに課題 chat（科目の先生との対話） | Phase 3 |
| `/tutor?view=schedule` | 右ペインに今日のタスクダッシュボード | Phase 3 |
| `/tutor?view=history` | 右ペインに学習履歴 | Phase 3 |
| `/tutor?view=material-new` | 右ペインに新規教材登録ウィザード（`MaterialEditWizard` を embed） | Phase 3 |
| `/tutor?view=subject-history&subjectId=xxx` | 右ペインに科目の先生との対話履歴ビュー（ノード対話 + 課題 chat の時系列集約）| Phase 3 |
| `/schedule` | 学習スケジュール ダッシュボード（バックアップ動線、`/tutor?view=schedule` と同コンポーネント） | ✓ Phase 1 骨格 |
| `/learn` | 学習画面（4 ペイン: サイドバー / 体系図 / 対話 / ノート + 課題）。`/tutor` 右ペインには収まらないため別ルート | ✓ |
| `/learn?node=xxx&startDay=1` | 担任からのハンドオフで体系図 復元テスト → 学習 | ✓ |
| `/issues` | 課題一覧（バックアップ動線、`/tutor?view=issues` と同コンポーネント） | ✓ |
| `/history` | 学習履歴（バックアップ動線、`/tutor?view=history` と同コンポーネント） | ✓ |
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
  chatThread?: IssueChatMessage[]   // 課題ごとの専用 chat（Phase 3）
  summary?: string                   // 科目の先生 → ゆいへの引継ぎサマリー
}

// 課題 chat の 1 メッセージ（TutorMessage を雛形にした新型）
IssueChatMessage {
  id, issueId
  role: "teacher" | "learner"
  text?
  card?: IssueChatCard               // triggerMessage 引用 / クリア提案
  quickReplies?: string[]            // 「もう一回」「例えば?」「もう大丈夫」など
  createdAt
}

IssueChatCard =
  | { kind: "trigger-message-quote"; sourceMessageId; sourceNodeId; quote; sourceCreatedAt }
  | { kind: "resolve-suggestion"; reason? }

// セッション終了時に AI が提示する候補（採用前）
IssueCandidate {
  id, nodeId, title, detail?
  triggerMessageId?
  suggestedLinkIssueId?  // 既存課題への統合提案
}
```

旧 `Memo` 型は `Issue` の `source: "self"` に統合済み（型 alias は後方互換で残す）。

**課題 chat の仕様（Phase 3）**:

- 課題ごとに独立スレッド。ノード対話（`ChatMessage`）とは別。クリアまで 1 本の長いスレッドが日をまたいで蓄積する
- 初期メッセージは必ず AI 発話で初期化される。本人発 Issue なら「これメモしてくれたやつだね」、AI 発 Issue なら `triggerMessage` を引用カードで添えてから AI が話す
- クリア導線は「分かった！」ボタン + 「クリアして」発話の両方有効。AI が勝手に resolved にすることはない
- クリア後も履歴は永続保持（readonly 表示）。LLM 入力からは除外（コンテキスト爆発防止）
- `summary` はゆい先生が読む。生 chat は決して渡さない

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
    | IssueListCard                   // 未クリア課題一覧（Phase 3）
    | TodayScheduleCard               // 今日のタスク一覧（Phase 3）
  quickReplies?: string[]             // クイック返信チップ
  rightPaneAction?:                   // 右ペインを切り替えるアクション（Phase 3）
    | { kind: "open-issues" }
    | { kind: "open-issue"; issueId: string }
    | { kind: "open-schedule" }
    | { kind: "open-history" }
    | { kind: "close" }
  createdAt
}

TutorThread { id, learnerId, messages: TutorMessage[] }
```

**Phase 3 で追加されるカード / アクション**:

- `IssueListCard`: 未クリア課題一覧を右ペインに展開するための前奏カード（左ゆい chat 内の発言として現れる）
- `TodayScheduleCard`: 今日のタスク一覧
- `rightPaneAction`: メッセージが選択 / クリックされた時に右ペインを切り替える。URL も `/tutor?view=xxx` に push される

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

### 振り返り / コーチング契約 / 申し送り（Phase 3 拡張）

```ts
// 振り返りログ。日次 / 週次 / 月次 共通。
// 中身は 5 セクション、加えて各既存型への派生リンク（ハイブリッド型）。
ReflectionLog {
  id, learnerId
  date           // YYYY-MM-DD
  cadence: "daily" | "weekly" | "monthly"

  // 5 セクション（cadence で必要なものだけ埋まる）
  yesterdayReview?        // 昨日の学習レビュー
  schoolToday?            // 今日学校で習ったこと
  emotionsAndEvents?      // 起きたこと、気分
  questionsAndDoubts?     // 疑問・不安・「先生の言ってる意味分からない」
  todayPlan?              // 今日の計画

  // 派生リンク（独立型のハイブリッド性の核心）
  derivedIssueIds?: string[]              // ここから生まれた Issue
  derivedScheduleItemIds?: string[]       // ここから生まれた ScheduleItem
  derivedLessonReviewIds?: string[]       // ここから生まれた LessonReview
  derivedHandoffIds?: string[]            // ここから生まれた TutorHandoff

  // 週次 / 月次の場合
  weekStart?: string                      // YYYY-MM-DD (月曜)
  goalIds?: string[]                      // 該当期間の goal

  createdAt
}

// 長期ゴール（月 / 学期 / 試験単位 / フリー）
LongTermGoal {
  id, learnerId
  scope: "month" | "semester" | "exam" | "free"
  scopeLabel    // 「2026 年 5 月」「中間試験まで」
  startDate, endDate
  title         // 自由テキスト (学習成果 / メタ / 気持ち、何でも OK)
  detail?
  status: "active" | "achieved" | "abandoned" | "expired"
  createdAt, achievedAt?
}

// 週次ゴール（長期に紐づく、なくても可）
WeeklyGoal {
  id, learnerId
  weekStart      // YYYY-MM-DD (月曜)
  parentGoalId?  // 長期ゴールへの紐付け
  title, detail?
  status: "active" | "achieved" | "missed"
  createdAt
}

// ゴール振り返り（合議制）
GoalReview {
  id, goalId, learnerId
  reviewDate
  reflection            // ゆいと本人で書いた振り返り (自由テキスト)
  achievementPct?       // 0-100 自己評価 (optional、メタゴールでは未使用)
  nextActions?: string[]
  createdAt
}

// ゆい → 葵への申し送り（葵 → ゆいの Issue.summary の逆方向）
TutorHandoff {
  id
  fromTutor: true       // 固定（将来 reverse もあり）
  toSubjectId           // 葵先生 (英語)
  relatedNodeId?
  relatedIssueId?
  title                 // 「不定詞 名詞的用法 — 動名詞との使い分けで混乱中」
  body                  // ヒアリング要約 + ゆいの所感 + 指導提案
  status: "unread" | "read"
  createdAt, readAt?
}
```

---

## フェーズ別 実装ロードマップ

| フェーズ | 内容 | 状態 |
|---|---|---|
| **Phase 0**（先行） | `/learn` 4 ペイン、`/test`、`/chapter-test`、認証、Supabase 基盤 | ✓ 完了 |
| **Phase 1** | `/schedule` ダッシュボード骨格 + 4 task type の mock データ + サイドバー最上位 | ✓ 完了 |
| **Phase 2** | 担任「ゆい」chat (mock)、リッチカード（教科 / 教材 / 範囲 / 開始）、`/` → `/tutor` redirect | ✓ 完了 |
| **Phase 3 (構造)** | /tutor 2 ペイン司令室化 + 課題 chat 統合 + ゆいハブカード（下記 Phase 3 スコープ参照） | 部分実装中（hide-tutor 撤回が必要）|
| **Phase 3 拡張: コーチング設計** | ゆいを純粋コーチング エージェントに進化（下記 Phase 3 拡張スコープ 3a〜3g 参照） | 未着手 |
| **Phase 3.5** | 学習開始の儀式 + 経過時間計測 + 離席検知 + 終了儀式（下記 Phase 3.5 スコープ参照） | 未着手 |
| **Phase 4** | 宿題タスク + AI 伴走 chat（「考え方を一緒に確認しながら」）| 未着手 |
| **Phase 5** | 授業の新しい学び（本人入力 → 復習タスク自動生成）| 未着手 |
| **Phase 6** | Claude API 接続、scripted mock を本物の対話に置換、コンテキスト圧縮（rolling summary / prompt cache）、ゆいによるサマリー読み込み | 未着手 |
| **Phase 7** | Supabase スキーマ + mock → 永続化 | 未着手 |
| **Phase 8** | Web Speech API（STT）+ OpenAI TTS で音声対話 | 未着手 |

### Phase 3 スコープ

- `/tutor` を 2 ペイン構造に改修（左ゆい chat / 右動的展開エリア）
- URL 設計: `/tutor?view=issues|issue&id=...|schedule|history`
- 右ペインに展開するコンポーネント（`/issues` `/schedule` `/history` と共用）
- `Issue` 型に `chatThread?: IssueChatMessage[]` / `summary?: string` を追加
- `IssueChatMessage` 新型と `IssueChatCard`（`trigger-message-quote` / `resolve-suggestion`）
- 課題 chat scripted mock: 科目の先生 persona、初手 AI 発話、AI 発の Issue は triggerMessage 引用、クリア提案発話
- `/issues?selected=<id>` 経由のディープリンク（`/schedule` / `/learn` の NotePane からの導線）
- `TutorCard` に `IssueListCard` / `TodayScheduleCard` を追加、`rightPaneAction` で右ペインを切替
- ゆい mock に「課題見せて」「スケジュール見せて」分岐を追加
- 入力欄の動的位置切替（右ペインが chat 系の時は右、それ以外は左）
- クリア後 chat は永続保持・readonly 表示
- **教材追加のゆいハブ化**: `MaterialEditWizard` を `embedded` で右ペインに展開、ゆい mock に「教材追加」分岐、定番メニューに「教材を追加」を加える
- **科目の先生 履歴ビュー**: ノード対話 (`ChatMessage`) + 課題 chat (`IssueChatMessage`) を時系列集約、`/tutor?view=subject-history&subjectId=xxx` で展開、LearnSidebar の科目フォルダ横に履歴アイコン

### Phase 3 拡張スコープ（コーチング設計、3a〜3g）

| ステップ | 内容 | 想定規模 |
|---|---|---|
| **3a** | hide-tutor revert（subject-history で左ゆいを隠す処理を取り消し、2 ペインに戻す）+ ARCHITECTURE.md にコーチング原則を明文化済（本書）+ ゆい persona description を coaching 型に更新（`TUTOR_PERSONA.description`）| 小 |
| **3b** | `tutor-mock.ts` を coaching 型に全面書き直し: GROW 意識、質問中心、未来志向、承認、「先回り誘導」を質問に置換。朝の振り返り 5 セクション + 掘り起こしターンを追加 | 中 |
| **3c** | `ReflectionLog` 型 + 振り返りログ保存 + `/tutor?view=reflections` 一覧表示。日記的レイアウト、派生リンクの可視化 | 中 |
| **3d** | `LongTermGoal` / `WeeklyGoal` / `GoalReview` 型 + コーチング契約 mock（月初・週初の儀式 chat）+ ゴール常時表示 UI（ダッシュボードヘッダ or サイドに） | 中 |
| **3e** | 振り返りタスクをスケジュールに自動配置: 毎日（学習開始前）+ 週末（日曜）+ 月末。`ScheduleItem.type` に `"reflection"` を追加 | 小 |
| **3f** | `TutorHandoff` 型 + ゆいから葵への申し送り作成 mock（ゆい chat 内のリッチカードで draft → 送信）+ 葵 IssueChat ヘッダで「ゆいから N 件」表示 + 詳細閲覧 | 中 |
| **3g** | `IssueChat` の本実装（葵先生による課題ごとの個別 chat スレッド）。既存 Phase 3 構造のスコープの一部だが、コーチング設計と統合 | 中 |

3a → 3g の順に段階的に commit。3a-3b で「ゆいがコーチングする」体験が立ち上がり、3c-3e で振り返りリズムが回り出し、3f-3g で 2 つの AI の連携が完成する。

### Phase 3.5 スコープ

- ゆい chat 起動時の「今日始める? / お休み?」儀式
- 「始める」発話で `LearningSession.startedAt` を自動マーク
- 経過時間カウントアップ表示（ストップウォッチ）
- アイドル検知: 15 分操作なしで pause（「離席中…」インジケータ）、30 分超で `endReason: "auto-idle"` で自動セッション終了
- `visibilitychange` / `beforeunload` で `endReason: "browser-close"` 終了
- 日付跨ぎで `endReason: "auto-day-change"` 自動終了
- 復帰時のゆい発話分岐（短復帰 / 長復帰 / 翌日）
- 学習終了時のゆい「お疲れさま」儀式（ARCHITECTURE 旧「未実装」項目を Phase 3.5 で実装）

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

### 課題 chat 統合（Phase 3）

| 論点 | 確定 |
|---|---|
| chat の起動点 | `/tutor` 右ペインに展開（主動線）+ `/issues` バックアップ動線（同コンポーネント） |
| 担当 AI | 科目の先生（既存 DialogPane と同 persona）。課題ごとに独立スレッド、ノード対話とも分離 |
| AI 間連携 | 科目の先生 → ゆいは `Issue.summary` 経由（成果物）。生 chat はゆいに渡さない |
| コンテキスト対策 | Phase 3 は型のみ用意（`Issue.summary` / `Issue.chatThread`）。圧縮ロジックは Phase 6 |
| クリア導線 | ボタン + 「クリアして」発話 両方有効。AI が勝手に resolved にしない（本人意思のみ） |
| 初期メッセージ | AI が必ず先に話しかける。AI 発 Issue は `triggerMessage` を引用カードで添える |
| スケジュール連動 | `ScheduleItem (type:"issue")` クリックで `/tutor?view=issue&id=xxx` に遷移 |
| /learn 連動 | NotePane の課題リストから同タブで `/tutor?view=issue&id=xxx` |
| クリア後の chat | 永続保持・readonly 表示。再発時の参照資料 + 振り返り資料。LLM 入力からは除外 |
| Message 型 | 新型 `IssueChatMessage`（`TutorMessage` を雛形に。text + card + quickReplies） |
| セッション境界 | クリアまで 1 本の長いスレッドが日をまたいで蓄積。明示的セッション境界はクリアのみ |

### /tutor 司令室・ゆいハブ化（Phase 3）

| 論点 | 確定 |
|---|---|
| ハブ化強度 | **強化ハブ化**: 主動線はゆい経由、`/issues` `/schedule` `/history` は残してバックアップ動線 |
| 2 ペイン構造 | 左 = ゆい先生 chat（常時）、右 = ゆいとの会話で動的切替（issues / issue chat / schedule / history） |
| /learn の扱い | 4 ペインは右ペインに収まらないため別ルート遷移。学習終了後は `/tutor` に戻る |
| URL 設計 | `/tutor?view=issues\|issue&id=xxx\|schedule\|history`。リロード・戻る・ブックマーク全対応 |
| 既存ルートとの関係 | コンポーネント再利用（`IssueListView` / `ScheduleDashboard` / `HistoryView` を両方で描画） |
| 入力欄の振る舞い | 右ペインの中身次第で動的に切替。並走させない。chat 系の時のみ右、それ以外は左 |
| 右ペインに chat 中の左 | readonly（履歴は読めるが入力不可）。「もどる」ボタンで右ペインを閉じる |
| ゆいの役割 | 「橋渡し」。科目の先生にバトンタッチ後はゆいは沈黙、ゆい側に戻ると会話再開 |

### 教材追加ゆいハブ化（Phase 3）

| 論点 | 確定 |
|---|---|
| 対象ユーザー | **両方で同じフロー**（権限区別なし、学習者も教材追加できる）|
| 担当 AI | **ゆい先生が全部担当**（科目の先生にハンドオフしない、シンプル維持）|
| 既存ウィザード | `/admin/materials/new` は **残してバックアップ動線化**（URL バー直入力で到達可、サイドバーからは撤去）|
| UI 表現 | **ゆいは入口、ウィザード本体は右ペインに展開**（既存 `MaterialEditWizard` に `embedded` props を追加して再利用）|
| 完了体験 | ウィザード保存 → `onComplete` コールバック → ゆいが「『{name}』登録できたよ！」発話 + 右ペイン自動クローズ |
| メニュー追加 | 定番メニューを 4 項目 → 5 項目に拡張（学習を開始 / 課題を確認 / スケジュール確認 / **教材を追加** / 履歴を確認）|

### 科目の先生 履歴ビュー（Phase 3）

| 論点 | 確定 |
|---|---|
| スレッド設計 | **集約ビュー（読み取り中心）**。新スレッド作らず、既存対話を時系列で集約 |
| 動線・展開先 | **/tutor 右ペインに展開**（`/tutor?view=subject-history&subjectId=xxx`）|
| ビュー構造 | **時系列タイムライン + 種別/ノードフィルタチップ**。各発言に出典バッジ + 「元の対話を開く」ジャンプリンク |
| 含めるデータ | **ノード対話 (`ChatMessage`) + 課題 chat (`IssueChatMessage`) の 2 種類のみ**（サマリー類は別画面）|
| 起動点 | **LearnSidebar 上部「先生」セクション**（ゆい先生の下に並列）+ ゆい chat の keyword 分岐（「あおい先生」「英語履歴」等）|
| subjectId 逆引き | `KnowledgeNode` は `parentId` のみ持つため、root を辿って `ROOT_NODE_TO_SUBJECT` で解決。`lib/learn/subject-resolver.ts` で実装 |
| 科目の先生 persona | `Subject.teacher: SubjectTeacher` で固有名 / アバター / サブタイトルを保持。MVP は **あおい先生（英語）** のみ |

### コーチング設計（Phase 3 拡張）

| 論点 | 確定 |
|---|---|
| ゆいの存在像 | **純粋チューター（コーチング徹底、教科の中身は完全に教えない）**。ito19 さんが税理士試験のスタッフ相談で実践してるスタイルをモデル |
| 「教える」の境界 | 教科の中身は絶対 NG（葵先生に振る）/ 勉強の必要性・大きな考え方・メタ認知・学び方の促しは OK |
| ゆいのコンテキスト | **サマリーのみ参照**（生 chat は読まない）。例外: 検索ツール経由で必要時のみメタデータ + スニペット |
| 依頼カタログ | **6 種類**: 成果物作成 / 検索ナビ / 振り返り集計 / リマインダー・親報告 / **申し送り (TutorHandoff)** / **掘り起こし (Excavation)** |
| 会話フレーム | **GROW モデル**（Goal / Reality / Options / Will）を意識的に回す |
| 発話パターン 5 原則 | (1) 大半が質問 (2) 未来志向 (3) 承認は観察ベース (4) 答えは本人の中 (5) GROW を意識 |
| 「学べる」技法 | **武田塾「生徒に解き方を説明させる」+ ファインマン式**（教えるんじゃなく、引き出す） |
| 2 ペイン同時表示 | **必要**。本人が葵履歴を見ながら「これ課題に」「あの話どこ?」とゆいに依頼するため（中身解釈は NG だが、メタ操作は OK） |
| 葵履歴の hide-tutor | **撤回**。subject-history view でもゆい先生は左に常駐 |
| コーチング契約 | **長期 + 週次** の両方を儀式として組み込む |
| ゴールの種類 | **全部 OK**（学習成果 / メタ認知 / 気持ち / モチベ、本人が言ったものは何でも） |
| ゴール達成判定 | **本人 + ゆい合議**（数値化しない、メタゴールも扱うため） |
| ゴール未達成時 | コーチング王道「次どうする?」+ ito19 哲学「ミスは学びの瞬間」で「何が見えた?」の **2 段**（過去原因の追及はしない、未来志向） |
| 振り返り周期 | **毎日 + 毎週 + 毎月**（年間は不要、中2 には早い） |
| 振り返り内容 | 5 セクション: 昨日のレビュー / 学校で習ったこと / 起きたこと・気分 / 疑問・不安 / 今日の計画 |
| 振り返りの保存形 | **ReflectionLog 独立型（ハイブリッド）**: 本体は日記的に保存 + 中身から各既存型（Issue / ScheduleItem / LessonReview / TutorHandoff）に派生リンク |
| 振り返り→スケジュール | **自動配置**（毎日: 学習開始前 / 週末: 日曜 / 月末）。`ScheduleItem.type` に `"reflection"` 追加 |
| 「掘り起こし」の位置 | 振り返りの中核技法。「何が分からないか分からない」を質問で言語化させる → 課題 + 申し送りに派生 |
| ゆい → 葵への申し送り | **TutorHandoff 型** 新設（葵 → ゆいの Issue.summary の逆方向）。葵 IssueChat ヘッダに「ゆいから N 件」表示 → 葵が読んで指導戦略に反映 |
| 2 つの AI の連携 | **生 chat は共有しない**。サマリー (`Issue.summary`) + 申し送り (`TutorHandoff`) のドキュメントのみで連携（コンテキスト爆発回避） |
| 「環境 vs 中身」原則 | **環境（時間・場・儀式）は決めてあげる、対話の中身はコーチング**。ito19 さん自己認識「自分基準で設計するな（普通の人は自走できない）」より |

### 学習計測・離席検知（Phase 3.5）

| 論点 | 確定 |
|---|---|
| 開始の儀式 | `/tutor` 起動時に ゆいが「今日始める? お休み?」と問う。「始める」発話で `LearningSession.startedAt` を切る |
| 計測の正体 | 今日の学習時間カウントアップ（ストップウォッチ） |
| アイドル検知（短）| 15 分操作なしで pause + 「離席中…」インジケータ表示。セッションは終了しない |
| アイドル検知（長）| 30 分超で自動セッション終了（`endReason: "auto-idle"`）|
| ブラウザ閉じ | `visibilitychange` / `beforeunload` で `endReason: "browser-close"` 終了 |
| 日付跨ぎ | ローカル日付 23:59→00:00 で `endReason: "auto-day-change"` 自動終了 |
| 復帰挙動（短）| アイドル復帰 → そのまま継続、ゆいが「お帰り」 |
| 復帰挙動（長同日）| 30 分超終了後 → 新セッション、ゆいが「ちょっと空いたけど続ける?」 |
| 復帰挙動（翌日）| 翌日に復帰 → 「今日始める?」儀式を再表示 |
| 終了儀式 | 学習終了時に ゆい「お疲れさま」+ セッション振り返り（旧「未実装」項目を Phase 3.5 で実装）|
| しきい値の根拠 | 15 分: トイレ・食事・家族会話を許容 / 30 分: 戻ってこない可能性が高い目安 |
| 表示 | 「離席中…」は画面右上に小さく出す（モーダルで強制しない）|

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
├── tutor/                          # ★ 担任 chat（Phase 3 で 2 ペイン司令室化）
│   ├── TutorWorkspace.tsx          # ★Phase 3: 2 ペイン親 + state（view パラメータ管理）
│   ├── RightPaneRouter.tsx         # ★Phase 3: ?view= の値で右ペインを切替
│   ├── TutorChat.tsx               # 左ペイン: ゆい chat 本体、scroll、AI 応答演出
│   ├── TutorAvatar.tsx
│   ├── TutorMessageBubble.tsx
│   ├── TutorComposer.tsx           # テキスト + クイック返信 + 音声入力ボタン（右ペイン chat 中は readonly）
│   └── cards/
│       ├── SubjectPickerCard.tsx
│       ├── MaterialPickerCard.tsx
│       ├── RangePreviewCard.tsx
│       ├── StartStudyCard.tsx
│       ├── IssueListCard.tsx       # ★Phase 3: 未クリア課題サマリー、クリックで右ペインへ
│       └── TodayScheduleCard.tsx   # ★Phase 3: 今日のタスクサマリー
├── schedule/                       # ★ ダッシュボード（/tutor 右ペインと /schedule で共用）
│   ├── ScheduleDashboard.tsx       # 全体レイアウト
│   ├── ScheduleHeader.tsx          # 試験まで / 未クリア課題 / 今週の予定
│   ├── TodayTaskList.tsx           # 今日のタスク（タイプ別アイコン、AI rationale）
│   ├── ScheduleMiniCalendar.tsx    # 2 週間ミニカレンダー
│   ├── TaskSourcesPanel.tsx        # 試験対策 / 宿題 / 授業 / 課題の登録パネル
│   └── ScheduleTaskTypeIcon.tsx    # 4 task type 共通の icon / tone / label
├── issues/                         # ★ 課題（/tutor 右ペインと /issues で共用）
│   ├── IssueListView.tsx           # 課題一覧（既存）
│   ├── IssueChat.tsx               # ★Phase 3: 課題 chat 本体（科目の先生との対話）
│   ├── IssueChatBubble.tsx         # ★Phase 3: メッセージ吹き出し（IssueChatMessage 描画）
│   ├── IssueChatComposer.tsx       # ★Phase 3: 課題 chat の入力欄
│   └── cards/
│       ├── TriggerMessageQuoteCard.tsx  # ★Phase 3: AI 発 Issue の triggerMessage 引用
│       └── ResolveSuggestionCard.tsx    # ★Phase 3: 「クリアして OK そう」AI 提案
├── history/                        # ★ 履歴（/tutor 右ペインと /history で共用）
│   ├── HistoryView.tsx
│   ├── HistorySummary.tsx          # 週/月の集計 + 科目別バー
│   └── HistoryCalendarView.tsx     # 月単位カレンダー
├── subjects/                       # ★Phase 3: 科目の先生 履歴ビュー
│   └── SubjectHistoryView.tsx      # ノード対話 + 課題 chat の時系列集約タイムライン
├── learn/                          # 学習画面（別ルート、4 ペイン）
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
├── types.ts                        # KnowledgeNode / Issue / IssueChatMessage / ScheduleItem / TutorMessage / ...
├── mock-data.ts                    # 中2 英語文法 33 ノード + 全 mock データ
├── tutor-mock.ts                   # 担任の persona + 状態機械（scripted、Phase 3 で課題/スケジュール分岐追加）
├── issue-chat-mock.ts              # ★Phase 3: 科目の先生 persona + 課題 chat scripted 応答
├── subject-resolver.ts             # ★Phase 3: ノード ID から所属 subject を引く（root 階層を辿る）
├── subject-history.ts              # ★Phase 3: 科目の先生対話履歴の集約 utility
├── use-learning-session.ts         # セッション auto-tracking hook（Phase 3.5 でアイドル検知を追加）
├── use-idle-detector.ts            # ★Phase 3.5: 15 分 pause / 30 分終了の検知 hook
└── mindmap-layout.ts
```

---

## ユーザー体験フロー（Phase 3 以降の理想形）

### 朝の儀式（/tutor 2 ペイン司令室、Phase 3 拡張以降）

1. 娘さん、`/` を開く → `/tutor` に redirect → 2 ペイン司令室が起動（左: ゆい / 右: 空 or 今日のサマリー）
2. ゆい先生「**おかえり！今日の学習、始める? それともお休み?**」+ クイック返信「始める」「お休み」
3. 「始める」 → **`LearningSession.startedAt` を切る + 経過時間カウントアップ開始**（Phase 3.5）
3.5. **【Phase 3 拡張: 朝の振り返り儀式】** ゆいが GROW の R（現状）を中心に質問:
   - 「**昨日はどこまで進んだ?**」（昨日のレビュー）
   - 「**学校では今日どんなことやった?**」（学校での新規学習）
   - 「**今日どんな気分?**」（気分・出来事の受け止め）
   - 「**何かモヤモヤしてること、ある?**」 → 「分からないこと、好き勝手話してみて」（**掘り起こし**）→ 質問を 1 つずつ → 本人が言語化 → ゆいが科目・分野を特定 → **Issue 追加** + **TutorHandoff 作成**
   - **`ReflectionLog` (cadence: "daily") が保存される**
4. ゆい「**じゃあ今日は何やる? 課題消化? それとも新しい単元?**」+ クイック返信「課題見せて」「スケジュール見せて」「新しい単元」
5. 「課題見せて」 → ゆいが **IssueListCard** を発話 + **右ペインに `/tutor?view=issues` 展開**（課題一覧）
6. ゆい「**英語 3 件、数学 1 件あるね。どれからいく?**」
7. 「to のクセやる」 → ゆい「**了解、英語の先生呼んできたよ**」+ **右ペインを `/tutor?view=issue&id=xxx` に切替**（課題 chat に切替）
8. **入力欄が左ゆい → 右課題 chat に移動。左ゆいは readonly**
9. 科目の先生「**こんにちは、to の後に過去形を書くクセだったよね**」+ 引用カード（AI 発 Issue の場合 triggerMessage 引用）
10. 対話で課題を潰す → 「もう大丈夫」発話 or 「分かった！」ボタンで `resolved` に → 「お疲れさま」発話
11. **「もどる」 → 右ペイン閉じる → 入力欄が左ゆいに戻る**
12. ゆい「**次どうする?**」 → 学習開始 or 終了の流れへ
13. **学習開始** → ゆいから `/learn?node=xxx&startDay=1` に**別画面遷移** → 体系図 復元テスト → 対話学習
14. **学習終了** → `/tutor` に戻る → ゆい「**お疲れさま、どうだった?**」+ SessionEndDialog（AI 課題候補チェック、Phase 3.5）
15. **離席 15 分** → カウント pause + 「離席中…」インジケータ（右上小さく）。復帰でゆい「お帰り」
16. **離席 30 分超 / 日付跨ぎ / ブラウザ閉じ** → セッション自動終了（Phase 3.5）
17. 翌朝 1. に戻る

### 2 つの AI のハンドオフ

ゆいは **司令室の常駐者**。常に左ペインにいる。教えない、ルーティングと感情の受け止めとサマリー俯瞰だけ担当する。**橋渡し**: 「英語の先生呼んできたよ」と発話し、右ペインに科目の先生を展開してフォーカスを渡す。

科目の先生は **教科 / 課題のスペシャリスト**。右ペインで対話、節目で `Issue.summary` / `LearningSession.summary` を書き残す。ゆいはこのサマリーだけを読む（生 chat は読まない）。

学習画面（`/learn`）は司令室の外。/learn 内でも DialogPane で科目の先生と対話するが、これも独立スレッド。/learn から `/tutor` に戻ると、ゆいが「お疲れさま」で出迎える。

---

## 意図的に未実装（次の指示待ち）

| 項目 | フェーズ |
|---|---|
| Claude API 接続（mock スクリプトを本物の対話に置換、コンテキスト圧縮、prompt cache）| Phase 6 |
| ゆい先生によるサマリー読み込み（`Issue.summary` / `LearningSession.summary` を踏まえた発話）| Phase 6 |
| `Issue.summary` の自動生成（科目の先生が会話の節目に書き出す）| Phase 6 |
| Web Speech API (STT) + OpenAI TTS（音声対話）| Phase 8 |
| Supabase スキーマと mock → 永続化（`Issue.chatThread` / `LearningSession` の永続化含む）| Phase 7 |
| 試験対策の AI 壁打ち作成画面 | Phase 2+ |
| 宿題の伴走 chat（考え方を一緒に確認）| Phase 4 |
| 授業の新しい学びの登録 → 復習タスク自動生成 | Phase 5 |
| 複数日の担任 chat の永続化と継続性 | Phase 7 |
| Vercel 本番デプロイ + ドメイン設定 | MVP 完成後 |

**Phase 3 で実装される（旧「未実装」項目）**:

- ✅ 課題（Issue）への専用 chat スレッド
- ✅ /tutor 2 ペイン司令室化、ゆいハブ化

**Phase 3.5 で実装される**:

- ✅ セッション終わりに担任が「お疲れさま」儀式（旧 Phase 2+）
- ✅ 学習開始の儀式 + 経過時間計測 + 離席検知 + 日付跨ぎ自動終了

---

## 設計の核（一行で）

> ログインしたら **ゆい先生（純粋コーチ）** の **司令室（左ペイン chat + 右ペイン動的展開）** に着く。**朝の振り返り** で昨日 / 学校 / 気分 / 疑問 / 今日の計画を語り、**「何が分からないか分からない」を言語化する「掘り起こし」** で課題を発見、**葵先生（科目）への申し送りドキュメント (TutorHandoff)** を介して **IssueChat（課題ごとの個別 chat）** に展開、対話で潰す。**長期 + 週次ゴールのコーチング契約** が学習リズムを支え、**日次 / 週次 / 月次の振り返り** が自走に近づける。**「教えない、引き出す。環境（時間・場・儀式）は決めてあげる、対話の中身はコーチング」**。
