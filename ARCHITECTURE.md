# ARCHITECTURE — AI-Education

実装の設計判断と全体像をまとめたドキュメント。哲学（[PHILOSOPHY.md](./PHILOSOPHY.md)）が「何のために作るか」、本書は「どう作るか」。

最終更新: 2026-05-24（Phase 3 中盤の実装スナップショット追加）

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

> **ゆい先生像の詳細・実体験ベースの記述は [TUTOR-ROLE.md](./TUTOR-ROLE.md) を参照**。ito19 さんの会計事務所での実体験（スタッフの「ふわっと」を「これをやろう」に変換するコンダクター業務）と、それを娘さん向けにどう適用するかを記録している。Phase 6 で Claude API に接続する時の system prompt の補助コンテキストにもなる。

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
- **C6 ハードガードで scripted に強制**: `detectTeachingRequest()` (`lib/learn/tutor-teaching-guard.ts`) が「教えて」「答えは」「訳して」等を検知 → ゆいは答えず TutorHandoff draft を作成して葵に振る。META_KEYWORDS (勉強 / 努力 / 集中 / なぜ 等) は救済（メタ質問はゆい OK）

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

## Phase 3 中盤の実装スナップショット（2026-05-24）

3a〜3b を経て、ito19 さんの追加要望（学習終了の儀式化 / セッション永続化 / ゆい対話アーカイブ等）を反映した結果、以下のサブシステムが揃った状態。各機能の根拠は当該日の grill-me / commit メッセージに残る。

### セッションライフサイクル（pause/resume + 永続化）

> 実装: `web/lib/learn/use-learning-session.ts` / `web/lib/learn/session-storage.ts`
> ヘッダ表示: `web/components/learn/LearnHeader.tsx`

**3 状態モデル**: `active` / `paused` / `ended`

| イベント | 旧設計 (撤回済) | **新設計** |
|---|---|---|
| アイドル 15 分 | auto-end | **auto-pause** （セッション継続）|
| 任意操作 (mouse/key/click/scroll/touch) | markActivity 明示 | **global listener で auto-resume** (throttle 1 秒) |
| ブラウザ閉じ | `browser-close` で終了 + 警告ダイアログ | **終了しない、localStorage に snapshot** + 警告ダイアログ撤去 |
| 翌日に来る | 「今日始める?」儀式 | **完全サイレント**、別日のセッションを静かに破棄 |
| 同日内に戻る | - | **localStorage から復元、paused 起動、操作で resume** |
| 明示終了 | "manual" / "browser-close" 等 | **"manual" のみ**（`/tutor?ending=1` 経由）|

**3 状態カラー (LearnHeader)**:
- 🟢 緑 + ping アニメドット → 学習中（active）
- 🟡 黄ドット + 「離席中…」 → 一時停止（paused）
- 🔴 赤ドット + 「停止中」 → 終了（ended）

**「学習を終了」ボタン**: 即終了ではなく `/tutor?ending=1` に遷移 → ゆいの ending 振り返り対話を経て終了。

### ゆい chat の永続化（1 日 1 chat）

> 実装: `web/lib/learn/tutor-thread-storage.ts`
> UI: `web/components/tutor/TutorWorkspace.tsx` mount 時に load/save

**設計原則** (ito19 さん指示 2026-05-24):
- 1 日 1 thread。同日内は load して継続（朝の振り返り → 課題確認 → ... → 学習終了 を 1 本に蓄積）
- 別日: 過去 thread はそのまま archive 残し、今日は新規 thread
- Claude API (Phase 6) コンテキストは 1 日分で bounded

**localStorage key**:
- `ai-education:tutor-thread:YYYY-MM-DD` — 各日の thread
- `ai-education:tutor-thread-index` — 全 thread 日付の index

**ending モードの挙動**: `/tutor?ending=1` で来た場合、既存 thread に ending 挨拶を append（同日内の朝の振り返りからの続きとして自然に流れる）。

### 話題タグ + セクションヘッダー

> 型: `TutorTopic` / `TutorRole = "tutor" | "learner" | "section"`（`web/lib/learn/types.ts`）
> 表示: `web/components/tutor/topic-display.tsx` (`TopicChip` コンポーネント、絵文字 + パステル色)

**10 種類の Topic**:

| Topic | 絵文字 | 色 | 場面 |
|---|---|---|---|
| morning-reflection | 🌅 | amber | 朝の振り返り 5 セクション |
| excavation | 💭 | sky | 掘り起こし |
| issue-check | 🎯 | orange | 課題を確認 |
| schedule-check | 📅 | violet | スケジュール確認 |
| history-check | 📖 | slate | 学習履歴を確認 |
| material-add | 📚 | emerald | 教材を追加 |
| subject-history | ✏️ | indigo | 科目の先生 対話履歴 |
| start-study | ✨ | fuchsia | 学習を開始 |
| ending | 🌙 | rose | 学習を終了 |
| free-chat | 💬 | neutral | おしゃべり |

**自動セクションヘッダー挿入**: `TutorChat.appendReplyWithSection()` が直前の tutor message と topic を比較、変わってたら自動で `role: "section"` メッセージを挿入。

**Topic 派生**: `tutor-mock.ts::deriveTutorTopic(state, rightPaneAction)` が各 reply に topic を付与（明示設定があれば尊重）。

### 学習終了の振り返り（ending dialogue）

> 実装: `tutor-mock.ts::buildInitialTutorThread(now, "ending")` + state `ending-vent` / `ending-confirm` / `ending-done`

**ループ型サマリー設計** (ito19 さん指示):
1. 開始: 「お疲れさま！今から、頭の中のふわっとしたものを、私がまとめて具体化していくね...」（canonical script、TUTOR-ROLE.md 参照）
2. 本人発話 → ゆいが現状サマリーを返却（番号付き箇条書き）+「他にある?」
3. 本人が思い出した事を追加 → サマリー更新 → 「他にある?」
4. 「もうない / 終わり / 以上」発話 → 最終サマリー + 繰り越し課題候補 + 「これで終わりますか?」
5. 「はい」 → `ending-done` 確定 + localStorage clear
6. 「あ、まだあった」 → vent に戻る

**メタ認知の自動化**: 並べたまとめを本人が見ると「あ、まだあった」と気づきが生まれる → AI の要約・抽出能力を本人の気づき促進に転用。

### ゆい先生対話アーカイブ

> 実装: `web/components/tutor/TutorArchiveView.tsx`
> 起動: HubMenu「先生との対話」プルダウン → 「ゆい先生」、または chat に「ゆい対話履歴」と書く

- 日付セレクター（保存済み thread の降順、`[今日]` バッジ付き）
- 話題フィルター（10 種、各件数バッジ、複数選択可）
- 選択日の thread を `TutorMessageBubble` で readonly 表示（セクションヘッダー込み）
- URL `?date=YYYY-MM-DD` で外部から特定日にジャンプ可能

### 過去 chat 検索（「あの話したよね?」）

> 実装: `tutor-thread-storage.ts::searchTutorThreads(query, maxResults)` + `tutor-mock.ts::detectSearchIntent()`
> カード: `web/components/tutor/cards/ChatSearchResultCard.tsx`

**検出パターン**: トリガーフレーズ 18 種 (「話したよね」「言ったよね」「覚えてる」「前に話した」「ゆい先生に話した」「あの話」等) + 明示プレフィックス (「探して:」「検索:」)。

**動作**: トリガー検出 → トリガー語と助詞を除去してクエリ抽出 → 全 thread grep → 最大 5 件返却 → `ChatSearchResultCard` で日付 + 発話者 + Topic + snippet を表示 → クリックで `/tutor?view=tutor-archive&date=xxx` にジャンプ。

**ヒットなし**: 「見当たらないなあ」+ `open-tutor-archive` をフォールバック発火（全件閲覧へ）。

### HubMenu「先生との対話」プルダウン

> 実装: `web/components/tutor/TutorChat.tsx::TutorHubMenu`

担任「ゆい先生」+ 科目の先生（あおい先生 等、`Subject.teacher` 設定済みのみ）を列挙。担任セクションと科目セクションを区切り見出し付きで分離。

- 「ゆい先生」クリック → `onSend("ゆい対話履歴")` → tutor-mock の検索意図検出にヒット → `tutor-archive` view
- 科目の先生クリック → `onSend(teacher.displayName)` → tutor-mock の hub action → `subject-history` view

### Phase 3 レビュー追従 (2026-05-24 着手)

[REVIEW-2026-05-24.md](./REVIEW-2026-05-24.md) で最重要 3 つとされた項目への対応。独立コミット C1-C6 で順次実装。grill-me で着手順序を `1 markdown → 3 型追加 (γ UI 表示まで) → 2 ハードガード` と確定。

#### C1: chat バブルの markdown レンダリング

> 実装: `web/components/chat/MarkdownText.tsx`

scripted mock の発話 (`**強調**` / 箇条書き / 引用 / 表) が生 `**...**` のまま表示されていた問題を解消。react-markdown + remark-gfm でラップした共通コンポーネントを chat 系で使用:

| 箇所 | variant | 役割 |
|---|---|---|
| `TutorMessageBubble` (tutor) | card | ゆい先生発話 |
| `TutorMessageBubble` (learner) | bubble-primary | 本人発話 |
| `DialogPane` MessageBubble | card / bubble-primary | 葵先生 / 本人 ノード対話 |
| `IssueChatBubble` (teacher) | card | 葵先生 課題 chat |
| `IssueChatBubble` (learner) | bubble-primary | 本人 課題 chat |

`SubjectHistoryView` の preview は `line-clamp: 4` 制約があり markdown レンダリングと相性が悪いため、`stripMarkdown()` ヘルパーで平文化のみ行う。

`bubble-primary` variant は learner 発話用 (背景 = primary 色) で、`<strong>` / `<code>` / `<blockquote>` / リスト marker の色を反転して可読性を維持。HTML タグは react-markdown のデフォルトで通さない (XSS 防止)。

Phase 6 (Claude API 化) で AI 発話が markdown 構造を返してきても、この 1 コンポーネントで全 chat の表示が揃う。

#### C2: Phase 3 拡張型 6 個 + 静的 mock データ

> 実装: `web/lib/learn/types.ts` (5 型追加) / `web/lib/learn/mock-data.ts` (6 種類の mock)

ARCHITECTURE.md で定義済みだが types.ts に存在しなかった 5 型を追加 + 既存 `NodeComprehension` (型は既存) の mock データを復活。REVIEW-2026-05-24.md 共通指摘の「ARCHITECTURE と実装の乖離」を解消する基盤工事。

**追加した型** (`types.ts`):

| 型 | 役割 | grill γ で選んだ mock 量 |
|---|---|---|
| `ReflectionLog` | 振り返りログ (daily/weekly/monthly)、5 セクション + 派生リンク | **7 日分** (daily 5 + weekly 1 + monthly 1) |
| `LongTermGoal` | 月/学期/試験/フリーの長期コーチング契約 | 1 件 (2026 年 5 月) |
| `WeeklyGoal` | 週次ゴール、parentGoalId で長期に紐付け | 1 件 (5/18 週) |
| `GoalReview` | ゴール振り返り（合議制、achievementPct optional）| 1 件 (WeeklyGoal 振り返り) |
| `TutorHandoff` | ゆい → 葵への申し送り (status: unread/read) | 2 件 (excavation 由来 / 過去分詞由来) |
| `NodeComprehension` (既存) | ノード単位の AI 理解度判定 + 戻り先提案 | 2 件 (副詞的用法 0.45 / 過去分詞 0.62) |

**NodeComprehension の経緯**: 型は既存だったが mock データは「Issue に統合で撤去」コメントで消されていた (mock-data.ts line 765-767)。ARCHITECTURE.md が「ゆいが読む重要型」と位置付けている以上は乖離なので、Phase 6 (Claude API) で「ゆいへの入力アダプタ」の土台として復活させた。

**mock データの整合**:
- ReflectionLog 7 日分は既存 `MOCK_SESSIONS` (5/20, 5/21, 5/22 にセッションあり) と連動。サボった日 (5/18, 5/19, 5/23) も意図的に含めて「サボった日も罪悪感少ない」哲学を表現。
- `derivedIssueIds` / `derivedHandoffIds` で既存 `MOCK_ISSUES` / 新規 `MOCK_HANDOFFS` への参照を持つ。
- `MOCK_LONG_TERM_GOALS` (1 件、5 月) ← `MOCK_WEEKLY_GOALS` (1 件、5/18 週、`parentGoalId` で紐付け) ← `MOCK_GOAL_REVIEWS` (1 件、achievementPct: 65)。
- `MOCK_HANDOFFS` の 1 件は `handoff-2026-05-22-1` (副詞的用法、unread、excavation 由来) を ReflectionLog から参照、もう 1 件は `issue-ai-3` (過去分詞) に紐づく既読済み。

派生実装 (excavation 終了で `MOCK_HANDOFFS.push(...)`、朝の振り返り完了で `MOCK_REFLECTIONS.push(...)`) は C3 で実装する。本 commit は型と静的データの土台までで止める。

#### C3: tutor-mock 派生実装 (excavation / 振り返り完了)

> 実装: `web/lib/learn/tutor-mock.ts` の `deriveFromExcavation` / `deriveMorningReflectionLog` / `inferNodeIdFromText` / `TutorStep.reflectionDraft` 追加

「申し送りしておくよ」と発話するだけで実際には何も派生しなかった excavation を、本当に Issue + TutorHandoff を生成するように改修。同時に朝の振り返り 5 セクションを `ReflectionLog` として永続化。REVIEW-2026-05-24.md コーチング #2「仕様詐欺」の解消。

**TutorStep に `reflectionDraft` 追加**:

```ts
type ReflectionDraft = {
  yesterdayReview?: string;
  schoolToday?: string;
  emotionsAndEvents?: string;
  questionsAndDoubts?: string;
  derivedIssueIds: string[];
  derivedHandoffIds: string[];
};
```

各 `reflection-*` 遷移時に該当フィールドを `userInput` で更新。`reflection-plan` 到達時に `deriveMorningReflectionLog(draft)` が呼ばれ、`MOCK_REFLECTION_LOGS` に push される。

**派生フロー**:

| 遷移 | 派生 |
|---|---|
| `reflection-yesterday → reflection-school` | `draft.yesterdayReview = userInput` |
| `reflection-school → reflection-mood` | `draft.schoolToday = userInput` |
| `reflection-mood → reflection-questions` | `draft.emotionsAndEvents = userInput` |
| `reflection-questions → reflection-plan` (疑問なし) | `draft.questionsAndDoubts = userInput` + **ReflectionLog push** |
| `reflection-questions → excavation` (疑問あり) | `draft.questionsAndDoubts = userInput` |
| `excavation → reflection-plan` | **Issue + TutorHandoff 派生 push**、`draft.derived{Issue,Handoff}Ids` 蓄積、**ReflectionLog push** |

**`inferNodeIdFromText(text)`**: 掘り起こしテキストから推定ノード ID をキーワードマッチで返す。「不定詞」「動名詞」「受動態」「比較」「助動詞」「過去」「未来」を分類、推定失敗時は root の "grammar" にフォールバック。Phase 6 で LLM ベースの分類に置換する想定。

**派生 ID の規約**: `issue-runtime-<base36 timestamp>-<counter>` / `handoff-runtime-...` / `ref-runtime-...`。runtime セッション内の重複は counter で防ぐ。静的 mock データ (C2 で投入したもの) と衝突しないよう接頭辞を分けている。

**これで実現する事**:

- 「申し送りしておくよ」発話が **MOCK_HANDOFFS に実データが追加される** ことで裏付けられる
- ReflectionLog 一覧 (C4) を開けば、今日朝に振り返った内容が実際に表示される
- IssueChat ヘッダの「ゆいから N 件」(C5) も、excavation 経由で動的に増える handoff が反映される

ライフサイクル: `MOCK_*` 配列への push は **メモリ上の mutation**。ページリロードで消える (Phase 7 で Supabase 永続化)。デモ・開発時の挙動確認には十分。

#### C4: `/tutor?view=reflections` 一覧画面

> 実装: `web/components/reflections/ReflectionListView.tsx` 新設、`RightPaneRouter` に分岐追加、`tutor-mock.ts` に keyword 分岐追加

C2 + C3 で永続化された `ReflectionLog` を実際に画面で見られるようにする。これで「ReflectionLog 一覧」(REVIEW コーチング #2 の「コーチング契約の永続化」) の最低 UI が成立。

**配管**:

| レイヤ | 変更 |
|---|---|
| `types.ts` | `RightPaneView` に `"reflections"` 追加、`TutorRightPaneAction` に `{ kind: "open-reflections" }` 追加、`TutorTopic` に `"reflection-check"` 追加 |
| `topic-display.tsx` | `reflection-check` の emoji (📔) / label (振り返りログ) / tone (teal) を追加 |
| `tutor-mock.ts` | `deriveTutorTopic` に `open-reflections → reflection-check` 追加。keyword 分岐に「振り返りログ」「ふりかえり一覧」「日記」「reflection」を追加（朝の儀式と混同しないよう「振り返り」単独では反応しない）|
| `TutorWorkspace.tsx` | `viewFromParam` で `reflections` 通す、`applyRightPaneAction` で `open-reflections → navigate("reflections")` |
| `RightPaneRouter.tsx` | `view === "reflections"` で `ReflectionListView` を render |
| **`ReflectionListView.tsx`** | **新規。日付降順のカード一覧 + cadence フィルタ + 派生リンク表示** |

**ReflectionListView の構成**:

- ヘッダ: 件数表示
- フィルタ: cadence 4 種類 (all/daily/weekly/monthly) + 各件数バッジ
- 一覧: 日付降順、`ReflectionCard` ごとに:
  - cadence バッジ (amber/sky/violet) + 日付 (M/D (曜))
  - 5 セクションをアイコン付きで表示 (Clock / BookOpen / HeartHandshake / HelpCircle / Calendar)
  - 本文は `MarkdownText` で renderer (C1 の共通化を再利用)
  - 派生リンク (`derivedIssueIds` / `derivedHandoffIds`) を下部にチップで表示
    - Issue チップ → `/tutor?view=issue&id=...` にリンク
    - TutorHandoff チップ → status (unread/read) で見た目分岐、未読は緑バッジ

**mock データソース**: `MOCK_REFLECTION_LOGS` / `MOCK_ISSUES` / `MOCK_HANDOFFS` を直接 import。C3 の派生実装で実行時に追加される log もそのまま表示される。Phase 7 で Supabase 化する時に props で受け取る形にリファクタ予定。

#### C5: IssueChat ヘッダ「ゆいから N 件」バッジ

> 実装: `web/components/issues/HandoffBanner.tsx` 新設、`IssueChat.tsx` ヘッダ下に挿入

`IssueChat` (課題 chat) のヘッダ直下に「ゆいから N 件」バッジを表示。クリックで展開して各 `TutorHandoff` の詳細を読める。

**抽出ロジック**: `MOCK_HANDOFFS.filter(h => h.relatedIssueId === issue.id)` (日時昇順)。C3 のランタイム派生も即反映される。

**HandoffBanner の表示**:

| 状態 | 見た目 |
|---|---|
| 折り畳み (default) | `📨 ゆい先生から N 件` + 未読バッジ (緑) + 「申し送りを読む」 chevron |
| 展開 | 各 handoff をカード表示。Mail/MailOpen アイコン、タイトル、未読/既読バッジ、本文 (markdown)、作成日時、既読日時 |

**未読の強調**: status === "unread" の handoff は emerald カラーで強調、Mail アイコン (closed envelope)。read は MailOpen + muted カラー。これで「葵が読むモチベ」を視覚的に作る。

**既読化のアクション**: 現状は読み取り専用 (mutation なし)。Phase 7 (Supabase 永続化) と合わせて「読んだら自動的に read に更新」を実装する。Phase 3 段階では `MOCK_HANDOFFS` が const array で immutable に近いため、ステート管理は複雑化を避けて見送り。

**動作確認**: 既存 mock の `handoff-2026-05-13-1` (read) が `issue-ai-3` (過去分詞) のヘッダに表示される。`handoff-2026-05-22-1` は `relatedIssueId: undefined` (nodeId に紐付く一般 handoff) なので IssueChat ヘッダには出ない。C3 の excavation 経由で派生する handoff は `relatedIssueId` を持つので動的に出る。

#### C6: 「教えない」ハードガード + draft 自動生成

> 実装: `web/lib/learn/tutor-teaching-guard.ts` 新設、`tutor-mock.ts` の冒頭で hit 判定

REVIEW-2026-05-24.md コーチング #1「最高」優先項目への対応。ゆいが scripted mock の段階から **教科の中身に踏み込まない構造** を作る。Phase 6 (Claude API) で system prompt + LLM classifier の二重ガードに統合する前段。

**判定関数** (`detectTeachingRequest(text)`):

```
1. META_KEYWORDS 含む → null (メタ質問救済)
2. 否定形 (「教えないで」等) → null
3. CATEGORY_PATTERNS マッチ → { hit, category, matched }
4. それ以外 → null
```

| カテゴリ | キーワード例 |
|---|---|
| `teach` | 教えて / おしえて / 知りたい |
| `answer` | 答えは / 正解は / 答え何 |
| `translate` | 訳して / 英訳 / 和訳 |
| `solve` | 解いて / どうやって解く / 式は |
| `explain` | 説明して / って何 / とは |

**META_KEYWORDS** (hit 抑制): `["勉強", "努力", "集中", "やる気", "意味", "意義", "なんで", "なぜ", "目的", "habit", "習慣", "モチベ", "受験", "将来"]`。「数学って何のためにやるの?」のような哲学質問は **メタ認知 / 学び方の促し** に該当するため、ゆいが受ける。

**hit 時挙動** (3 肢選択):

1. `deriveFromHardGuard(text, detection)` で `TutorHandoff` draft を `MOCK_HANDOFFS` に push (status: "unread")。Issue は作らない（本人が「葵先生に聞く」を選んだ後の IssueChat で立ち上げる想定）
2. ゆい発話: 「ごめん、それは {category 日本語} の話だから、私じゃなくて葵先生の領域だね。**「{userInput preview}」を葵先生に申し送りしておいたよ。** どうする?」
3. quickReplies: `["今すぐ葵先生に聞く", "メモしてあとで", "もう少し自分で考える"]`

**3 肢クリック後の処理**:

| 選択 | 処理 |
|---|---|
| 「今すぐ葵先生に聞く」 | 既存「課題見せて」分岐 (lower.includes("葵先生に聞") を追加) に流す → 課題一覧の右ペインで本人が選ぶ |
| 「メモしてあとで」 | ack「OK、メモしておいたよ」。draft はそのまま MOCK_HANDOFFS に残る |
| 「もう少し自分で考える」 | ack「いいね、考えたものを言葉にして、また話そう」。draft はそのまま残る |

放置追跡 (次セッションで「あれどうなった?」) は Phase 3d 以降に持ち越し。

**ending 系 state でのスキップ**: `ending-vent` / `ending-confirm` / `ending-done` では検知しない。ループ中の本人発話 (「to の使い方が分からない」等) を誤検知しないため。

**Phase 6 への布石**:
- `CATEGORY_PATTERNS` と `META_KEYWORDS` は **few-shot 評価セット** として system prompt に投入できる
- `detectTeachingRequest` 自体は LLM classifier の **fallback / sanity check** として並走させる二重ガード設計が可能
- `TUTOR_PERSONA.description` 1 段落では Opus に「教えない」を保証させきれない、というレビュー指摘への構造的解答

---

## Phase 4: 中学生向け設計軌道修正 (2026-05-25 grill)

ito19 さんの観察「**現状の仕組みは大人の学習方法に寄っている**」を受けて、grill-me で 17 問詰めた軌道修正パッケージ。中学生のリアル (タスクは外から降ってくる主体、自分で計画立てる能力がまだ無い) に合わせて、計画立案 / 帰宅儀式 / 週次月次レポート / 戻る仕組みを再設計。

**実装状況**:
- **C7 (2026-05-25)**: 型 + 静的 mock 実装済 (`types.ts` / `mock-data.ts`)。`LearningPlan` / `SchoolDailyReport` / `WeeklyMonthlyReport` 等の新型 + `ScheduleItem.tags/source` / `ReflectionLog.weeklyMonthlyReport` 拡張 + mock データ (1 LearningPlan / 5 SchoolDailyReport / 1 AchievementBadge / 既存 weekly+monthly ReflectionLog に WeeklyMonthlyReport 追加)
- **C8 (2026-05-25)**: 計画立案 chat + カードハイブリッド実装済。tutor-mock に `plan-await-*` state + keyword 分岐 (「計画立て」「学習計画」)、`DurationPickerCard` / `RoadmapPreviewCard` 新規カード、`derivePlanFromInputs` / `expandPlanMonth` ヘルパーで動的 LearningPlan 生成 + 当月分 ScheduleItem 展開
- **C9 (2026-05-25)**: 帰宅儀式 第 1 部 (学校レポート) 実装済。tutor-mock に `evening-await-*` state + keyword 分岐 (「帰ってきた」「ただいま」「学校の話」)、時限数 (1-6) ピッカー → 時限別 (科目 + 内容) シーケンシャルヒアリング → extraEvents → `SchoolDailyReport` 動的 push。`deriveSchoolDailyReport` / `extractPeriodCount` ヘルパー。当面 topic は morning-reflection を流用。
- **C10 (2026-05-25)**: 帰宅儀式 第 2 部 + 自動起動 実装済。第 2 部は `evening-show-schedule` → `evening-await-task-text` → `evening-await-more-tasks` → `evening-finalize` の state machine。AI がタグ推定 (`inferTaskTagFromHint`: 宿題/提出物/テスト範囲/親・他/課題) で `addAdHocScheduleItem` を呼び ad-hoc ScheduleItem を MOCK_SCHEDULE_TODAY に push。`shouldStartEveningRitual` (平日 16:00 以降 + 今日未実施判定) で TutorWorkspace の lazy init から evening モード自動起動、`buildInitialTutorThread(now, "evening")` で初期挨拶。`evening-finalize` 到達時に `localStorage["ai-education:evening-ritual-last-date"]` に今日の日付を保存し二重発火を防ぐ。
- **C11 (2026-05-25)**: 週次/月次レポート UI 実装済。`WeeklyMonthlyReportView` を `web/components/reports/` に新設、4 セクション (達成度 → 学校 → 弱いところ → 来週計画+Action) + 月末週は + nextMonthPlan セクション。`RightPaneView` に `weekly-report` / `monthly-report` 追加、`TutorRightPaneAction` に `open-weekly-report` / `open-monthly-report` 追加。tutor-mock の keyword 分岐に「週次レポート / 今週のレポート / weekly」「月次レポート / 今月のレポート / monthly」を追加。最新の cadence="weekly"/"monthly" な ReflectionLog の `weeklyMonthlyReport` を表示。AchievementBadge / SchoolDailyReport / Issue / NodeComprehension を ID 経由で MOCK から取得・展開。
- **C12 (2026-05-25)**: 達成バッジ UI + 親共有 UI 実装済。達成バッジは AchievementSection 内の Badge 表示で完成 (C11 で実装、`AchievementBadge.description` を絵文字込みで表示)。親共有は `ShareToParentButton` を WeeklyMonthlyReportView のヘッダに追加: デフォルト未共有で「親と共有」ボタン表示、クリックで `SharedToParent` を `MOCK_SHARED_TO_PARENT` に push (scope: "full") → 「✓ 共有済 (date)」表示に切替。Q15 確定の「本人同意制」を体現 (デフォルト OFF、本人が能動的に「見せる」を選ぶ達成感のもう 1 層)。
- **C13 (2026-05-25)**: メニュー整理 (ito19 さん指示 + 別 AI 意見統合)。`TutorHubMenu` を **[今日のタスク (強調)] [課題] [先生 ▼] [もっと ▼] [スペーサー] [プラン (強調 右端)]** に再構成。「学習を開始」「スケジュール確認」「教材を追加」「振り返り」「履歴」を撤去 (今日のタスク / プラン / もっと ▼ に統合)。「もっと ▼」は **アーカイブ** (振り返りログ / 今週レポート / 今月レポート / 学習履歴) + **緊急動線** (帰ってきた) を格納。「今日のタスク」「プラン」は primary emphasis スタイル (border-primary + bg-primary/10) で視覚的に主動線として強調。PDCA の P (プラン右端) と D (今日のタスク左端) を空間的に対比表示。

---

## Phase 5: 学習戦略エンジン (2026-05-25 grill 確定)

Phase 4 (中学生向け軌道修正) の上に乗る「学習戦略エンジン」レベルの設計。
ito19 さん + 別 AI 議論で浮上した「学習 OS」概念を、grill-me で P5-Q1〜P5-Q7
の 7 論点 (+ サブ問い計 11 問) として詰めた結果。

**実装状況**: ✓ 完了 (C14 試作 + C15-C24 本実装、2026-05-25)。
詳細な実装結果は本セクション末尾「### Phase 5 本実装結果 (C15-C24)」参照。

### 設計の核 (Phase 4 の上に乗る)

| 哲学 | 内容 |
|---|---|
| **4 軸分離** | Plan Type (目的) / Learning Mode (Input/Output/Review/Drill/Test) / Resource (教材) / Node (知識単位) を明確に分離 |
| **死なないシステム** | 遅延を許す Replan Engine、上ノード復習提案、Interrupt の正式型化で「計画破綻」を防ぐ |
| **タスクは結果** | `GeneratedTask` (計画の実行単位) が中心、`ScheduleItem` は今日のカレンダー view |
| **本人主体性貫徹** | Replan accept / Suggestion accept / 親共有 すべて本人 OK で発火 (Q15 一貫) |
| **PHILOSOPHY 整合** | AI 自動判定よりも本人確認、ゲーミフィケーション過剰回避、達成感を構造で支える |

### P5-Q1 確定: GeneratedTask × ScheduleItem の関係

**並走 + 紐付け**:
- `GeneratedTask` (GT) は「計画の実行単位」、`ScheduleItem` (SI) は「今日のカレンダー view」
- **1 GT : 1 SI** (cardinality 固定)。GT はもう「1 日分のタスク」粒度。ページ範囲も GT に含む
- **計画立案時に全期間 GT 化** (例: 9 ヶ月計画なら立案時に ~180 GT 生成)
- **月初 expansion** = 該当月の GT[] から SI[] を生成 (日付 + status: "todo" 付与)
- `ScheduleItem.generatedTaskId?: string` で逆参照 (ad-hoc / carry-over は null)
- Replan は GT[] 書き換え、未来 SI 再生成。履歴は `PlanRevision[]` に蓄積

**理由**: 「立案時に全体カレンダー化」を選んだことで、ito19 さんの会計士試験的な
「全体俯瞰大事」志向と「ページ単位配分」(Q4) が両立する。Plan Engine の「計画の設計」と
ScheduleItem の「実行カレンダー」のレイヤー分離を保つ。

### P5-Q2 確定: WeakNodes[] の自動抽出

**半自動候補 + 本人チェック**:
- 候補抽出: `Issue (status: "open" + 最近 7 日言及)` + `NodeComprehension.score < 0.55` をマージ
- 確定方式: 候補から本人がチェックボックスで選ぶ (完全自動は PHILOSOPHY「知らない間に弱点ラベル貼られる」と不整合)
- 確定 UI (3 経路):
  - **立案時**: `weak-node-picker-card` (roadmap-preview の前に挟む) で初期セット
  - **週次レポート**: 「弱いところ」セクションに [weakNodes に追加] ボタン
  - **ゆい chat**: 「ここ弱い」発話で随時追加可
- Phase 6 で AI 化、現状は閾値固定 mock

**理由**: PDCA フラクタル (Phase 4 確定の週次 Check + 月次 Check) と整合。
立案時に意識化 → 週次でメンテで、新規データを取り込みつつ過剰露出を回避。

### P5-Q3 確定: Replan Engine の発火タイミング

**3 トリガー (毎日判定は不採用)**:
- **週次レポート時**: `delayThresholdDays` 超え判定 → `ActionProposal` に Replan draft を含める
- **InterruptEvent 即時**: `replanTriggered: true` 発火、ゆいから「明日からの予定、組み直そうか?」提案
- **明示発話**: 「再計画して」「ペース変えて」「教材変える」発話で本人主導
- 月次 Replan は「月末週の週次レポートに月次を統合」(Phase 4 Q12 一貫) で別儀式新設なし

**影響範囲は種類別**:
| 種類 | 影響範囲 | トリガー例 |
|---|---|---|
| `carry-over` | 当月 GT[] 内で再配置 (来月以降に滲ませる) | 風邪で 3 日遅れ |
| `pace-change` | `monthlyRoadmap` 再計算 → 未来 GT[] 全再生成 | 「もっとゆっくり」発話 |
| `material-change` | 新 LearningPlan 作成 + 旧 paused | 「教材変える」発話 |

**履歴**: すべての Replan は `PlanRevision` (Phase 4 既存型) に記録。本人 OK でコミット (Q15 同精神)。

### P5-Q4 確定: NodeReviewSuggestion accept フロー

**2 層提示 (主 = ゆい chat、副 = レポート)**:
- **生成**: `NodeComprehension.score` 低下検出 or `TestRules.failureAction: "review-parent"` 時に `status: "pending"` で生成
- **主提示**: 次にゆい chat 開いた時、冒頭で `NodeReviewSuggestionCard` (新規 TutorCard)
  - 3 択: `[復習する]` `[あとで考える]` `[いらない]`
- **副提示**: 週次レポート「弱いところ」セクションに `pending` な Suggestion[] 一覧 (見逃し救済)
- **accept**: 復習 GT 生成 (`mode: "review"`, `nodeId: parentNodeId`) → **即時** 今週の空き日に SI 挿入。
  押し出された plan SI は `carry-over` で翌週繰越。ゆい chat で「**明日 inf 復習 30 分入れたよ**」と即通知
- **dismiss**: `status: "dismissed"`、しばらく再提案しない
- **deferred**: `pending` のまま、次セッションで再提示

**理由**: 「accept 後に動かない」は中学生の達成感消失の元凶。「戻る仕組み」(Phase 4 設計の核) を
摩擦少なく動かす設計。

### P5-Q5 確定: Plan Type × Mode マトリクス

**定数テーブル化 + Plan Engine が参照**:
- 実装: `web/lib/learn/plan-mode-matrix.ts` に `PLAN_MODE_DISTRIBUTION: Record<PlanType, Record<LearningMode, "primary" | "secondary" | "none">>`
- Plan Engine: PlanType を見て GT 生成時のモード配分を決定 (`primary` = 主に使う、`secondary` = 補助で使う、`none` = 使わない)
- **デフォルト**: `regular-study` (95% のケース、立案 UI に PlanType ピッカー常駐させない)
- **他タイプ起動**: 明示発話 (「試験対策の計画立てて」「苦手克服したい」「復習だけする」「長期記憶化」)
  + 「もっと ▼」サブメニュー「他の計画タイプ」で発見性担保

#### 推奨配分マトリクス (後日調整可、初期値)

| | input | output | review | drill | test |
|---|---|---|---|---|---|
| **regular-study** | ✓ | ✓ | ◯ | ◯ | ◯ |
| **exam-prep** | ◯ | ✓ | ✓ | ✓ | ✓ |
| **weakness-grind** | | ✓ | ✓ | ✓ | ◯ |
| **review** | | ◯ | ✓ | ◯ | ◯ |
| **long-term-memory** | | | ✓ | ✓ | ◯ |

(`✓` = primary, `◯` = secondary, 空欄 = none)

**理由**: 中学生に「あなたの PlanType は?」は認知負荷高すぎ。発話で起動 = PHILOSOPHY「AI と対話で全てが回る」整合。

### P5-Q6 確定: Plan Engine ダッシュボード UI

**既存 [プラン] メニュー (C13 右端強調) を Plan Engine 入口に拡張**:
- URL: `/tutor?view=plans` (既に Phase 4 で予定、本実装で中身を詰める)
- 構成:
  - **左サイドリスト**: LearningPlan[] (active / paused、科目アイコン付き)
  - **右パネル** (選択中の plan):
    - 概要: タイトル / 期間 / 進捗バー (今月% / 全体%)
    - 全期間ロードマップ (月単位タブ、GT カレンダー)
    - weakNodes 一覧 (追加 / 削除可)
    - pending Suggestion + 最近の Interrupt
    - 修正履歴 (PlanRevision タイムライン)
- **ヘッダ右**: `[新しい計画 (+)]` → `/tutor?view=plan-new` (既存立案 chat に遷移)
- **「完了済を表示」トグル**で `status: "completed"` の plan 一覧切替

**親可視性**: **本人専用**。親 (admin) は週次/月次レポート (本人共有チェックボックス経由) でのみ
進捗を知れる。Q15 (本人同意制) を Plan にも一貫適用。中2 女子の親共有神経質配慮 + 完璧主義プレッシャー回避。

### P5-Q7 確定: 「今日のタスク」クリック時の挙動

**常に今日の SI 一覧表示**:
- 主動線: `[今日のタスク]` クリック → `/tutor?view=today-tasks` (新ルート)
- ルート整理:
  - `/tutor?view=schedule` → **`/tutor?view=today-tasks` にリネーム** + 中身書き換え
  - `/schedule` (バックアップ動線) → **`/today-tasks` にリネーム**
  - コンポーネント `ScheduleDashboard` → **`TodayTaskDashboard`** にリネーム
- 内容:
  - 今日の SI[] (plan + carry-over + ad-hoc) を順番に並べた一覧
  - 各 SI に `[開始]` → `/learn?node=xxx&startDay=1` 遷移 + `status: "todo" → "doing"` 遷移
  - 完了時 `[完了]` で `status: "done"` + `doneAt` 記録
- 補助 UI:
  - 上部: 「今日の進捗 N/M done」
  - 下部: 全 done 時に「お疲れさま、振り返ろう」CTA (軽い 1-2 ターン chat、本格振り返りは朝の儀式)
- **帰宅儀式は別動線維持** (今日のタスクには混ぜない、自動起動 + 「もっと ▼ → 帰ってきた」明示起動の 2 経路)

**理由**: 「同じボタンで違う画面」を避ける = 中学生に予測可能。「[今日のタスク] = 毎日の起点」(C13 哲学) に忠実。

### Phase 5 本実装結果 (C14 試作 + C15-C24、2026-05-25)

> 実装ファイル全体像:
> - `web/lib/learn/types.ts` (Phase 5 型ブロック + Phase 5 TutorCard 3 種追加)
> - `web/lib/learn/mock-data.ts` (Phase 5 mock、全期間 GT 化シンボル含む 12 件)
> - `web/lib/learn/plan-mode-matrix.ts` ★C16 新規 (PLAN_MODE_DISTRIBUTION 定数)
> - `web/lib/learn/tutor-mock.ts` (Phase 5 state + ヘルパー + 発話分岐多数)
> - `web/components/tutor/cards/WeakNodePickerCard.tsx` ★C17 新規
> - `web/components/tutor/cards/NodeReviewSuggestionCard.tsx` ★C18 新規
> - `web/components/tutor/cards/ReplanDraftCard.tsx` ★C19 新規
> - `web/components/plans/PlanEngineDashboard.tsx` ★C21 新規
> - `web/components/today-tasks/TodayTaskDashboard.tsx` (旧 schedule からリネーム + 進捗バー/CTA 追加、C22+C23)
> - `web/components/reports/WeeklyMonthlyReportView.tsx` (Suggestion 副提示 + Replan draft + weakNodes 追加 3 セクション拡張、C20)

#### 確定型まとめ (試作 → 本実装でどう扱われたか)

| 型 | 試作 (C14) | 本実装での扱い (C15-C23) |
|---|---|---|
| `PlanType` | 5 種 | そのまま採用 |
| `LearningMode` | 5 種 | そのまま採用 |
| `ResourceType` | 5 種 | そのまま採用 |
| `ReviewRules` / `TestRules` / `ReplanRules` | フィールド定義済 | C19 Replan で `ReplanRules.delayThresholdDays/replanMode` を実ロジックに接続 |
| `GeneratedTask` | planId + nodeId + mode + resource + 優先度 + 期限 | 試作型をそのまま採用 (pageRange は `resource.pageRange` で既に持っており追加不要、C16 で確認) |
| `InterruptEvent` | フィールド定義済 | C19 で `getUntriggeredInterrupt()` + 朝の morning モード冒頭で carry-over Replan draft 自動提示 |
| `NodeReviewSuggestion` | 子→親ノード + status | C18 で 3 択フロー実装 (accept/dismiss/defer)、accept で復習 GT/SI を即時生成 |
| **新規** `PLAN_MODE_DISTRIBUTION` | — | C16 で `plan-mode-matrix.ts` に新設、`getModeWeights()` ヘルパー + `PLAN_TYPE_LABELS` 同梱 |
| **新規** TutorCard `weak-node-picker` | — | C17 で `WeakNodePickerCard` 連動 |
| **新規** TutorCard `node-review-suggestion` | — | C18 で `NodeReviewSuggestionCard` 連動 |
| **新規** TutorCard `replan-draft` | — | C19 で `ReplanDraftCard` 連動 |
| **新規** TutorState `plan-await-weak-nodes` | — | C17 で立案フロー (duration → weak-nodes → confirm) に挿入 |
| **新規** TutorStep `proposedPlanType / proposedWeakNodeIds / proposedReplanDraft` | — | C17/C19 で state machine 引継ぎに使用 |
| **新規** RightPaneView `plans` | — | C21 で Plan Engine ダッシュボード経路 |
| **既存変更** `ScheduleItem.generatedTaskId?` | — | C16 で追加 (P5-Q1 1 GT : 1 SI 紐付けの逆参照) |
| **既存変更** `RightPaneView "schedule" → "today-tasks"` | — | C22 で全リネーム |
| **既存変更** `TutorRightPaneAction "open-schedule" → "open-today-tasks"` | — | C22 で全リネーム |

#### Plan Engine ヘルパー (tutor-mock.ts、export 化)

C19 で実装、C20 で再利用するため export 化:
- `detectPlanDelay()`: アクティブ plan の今月 SI で dueDate 過ぎ todo 件数判定
- `buildReplanDraft({ plan, replanKind, triggeredBy, ... })`: 種類別 (carry-over/pace-change/material-change) draft 文面生成
- `commitReplan({ planId, replanKind, triggeredBy, reason })`: PlanRevision push、material-change は status: paused
- `computeWeakNodeCandidates()`: Issue (open) + NodeComprehension (score<0.55) から候補抽出、上位 5 件
- `acceptNodeReviewSuggestion(suggestionId)`: 復習 GT/SI 即時生成 + Suggestion status: accepted
- `dismissNodeReviewSuggestion(suggestionId)`: Suggestion status: dismissed
- `getOldestPendingSuggestion()` / `getUntriggeredInterrupt()`: 朝の morning モード冒頭提示用

#### Phase 6 へ送った実装 (今は意図的に簡略化)

- pace-change Replan の `monthlyRoadmap` 再計算 + 未来 GT[] 全再生成 (現状は PlanRevision 履歴のみ)
- carry-over Replan の SI 日付付け替えロジック (現状は履歴のみ)
- material-change Replan の新 LearningPlan 自動生成 (現状は旧 plan paused のみ)
- WeakNodes / NodeReviewSuggestion の AI 自動判定 (現状は固定閾値 + 静的 mock)
- Interrupt の自動生成 (現状は MOCK_INTERRUPT_EVENTS 固定 2 件)
- 各 SI [開始] /learn 遷移の status: todo → doing 自動遷移 (C23 では UI のみ)
- weakly-review Replan の自動発火後 chat への通知 (C20 では画面表示のみ)

詳細な commit 内容と動作確認動線は `SESSION_HANDOFF.md` §3-§4 参照。

---

### 設計の核 (Q1-Q17 の上流)

| 哲学 | 内容 |
|---|---|
| **学習観の対比** | 小中学生は「前進だけ」(習う→復習→テスト→忘却)、会計士試験は「前進しつつ振り返る」が頻繁。**戻る仕組みを AI が支援する** のが核心 |
| **2 軸並走** | 自走の **長期/中期計画** (LearningPlan、AI が伴走) と、外から降ってくる **突発タスク** (帰宅儀式の Inbox) を並走させる |
| **PDCA フラクタル** | 週次 Check (来週調整) + 月次 Check (繰り越し or 修正プラン) の二層 PDCA |
| **インプット 3 回転重視** | ito19 さんの会計士試験経験 = テキスト 1 冊を 3 回以上回す。ページ単位で機械的に配分、本人は「3 回読む」だけ理解 |
| **達成感を最優先** | レポートは「達成度 → 学校 → 弱いところ → 来週」のサンドイッチ構造で、最初と最後がポジティブ |
| **2 儀式分離** | 朝 = 既存振り返り (4 セクションに縮退) / 帰宅 = 新規 2 部構成。学校で何習ったかは記憶が新鮮な帰宅時に聞く |
| **本人主体** | 計画立案・修正プラン・親共有、すべて本人意思を尊重 (コーチング原則 + 中2 女子の親共有神経質に配慮) |

### LearningPlan (新型) — 計画立案の中心

```ts
// 科目ごとの長期計画。ExamPrep (試験対策、短期集中) と独立並走。
LearningPlan {
  id, learnerId, subjectId
  title                        // 「中2 英語 教科書 計画」
  scope: "year" | "semester" | "term"
  startDate, endDate
  materials: MaterialRef[]     // 教材選択 (1 〜複数)
  targetRotations: number      // 回転数 (3 回推奨)
  currentRotation: number      // 今何回転目
  totalPages: number           // 教材総ページ

  // === Roadmap (全期間プラン、必ず作る) ===
  monthlyRoadmap: PlanSegment[]
    // [{month: "2026-05", targetPages: 67}, {month: "2026-06", targetPages: 67}, ...]

  // === 月次展開 (具体 ScheduleItem 化、当月のみ) ===
  expandedMonths: ExpandedMonth[]
    // [{month: "2026-05", scheduleItemIds: [...]}, ...]

  status: "active" | "completed" | "paused"
  revisions: PlanRevision[]    // PDCA Action の履歴 (修正プラン履歴)
  createdAt, updatedAt
}

// 月次ロードマップの 1 セグメント
PlanSegment {
  month: string                // "YYYY-MM"
  targetPages: number          // この月で読む目標ページ
  startPage?: number           // 開始ページ (任意、計算可能)
  endPage?: number             // 終了ページ
  carryOverFromPrev?: number   // 前月からの繰り越し
}

// 月次展開の記録
ExpandedMonth {
  month: string
  scheduleItemIds: string[]    // この月の ScheduleItem id 群
  expandedAt: string           // 展開日時 (月初に AI が展開)
}

// 計画見直し履歴 (PDCA の A)
PlanRevision {
  id
  revisedAt: string
  reason: string               // 「テキスト使いにくい」「ペース速すぎ」等
  changedFields: string[]      // 変更したフィールド名
  triggeredBy: "monthly-review" | "manual" | "ai-suggestion"
}
```

**「1 回転 = 教材通読 1 セット」「ページ単位で配分」(Q4 確定)**: シンプルさ最優先、本人説明「教科書を 3 回読むよ」で伝わる。1 回転目は自然に概観、2 回転目は自然に詳細、3 回転目は自然に定着、を **本人の中で起こす** 設計 (ツール化哲学整合)。

### ScheduleItem 拡張 (帰宅儀式・突発タスク対応)

```ts
// 既存 ScheduleItem に Phase 4 で追加
ScheduleItem {
  ...既存フィールド...

  // === Phase 4 追加 ===
  tags?: string[]              // 自由タグ「宿題」「提出物」「テスト範囲」「親に頼まれた」等
  source: "plan" | "carry-over" | "ad-hoc"
    // plan       = LearningPlan からの月次バッチ展開
    // carry-over = 前日できなかった繰り越し
    // ad-hoc     = 帰宅儀式で当日追加された突発タスク
}
```

**Inbox 型は作らない (Q7 確定)**: ito19 さんの判断「タグだけでいい、確定したら今日のスケジュールに並べる」。GTD 的な整理ステップは中学生の認知負荷が高すぎる。受信は ScheduleItem 直接追加、タグは自由テキスト。

### SchoolDailyReport (新型) — 帰宅儀式の学校レポート

```ts
SchoolDailyReport {
  id, learnerId
  date                         // YYYY-MM-DD
  periodCount: number          // この日の時限数 (1-6、可変)
  periods: PeriodEntry[]       // 時限別
  extraEvents?: string         // 学校での他の出来事・相談事 (任意)
  createdAt
}

PeriodEntry {
  periodNumber: number         // 1-6
  subject: string              // 「英語」「数学」「体育」など
  content: string              // 何を習ったか
}
```

**時限数は可変 (Q14 確定)**: 中学生の現実 (短縮日、振替、行事日) で時限数バラバラ。毎日「今日何時限あった?」を 1 タップで聞く。

### ReflectionLog 改訂 (5 → 4 セクション)

```ts
// schoolToday を撤去 (帰宅儀式の SchoolDailyReport に移行)
ReflectionLog {
  id, learnerId, date
  cadence: "daily" | "weekly" | "monthly"

  // === 朝の振り返り 4 セクション (cadence: "daily") ===
  yesterdayReview?         // 昨日の学習レビュー
  emotionsAndEvents?       // 起きたこと、気分
  questionsAndDoubts?      // 疑問・不安 (掘り起こし入口)
  todayPlan?               // 今日の計画

  // === 週次/月次レポート (cadence: "weekly" | "monthly") ===
  weeklyMonthlyReport?: WeeklyMonthlyReport   // 4 セクション構造 (下記)

  // 派生リンク (既存通り)
  derivedIssueIds?, derivedScheduleItemIds?, derivedHandoffIds?
  weekStart?, goalIds?
  createdAt
}

// 週次/月次レポートの 4 セクション (Q9 確定)
WeeklyMonthlyReport {
  // 1. 達成度 (達成感を出す、最重要)
  achievement: {
    plannedPages: number
    actualPages: number
    achievementPct: number       // 0-100
    previousPeriodPct?: number   // 先週/先月比
    consecutiveDays: number      // 連続学習日数
    badges: AchievementBadge[]   // 獲得バッジ
    // 月末週は + 月次達成度も
    monthlyAchievement?: {
      plannedPages, actualPages, achievementPct
    }
  }

  // 2. 学校まとめ
  schoolSummary: {
    dailyReportRefs: string[]    // 当該期間の SchoolDailyReport.id 群
    aiSummary: string            // AI 生成「今週/今月の重要ポイント」
  }

  // 3. 弱いところ (戻る候補)
  weakSpots: {
    issueIds: string[]           // 未クリア Issue 上位 3 件
    nodeComprehensionIds: string[] // 浅いノード上位 2 件
  }

  // 4. 来週の計画 + Action
  nextPeriodPlan: {
    plannedPages: number
    carryOver: number            // 繰り越し
    totalPages: number           // 合計
    actionProposals: ActionProposal[]
      // 時間配分、教材変更、ペース調整 等の提案
  }

  // 月末週のみ
  nextMonthPlan?: {
    monthlyRoadmap: PlanSegment   // 来月の roadmap
    revisionDraft?: PlanRevision  // 修正プラン draft (AI 提案、本人確認待ち)
  }
}

AchievementBadge {
  kind: "streak-3" | "streak-7" | "streak-30" | "month-80" | "month-100" | "issue-5-cleared" | "reconstruction-perfect"
  earnedAt: string
  description: string            // 「3 日続いたよ」など
}

ActionProposal {
  kind: "time-increase" | "duration-extend" | "rotation-reduce" | "material-change" | "order-change"
  detail: string                 // 「月: +20 分早めに始める」など
  rationale: string              // ゆいの所感
}

// 親への共有設定 (Q15 確定: 本人同意制)
SharedToParent {
  reportId: string
  sharedAt: string
  scope: "summary" | "full"      // 数値のみ or フルレポート
}
```

### 帰宅儀式 (2 部構成、Q8 確定)

平日 16:00 以降の初回アクセスで自動起動 (Q13)。土日は通常モード。

```
第 1 部: 学校レポート (時限別シーケンシャル → SchoolDailyReport 保存)

1. ゆい「おかえり! まず学校の話聞かせて。今日は何時限まで授業あった?」
   → 本人 (タップ選択 1-6)
2. ゆい「1 時限目は何の科目?」→ 本人「英語」
3. ゆい「何習った?」→ 本人「不定詞」
4. (時限数だけ繰り返し)
5. ゆい「他に学校で起こったこと、相談したいことある?」
   → なし: スキップ / あり: 自由テキスト (extraEvents)
6. ゆい「OK、今日の学校レポート、書いておいたよ」(SchoolDailyReport 確定)

第 2 部: スケジュール確定 (plan + carry-over + ad-hoc → 順番 → スタート)

7. ゆい「じゃあ今日のスケジュール確認しよう」
   - plan (今月計画から): 英語 教科書 p.58-60
   - carry-over (前日積み残し): 英語 p.55-57 残り
8. ゆい「他に学校から宿題とか課題、出てなかった?」
   → あり: 内容 + 期限 + いつから開始 → ad-hoc ScheduleItem 化 (タグ付き)
9. ゆい「OK、今日はこれ全部だね、開始しよう」
```

### 計画立案フロー (Q11 確定: ゆい対話 + カード ハイブリッド)

PHILOSOPHY「AI と対話で全てが回る」整合。既存 subject-picker / material-picker カードを流用 + 新規 duration-picker / roadmap-preview カード。

```
ゆい「英語の計画、立てよう。教材選ぼうか」
  ↓ [subject-picker] → 「英語」
ゆい「どの教材で進める?」
  ↓ [material-picker] → 「中2 英語 教科書」
ゆい「全体で何ヶ月で 1 回転終わらせる? 何回転する?」
  ↓ [duration-picker] → 「3 ヶ月で 1 回転 × 3 回 = 9 ヶ月」
ゆい「教科書 200p だね。AI で計画作ってみた、見て」
  ↓ [roadmap-preview]
     ┌──────────────────────────┐
     │ 英語 教科書 計画         │
     │ 1 回転目: 5 月〜7 月     │
     │   - 5 月: p.1-67  (67p) │
     │   - 6 月: p.68-134 (67p)│
     │   - 7 月: p.135-200 (66p)│
     │ 2 回転目: 8 月〜10 月    │
     │ 3 回転目: 11 月〜1 月    │
     └──────────────────────────┘
ゆい「これで OK? ペース変えたい?」
  ↓ 「OK」/「もう少しゆっくり」/「もう少し速く」
ゆい「OK、決まったよ。5 月の分を今からスケジュールに出すね」
  → 月次バッチ実行 (5 月分の ScheduleItem 生成)
```

### 月次バッチ + 月末判定 = 月末週の週次レポートに統合 (Q12 確定)

月末専用儀式は新設しない。**月末週 (例 5/25-5/31) の週次レポートを拡張版** にして月次レポート + 来月計画展開を一緒に出す。儀式の爆発を防ぐ。

```
週次レポート (5/25-5/31)
──── 1. 達成度 (週) ────
──── 1.5 達成度 (月) ★月末週のみ ────
──── 2. 学校まとめ (週) ────
──── 3. 弱いところ (週 + 月集計) ────
──── 4. 来週の計画 + Action ────
──── 5. 来月の計画 ★月末週のみ ────
     6 月 roadmap (AI 自動生成)
     繰り越し分の振り分け
     修正プラン提案
     ↓ 本人「OK」 / 「もう少しゆっくり」 / 「教材変える」 / 「考えさせて」
     → 確定で 6 月分 ScheduleItem 生成 (月次バッチ実行)
```

### 弱いところの基盤: Issue (点) + NodeComprehension (面) ハイブリッド (Q10 確定)

- **未クリア Issue 上位 3 件** (最近 chat で言及、今週発生したもの優先): 「具体的な詰まり」
- **浅いノード 上位 2 件** (NodeComprehension.score < 0.55): 「体系の浅さ」
- 重複 (同じノードに両方ヒット) は Issue 優先で 1 件として表示、サブテキストで「ノード全体としても浅め」

ito19 さんの会計士試験的振り返り = 「具体的に詰まったところ (点) + 章全体として浅い (面)」の 2 段認識。

### 親 (admin) への共有: 本人同意制 (Q15 確定)

- デフォルト OFF
- 週次/月次レポートに [親と共有] チェックボックス
- チェック → SharedToParent 生成 → admin の /tutor に「娘さんから今週のレポート届いたよ」通知
- 本人が選んだ項目だけ admin 可視 (プライバシー保護 + 能動的共有で達成感のもう 1 層)

REVIEW コーチング指摘「中2 女子は親に何が伝わるか神経質」への構造的解答。

### 達成バッジ (Q16 確定、5-7 種類)

| バッジ | 条件 |
|---|---|
| 🌱 | 連続 3 日 (1 日 5 分でも OK の軽め基準) |
| 🌿 | 連続 7 日 |
| 🌳 | 連続 30 日 |
| 🎯 | 月達成 80%+ |
| 🏆 | 月達成 100%+ |
| 🎓 | Issue 5 件クリア |
| ⭐ | 復元テスト全問正解 |

獲得バッジは週次レポートのセクション 1 + プロフィール的な場所に **静的に残る**。ゲーム的演出 (パーティクル等) は過剰、PHILOSOPHY「暗記モードへの逆戻り = 報酬目的化」リスクのため避ける。

---

## Phase 6: Claude API 接続 (2026-05-26 smoke test 着手)

ito19 さん 2026-05-26 セッション末で「プランは AI が立てる前提、ここでそろそろ AI の動きを確かめる必要がある、Claude の API を入れましょうか」と方針確定 → Phase 6 着手。プラン grill 9 候補 (①〜⑨) は AI の動きを見てから議論する流れに変更 (= mock のままで「ゆいが計画をどう立てるか」議論しても地に足つかない、という ito19 さん判断)。

### 着手範囲 (smoke test)

**最小単位**: ゆいの「計画立てよう」入口の **1 発話だけ** Claude Opus 4.8 で生成。他の発話 (帰宅儀式 / レポート / 課題受付 / カード選択後 / 葵 chat 等) は引き続き mock。

### 設計確定 8 論点 (2026-05-26 grill)

| # | 確定 |
|---|---|
| 1 | 起点 = Claude API 接続 (Phase 6 着手)、プラン grill 9 候補は AI 化後に議論 |
| 2 | smoke test 先行 (Phase 6 全体着手ではなく、最小単位で「動くこと」確認) |
| 3 | 代入点 = 「計画立てよう」入口のゆい応答 1 発話 (context 不要、最小単位) |
| 4 | モデル = Claude Opus 4.8 (`claude-opus-4-8`、本番想定通り、cost は smoke test なら 1 円未満) |
| 5 | 呼び出し場所 = Server Action (Next.js 16 標準、`'use server'`、API key は server-only) |
| 6 | mock 切替 = `NEXT_PUBLIC_USE_CLAUDE_API=true` + 「計画立てよう」keyword のみ Claude、それ以外 / 失敗時も mock fallback |
| 7 | system prompt = TUTOR-ROLE.md + PHILOSOPHY.md 全文そのまま (prompt caching ephemeral)、SSoT 整合 |
| 8 | env 名 = `AI_EDU_ANTHROPIC_API_KEY` (= 親 harness の `ANTHROPIC_API_KEY=""` injection と衝突回避) |

### 実装ファイル

| ファイル | 役割 |
|---|---|
| `web/lib/learn/tutor-claude.ts` (新規) | Server Action `tutorClaudeRespondToPlanRequest(userInput): Promise<string>`、TUTOR-ROLE + PHILOSOPHY を fs.readFile で system prompt 化、Anthropic SDK で Opus 4.8 呼び出し、prompt caching (ephemeral) 有効化 |
| `web/lib/learn/tutor-mock.ts` | 末尾に `buildNextTutorReplyAsync(args): Promise` 追加、`NEXT_PUBLIC_USE_CLAUDE_API=true` + plan keyword 一致時のみ Claude 経由、それ以外 / 失敗時は同期 `buildNextTutorReply` に fallback |
| `web/components/tutor/TutorChat.tsx` | `generateReply` prop 型を `Promise<TutorMessage>` 返却に変更、`appendThenReply` の setTimeout コールバックを async + try/finally で `setIsThinking(false)` 保証 |
| `web/components/tutor/TutorWorkspace.tsx` | `buildNextTutorReplyAsync` import 追加、`generateReply` を async/await 化 (他 `onPick*` ハンドラは同期のまま — カード選択経由は keyword 解析を経ないため Claude 化対象外) |
| `web/.env.local.example` | `AI_EDU_ANTHROPIC_API_KEY` + `NEXT_PUBLIC_USE_CLAUDE_API=true` template 追加、env 名衝突の理由コメント追記 |
| `web/package.json` | `@anthropic-ai/sdk` 依存追加 |

### 動作確認結果 (2026-05-26)

「計画立てよう」発話に対するゆい応答例:

> いいね、計画立てよっか！
> じゃあまず、どの科目からいく？下に出てくるカードから選んでみて。
> 「これが一番気になる」とか「これ後回しにしたい」とか、なんとなくでも OK だよ〜

合格判定:
- ✅ ゆいキャラ整合 (「だよ〜」「いいね」温かい口調)
- ✅ PHILOSOPHY「ふわっと → 具体化」軸そのまま (「なんとなくでも OK」)
- ✅ subject-picker への自然な誘導
- ✅ TUTOR-ROLE「コーチング軸」(「これが一番気になる / 後回しにしたい」の具体例で投げかけ、本人発話を引き出す)
- ✅ mock 文言「OK、学習計画立てよう! まず科目から。（教材を 3 回まわす計画を立てるよ）」と明確に異なる多様な応答

ito19 さん 2026-05-26「対応してくれました」OK 確認済。

### 環境変数衝突問題の Lesson Learned

Claude Code 等の親 harness は子プロセス起動時に **`ANTHROPIC_API_KEY=""`** (空文字列) と **`ANTHROPIC_BASE_URL`** を inject する (= ユーザー key 漏洩防止のための harness 設計)。Next.js (内部 dotenv) は「既存 env を上書きしない」規律なので、`.env.local` に `ANTHROPIC_API_KEY=sk-ant-...` と書いても **親 harness の空文字列が勝つ** 状態になる。

→ プロジェクト固有 prefix (`AI_EDU_`) で衝突回避するのが筋。同じパターンは葵 Phase 6 拡張、Phase 7 Supabase 接続 (`SUPABASE_*` は別 prefix も検討) でも踏襲する。

debug の決め手は `Object.keys(process.env).filter(k => /ANTHROPIC|SUPABASE/i.test(k))` で「envキー名は存在するが値が空」を検出した点。env 関連の不具合は値ではなくキーの存在を確認するのが第一歩。

### Phase 6 拡大の次の grill 候補

smoke test 動いた後の論点 (どこから着手するかは次セッション以降で grill):

| # | 論点 |
|---|---|
| A | **conversation history**: 現在ユーザー発話 1 件のみ messages、過去履歴も渡すか? (= ゆいが文脈を持つ前提) |
| B | **context 渡し**: 現在の科目 / WeakNodes / 過去 LearningPlan を system prompt or messages に渡すか? |
| C | **tool use**: Claude が `subject-picker` カード type を構造化出力で返すなど (現状 card 分岐は mock 維持) |
| D | **プラン立案 core の AI 化**: LearningPlan + GT[] + SI[] を Claude が tool use で生成 (= ゆいが本当に計画を立てる、Phase 6 の本丸) |
| E | **ゆいの他発話の AI 化**: 帰宅儀式 / レポート / 課題受付 (プラン以外の発話拡大) |
| F | **葵先生先行**: 教材 PDF → 体系図 + 評価コメントを Claude Opus で生成 (ARCHITECTURE 当初の Phase 6 主役、現在 mockExtractNodes) |
| G | **プラン grill 9 候補に戻る**: ① 計画立案の起点 / ② 教材ピッカー UX / ③ 科目自動検出 / ④ roadmap-preview / ⑤ キャンセル / ⑥ 複数並走 / ⑦ ゆいの事前情報 / ⑧ 既存計画との関係 / ⑨ 1 計画 1 教材 vs 複数教材 |

次セッション開始時、ito19 さんに「A〜G のどこから? まず /tutor 動線一周してから?」アスク。

> **注記 (2026-05-27 追記)**: Phase 6 拡大 A-G grill は **着手前にプロジェクトの前提から見直し** となった。下記「## 学習プラン再設計 grill (2026-05-27)」セクション参照。Phase 5 で実装した骨格は **解体・再構築** 方向。

---

## 学習プラン再設計 grill (2026-05-27)

2026-05-27 セッション。Phase 6 smoke test 完了後の引継ぎから、ito19 さんが **学習プラン構造をゼロベースで見直す方針** を提示。同セッションで PHILOSOPHY 全廃止 + コーチング・ファースト型への思想転換 (C58) → 続けて、学習プラン構造の grill を 16 問詰めて確定 (C59) → 後段で失敗扱い grill 6 問 F1-F6 確定 (C60)。2026-05-28 セッションで中学生主体性 grill 6 問 D2-1〜D2-6 確定 (C61)。累計 grill 28 問。**Phase 5 で実装した骨格 (LearningPlan 9 ヶ月、全期間 GT 化、教材ノード生成、PlanType 5 種等) は大幅に作り直し** になる。

### 思想転換の起点 (C58 = PHILOSOPHY 全書き換え、push 済)

- 旧 PHILOSOPHY (AI 提案ベース、ito19 さん未納得、暗記からの脱却・体系図・なぜを問う) を **全廃止**
- 新中心宣言: **「コーチング・ファースト型 学習アプリ」**
- 読者: 子供 (毎回腹落ち儀式) → **親 (アプリ使う前に必ず読む)** へ転換
- 差別化軸: 「AI で質疑応答・教える側」は世にいる、「AI でコーチング」を狙うのは我々だけ
- 5 章構成: 軸はコーチング / 構造的空白 / 直線進行と分からない地獄 / プロ野球コーチアナロジー / 親へのお願い
- 親⇄ゆいコーチ対話チャネル明示 (ゆい→親 報告+ヒアリング、親→ゆい 質問、ゆい→親 答え)

### 確定論点 (累計 47、grill 第 1〜30 問)

#### A. 思想・対象 (8 論点)

| # | 論点 | 確定 |
|---|---|---|
| A1 | 中心軸 | コーチング・ファースト (ティーチングも持つが軸はコーチング、葵=ティーチャー、ゆい=コーチ) |
| A2 | フィロソフィー読者 | **親** (アプリ使う前に必ず読む、子供向け腹落ち儀式は廃止) |
| A3 | 旧 PHILOSOPHY 扱い | **全廃止** (i 学習・勉強観 / ii このツール思想を分けて、ii で書き直し) |
| A4 | 親⇄ゆい対話チャネル | 4 方向: ゆい→親 報告 / ゆい→親 ヒアリング / 親→ゆい 質問 / ゆい→親 答え |
| A5 | 対象範囲 | **塾通い + 通信教育 (Z会・進研ゼミ等) 両方対象** |
| A6 | 学年別設計 | **共通基盤** (機能の出し入れで対応、別設計はしない) |
| A7 | 葵 (ティーチング) の射程 | **受動的補助** (学校・塾で分からなかったことを持ち込んで「一緒に見る」、能動的に教える役ではない) |
| A8 | 高校拡張時期 | **約 2 年後** (長女が高校生になる頃)、大学受験まで同じ仕組み |

#### B. プラン構造 (6 論点)

| # | 論点 | 確定 |
|---|---|---|
| B1 | 長期計画 | **持たない** (大人受験モデルは無理、子供は塾でも全期間俯瞰しない) |
| B2 | 更新サイクル | **1 ヶ月ごと**、目の前に湧いたものを計画 |
| B3 | 系統構造 | **学校課題 + 塾課題 (+ 通信教育) の二系統** |
| B4 | 優先順位 | **学校 > 塾**、学校試験優先 |
| B5 | 計画の起点 | 学校・塾の **外部スケジュール** (テスト日 / 提出日 / 塾カリキュラム) |
| B6 | 見せ方 | **今日のタスク + 1 ヶ月分の全タスク** を見せる (登録は 1 ヶ月先まで) |

#### C. つまずき遡及 (最大差別化要因、5 論点)

| # | 論点 | 確定 |
|---|---|---|
| C1 | 遡及範囲 | **学年を超える** (中2 連立 → 小5 割合 など) |
| C2 | ノード設計の大転換 | ~~教材アップロードから体系図ノードを作る方式を廃止~~ → **2026-05-28 後段で撤回**: 教材アップロードから体系図を作る (= 当初設計に回帰)、下記「### 2026-05-28 後段: 教材ベース回帰 + 読まれていない範囲フォロー (C2/C3 撤回)」参照 |
| C3 | カリキュラム源 | ~~小〜高の全カリキュラムを事前に AI が検索して用意~~ → **2026-05-28 後段で撤回**: カリキュラム DB は持たない、教材ベースのみ |
| C4 | 発動方法 | AI 対話駆動 (ヒアリング・テスト・質疑応答)、AI が認定 → 「ここに戻ろう」 |
| C5 | 親通知 | **必ず親に報告**、親が監視役 (「コーチが言ってるけどやった?」と確認) |

#### D. 主体性・親可視性・言語化 (7 論点)

| # | 論点 | 確定 |
|---|---|---|
| D1 | 主体性 (小学生) | **親承認モデル** (AI が作る → 親が承諾 → 子に渡る) |
| D2 | 主体性 (中学生) | **OPT-OUT 親承認モデル** (詳細 6 論点 D2-1〜D2-6 = 下記「#### D2 詳細」セクション、grill 第 25-30、2026-05-28) |
| D3 | 親可視性 (弱点) | **絶対親に共有** (AI 作問・ヒアリングで「曖昧だった箇所」も) |
| D4 | 朝の振り返り (1 限目) | **不要 or 小学校のみ**、中学以降は廃止方向 |
| D5 | 帰宅後の振り返り | **もっとフリーに、思い切り喋ってもらう** (現行「ふわっと→具体化」継承) |
| D6 | 言語化の流れ | 子が喋る → **AI が通訳** → 親に共有 → 親も AI と対策相談 |
| D7 | 主用途 | 塾教材読み込み / 音声会話 / コーチング / 課題提案 / 課題まとめ / 不明点 AI 学習 |

#### D2 詳細 (中学生主体性、6 論点、grill 第 25-30、2026-05-28)

D2 は C59/C60 時点で未確定だったが、本 grill で 6 論点に分解して確定。**核心 = 中学生でも親関与は必須** (D3 弱点絶対親共有 / A4 親⇄ゆいコーチ対話 / F5 戻り誘導 = 親 OPT-OUT 承認 / C5 親通知必須 が既にベースラインを作っている) **その上で「OPT-OUT」パターンを採用して子の主体性も両立する**。学年共通基盤 (A6) 整合で中1-中3 の差別化なし。

| # | 論点 | 確定 |
|---|---|---|
| D2-1 | 計画立案の承認権 | **OPT-OUT 親承認** (F5 戻り誘導と同型) — AI 立案 → 子の ゆい chat に提示 → 親に通知 → 親 OK or 自動 OK で発火、親異議で AI 再立案 |
| D2-2 | 動けるタイミング | **即時子発火 + 親 24h 異議窓口** (F5 の「3 日経過自動 OK」とは別設計、計画立案は月のタスク表示そのもので止められないため。3 日待ちは月の 10% 停止コストが大きすぎる) |
| D2-3 | 月途中変更 (子発議) | **立案と同じパターン踏襲** (子発火 + 親 24h 異議で「保留→再調整」)。立案 / 月途中変更 / F5 戻り誘導 が「子・AI 動く + 親 OPT-OUT」で 3 つの主要更新フロー一貫 |
| D2-4 | 親発議 (「数学厚くして」等) | **ゆい仲介コーチングフロー (E9 汎用化)** — 親→ゆい発話→ゆいから子にヒアリング→子 OK で更新 / 子異議でゆいから親に返信し対話継続。A4 親⇄ゆい対話 4 方向すべて使う |
| D2-5 | 親通知の透明性 | **子に明示「親にも伝えたよ」** — ゆいが子に 1 行告げる。隠れた監視感を回避 = 思春期信頼関係の基盤、PHILOSOPHY コーチング・ファースト整合。親 chat の全内容は子に見せない (親本音吐露の場を保護 = A4 親→ゆい 質問チャネル機能維持) |
| D2-6 | 親異議処理 | **D2-4 同型 (ゆい仲介コーチング)、再窓口 1 回まで** — 親異議→ゆい→子ヒアリング→子 OK で再立案 (再窓口 1 回まで) / 子異議で親⇄ゆい対話継続。3 回目以降は親⇄ゆい対話で手動確定 (永遠ループ防止) |

**3 つの主要更新フローが統一されたパターンに収斂** (実装シンプル化 + UX 予測可能性向上):

| フロー | 発議者 | 確定済 |
|---|---|---|
| 子発議の変更 | 子 | D2-3 |
| AI 発議 (戻り誘導) | AI | F5 |
| 親発議 (親フィードバック) | 親 | D2-4 (= E9 汎用化) |

→ いずれも「動く側が即時発火 + 反対側が異議窓口 (24h、ゆい仲介)」の対称構造。

**思想ポイント**:
- 「親関与は必須」(PHILOSOPHY コーチング・ファースト + A4 + D3 + C5 + F5) と「子の主体性尊重」(コーチング・ファースト、思春期信頼関係) のバランス解 = **OPT-OUT モデル + 透明性 (D2-5)** で両立
- ゆい仲介コーチング (D2-4 / D2-6) = A4 親⇄ゆい対話 4 方向の実装具体
- F5 戻り誘導 + D2-1 計画立案 + D2-3 月途中変更 が「子・AI 動く + 親 OPT-OUT」で対称構造 → 実装 / UI ラベル / フロー共通化のベネフィット大

**スコープ外で別 grill 必要な隣接論点** (本 grill で意図的に詰めなかった):
- D1 → D2 切替時期 (年齢自動 / 親選択 / 子選択) — 運用論点、A6 学年共通基盤と整合させて検討
- 24h タイマー終了後の確定処理 (再 OPT-OUT 必要 / 月跨ぎ時挙動) — 実装細部
- 親未参加家庭 (片親 / 親アカウントなし / 親忙殺) のフォールバック — 運用論点

#### E. 試験前モード (9 論点、grill 第 10-16)

| # | 論点 | 確定 |
|---|---|---|
| E1 | 構造化 | **状態モデル** (1 本の計画内に通常期 ⇄ 試験前モード) |
| E2 | 発火条件 | **ハイブリッド** (試験範囲入力 OR 試験日 3 週前自動 OR 手動切替) |
| E3 | タスク生成 | **3 周 × 重点変化** (1周目=現状把握、2周目=弱点重点、3周目=最終確認) |
| E4 | 通常タスクとの関係 | **学校通常停止 + 塾課題並走** (子供視点でタスク量変わらず、中身入替) |
| E5 | 科目配分 | **3 周フェーズ別** (1=均等回し、2=弱点ウェイト、3=試験日逆算) |
| E6 | 試験後フェーズ | **コーチング駆動振り返り** (翌日ヒアリング + 答案分析 + つまずき遡及 + 親報告) |
| E7 | 発火タイミング数値 | **試験 3 週前** (範囲未入力でも自動発火、範囲発表後 2 週で 3 周モデル始動) |
| E8 | 試験日カレンダー登録 | **Phase 1 = 親手入力、Phase 2 で写真 OCR 追加** (子に入力させない) |
| E9 | AI 弱点判定誤り救済 | **親フィードバックチャネル経由** (ゆい→親「2周目は数学厚く」→ 親「いや英語の方が」→ 修正) |

#### F. 失敗扱い (6 論点、grill 第 19-24、2026-05-27 後段)

| # | 論点 | 確定 |
|---|---|---|
| F1 | UI / 内部の二段構え | **子供 UI は「失敗」概念ゼロ、内部 3 種類分け** (サボり / 誤答 / お休み) — 子供 UI ラベルは「完了 / 次回に持ち越し / つまずき発見の機会」のみ |
| F2 | 判定方法 | **AI 自動 + 親フィードバック** (E9 と同じパターン) — AI デフォルト判定、親「お休み」マーク等で上書き可、未入力なら AI 判定有効 |
| F3 | 未実施 (サボり) | **当月内 carry-over + 3 日連続検知で親通知** — 別チャット案「破綻許容設計」採用、1-2 日は静かに再配分、3 日連続でゆいから親通知 + 子にヒアリング |
| F4 | 誤答発見 | **AI 主導 (ヒアリング + ミニテスト出題)** — 子の発話「ここ多分こうかな」等の曖昧度も拾う、親申告は補助、PHILOSOPHY 章 4「AI はヒアリング得意」の具体経路 |
| F5 | 戻り誘導 | **AI 自動判定 + 親 OPT-OUT 承認** — AI が戻り候補判定 → ゆいから親 chat 通知 → 親 OK or 3 日経過自動 OK で発火、親異議で AI 再判定 |
| F6 | 細部 5 つ | (1) お休みはサボリカウントから除外、再配分のみ / (2) 誤答 3 分類 = 概念 (遡及発火) / ケアレス (記録のみ) / 暗記不足 (当該単元ドリル) / (3) 連鎖遡及最大 2 学年 (小学生 1 学年)、超えたら親に専門家相談提案 / (4) 戻り学習完了判定 = 再ヒアリング + ミニテスト 80% 以上 / (5) 試験前モード中は戻り誘導抑制、試験後 E6 振り返りで一括処理 |

### 未確定論点 (残り 5 件、次セッション以降で grill)

| # | 論点 | 性格 |
|---|---|---|
| 1 | PlanType 5 種の扱い | 中 (廃止 / 再編 / 系統との関係、Phase 5 解体級判断と直結) ← **次推奨スタート** |
| 2 | カリキュラム DB の作成・運用 | 中 (AI 検索駆動、具体運用、信頼性担保、つまずき遡及エンジンの基盤) |
| 3 | 系統 A/B 子に見せるか | 軽 (ito19 さん「全タスク見せていい」発言、確認のみ) |
| 4 | 時間予算自動制御 | 軽 (別チャット案、ito19 さんスルー、保留 or 採用?) |
| 5 | 2 系統の統合管制エンジン | 中 (別チャット案の核、採用?) |

### Phase 5 実装への影響 (解体級)

| 領域 | 現行実装 (C15-C24) | 新方針 | 影響度 |
|---|---|---|---|
| LearningPlan の期間 | 9 ヶ月、全期間 GT 化 (~180 GT 立案時生成) | 1 ヶ月単位の更新計画、長期 GT 化を廃止 | 🔴 解体 |
| 計画の起点 | 教材を選んで AI が GT 配分 | 学校/塾の外部スケジュール起点 | 🔴 解体 |
| 系統 | 科目別 LearningPlan | 学校系統 / 塾系統 の二系統 | 🔴 解体 |
| ノード源 | 教材 PDF → 葵が体系図ノード生成 (Phase 6F 予定) | 小〜高カリキュラム事前 DB、教材ノード生成を廃止 | 🔴 解体 |
| つまずき遡及 | NodeReviewSuggestion で親ノード遡及 (1 段) | 学年超え遡及 | 🟡 拡張 |
| PlanType (5 種) | regular/exam/weakness/review/long-term | 未確定 (廃止 or 再編) | 🟡 確認要 |
| 主体性 | 完全本人主体 (Q15 一貫) | 小学生 = 親承認 (D1) / 中学生 = OPT-OUT 親承認 (D2 詳細 = D2-1〜D2-6) | 🟡 拡張 |
| 朝の振り返り | morning モード実装済 | 廃止 or 小学校のみ | 🟡 縮退 |
| 親可視性 | 本人同意制で週次/月次レポート | 弱点を絶対親共有 + 親⇄ゆい対話 (C58) | 🟡 拡張 |

→ **Phase 5 で実装した骨格 (LearningPlan / GT / Plan Engine / 教材ノード) はほぼ作り直し**。「Phase 7 (永続化) の前に Phase 5 解体・再構築」ステージに入る。

### 次セッションで進める順序候補

1. ~~**失敗扱い** grill~~ ✅ 完結 (2026-05-27 後段、grill 第 19-24、確定 F1-F6)
2. ~~**中学生の主体性モデル** grill~~ ✅ 完結 (2026-05-28、grill 第 25-30、確定 D2-1〜D2-6)
3. **PlanType 5 種扱い** grill ← **次の推奨スタート** (現行 5 種をどうするか、Phase 5 解体級判断と直結)
4. **カリキュラム DB の作成・運用** grill (ノード設計大転換の具体、つまずき遡及エンジンの基盤)
5. 残り 3 (系統可視性 / 時間予算 / 2 系統統合管制) はまとめて確定

各 grill 完了後に SSoT 同期 (本セクションへ追記 + SESSION_HANDOFF + memory)。**実装着手は全 grill 完了 + 解体プラン確定後** が SSoT 原則。

### 第 1 段階 mock 反映 (2026-05-28、C62-C65)

C61 (中学生主体性 grill 完結) 直後、ito19 さん指示「C58 以降全体を mock に反映 (第 1 段階のみ、軽量範囲)」で着手。Phase 5 解体プラン確定前の **軽量・即効性ある思想反映だけ** に絞り、未確定 5 論点と衝突しない範囲で実施。

| commit | 内容 | 結果 |
|---|---|---|
| **C62** | feat: D2-5 ゆい mock に「親にも伝えたよ」発話追加 | ✅ 計画立案完了発話 + Replan accept 発話の 2 箇所に「お母さん・お父さんにも伝えたよ ✉️ + 24h 異議窓口」1 段落追加 |
| **C63** | feat: D5 朝振り返り (morning モード) を MORNING_MODE_ENABLED フラグで off | ✅ 定数 export 追加 + buildInitialTutorThread morning 分岐 + TutorWorkspace 初期 state 切替 = 朝振り返り 5 セクションを skip して即ハブ挨拶 (Interrupt/Suggestion 冒頭付与は維持) |
| **C64** | docs: ゆい mock の人格コメント + persona description を C58 新 PHILOSOPHY に整合 | ✅ ファイル冒頭コメント + TUTOR_PERSONA.description + buildNextTutorReply docstring を「コーチング・ファースト型 + 親⇄ゆい対話 (A4) + 葵=受動的補助 (A7) + 掘り起こし (F4)」明示に更新 (Phase 6 Claude API system prompt 元) |
| **C65** | docs: 第 1 段階 mock 反映 SSoT 同期 + F1 既に整合済確認 | 本セクション追記 + SESSION_HANDOFF / memory 同期 |

**F1 子供 UI ラベル「失敗」「達成」緩和の調査結果** (C65 で skip 判断):
- TodayTaskList は既に「完了 / 未完了 (中立)」のみで F1 違反なし
- 達成バッジ (C12) は ito19 さん明示「バッジ概念残す」= 維持
- weekly-report 「達成 → 学校 → 弱いところ → 来週」は「達成」をポジティブ感情表現として残し OK
- 「失敗」表現は全て内部 (型名 / mock description / 技術エラー画面) で子供 UI に直接出ない
- → 現状 Mock は偶然 F1 整合的に実装されていた、本格的な F1 内部 3 分類 (サボリ / 誤答 / お休み) は Phase 5 解体時に実装

**第 1 段階の動作確認動線** (dev server `cd web && npm run dev` 起動後):
1. `/philosophy` で C58 新 PHILOSOPHY (コーチング・ファースト型 + 5 章) が render されていることを目視確認
2. `/tutor` 初回アクセス → 朝振り返り 5 セクションに突入しない (C63)、ハブ挨拶「今日はどうする?計画 / 教材 / 課題 / 今日のタスク」のみ表示
3. ゆいに「計画立てよう」発話 → 既存フロー → 「これで OK」確定後の発話に「お母さん・お父さんにも伝えたよ ✉️」が出る (C62)
4. 「ペース変えて」「教材変える」等の Replan accept 発話にも「親にも変更点を伝えた」が出る (C62)

**残し (Phase 5 解体時にまとめて実装)**:
- D2-1 OPT-OUT 親承認の親 chat UI 新設 / D2-2 24h 異議窓口バナー / D2-4 親発議 (= 親アカウント ハブ / parent ハブ未構想)
- F1 内部 3 分類 (サボリ / 誤答 / お休み) + 子供 UI 自動マッピング
- F3 carry-over + 3 日連続検知ロジック
- F4 AI 主導誤答ヒアリング (= Phase 6 Claude API 拡大と連動)
- F5 戻り誘導の親 OPT-OUT 通知 UI
- B1-B2 1 ヶ月更新化 (LearningPlan 期間 9 ヶ月 → 1 ヶ月)
- B3 二系統 (学校+塾+通信教育) UI
- ~~C カリキュラム DB (教材ノード生成廃止)~~ → **仮実装着手 (C66-C68、下記「## カリキュラム DB 仮実装 (2026-05-28)」セクション参照)**
- E1-E9 試験前モード
- PlanType 5 種扱い (= 未確定 grill #1 後)

---

## カリキュラム DB 仮実装 (2026-05-28、方針撤回 → 再目的化)

> ⚠️ **2026-05-28 後段で方針撤回** (C69 で記録): 本セクションのカリキュラム DB スキーム (公的/ウェブ参照型) は **不可能と判断**。「### 2026-05-28 後段: 教材ベース回帰 + 読まれていない範囲フォロー (C2/C3 撤回)」セクションで新方針確定。/curriculum 画面 (C66) は **再目的化** = 教材ベース体系図の集約 UI として残置 (画面構造は流用、データ源を切替予定)。

2026-05-28 セッション末、ito19 さんから **プロジェクトの核 = 「小〜高カリキュラム全体を地図として持って、AI がつまずきを認定 → ヒアリング → 親共有 → 再学習プラン」というスキーム、これには地図 (体系図) が必須、画面イメージがないと議論進まない** と明示 → 英語 中1〜高3 体系図の **仮実装** を着手 (C66-C68)。

### 戦略

- カリキュラム DB grill (未確定 #2) は本格詰めを残しつつ、**画面で議論を進めるための仮の地図** を先に作る (= MVP のうちの MVP)
- 仮実装の構造は **作り直し前提**、grill 後に本格 DB に置き換え
- スコープ: 教科 = **英語のみ** / 範囲 = **中1〜高3** (中高一貫対応、A8 高校拡張 2 年後と整合)

### 実装内容

| # | SHA | 内容 |
|---|---|---|
| **C66** | `30eba7e` | feat: カリキュラム DB 仮実装 (英語 中1〜高3 体系図) + /curriculum 画面 — 型定義 (CurriculumNode / Domain / Grade / State 5 種) + MOCK_CURRICULUM_EN 約 55 ノード + 新規ルート /curriculum + CurriculumMatrixView (マトリックス表示 + 凡例 + Footer) |
| **C67** | `578d39f` | feat: ゆいメニューに「カリキュラム」リンクボタン追加 — 教材とプランの間に Link 配置、/curriculum?subject=english へ遷移 |
| **C68** | (本 commit) | docs: カリキュラム DB 仮実装 SSoT 同期 (本セクション追記 + SESSION_HANDOFF + memory) |

### 構造 (約 55 ノード)

| 分野 | 中1 | 中2 | 中3 | 高1 | 高2 | 高3 |
|---|---|---|---|---|---|---|
| **文法** | 7 単元 (be/一般動詞/疑問詞/三単現/進行形/過去形/命令文) | 7 単元 (未来/助動詞/不定詞/動名詞/比較/接続詞/文型) | 7 単元 (受動態/現在完了/関係代名詞/関係副詞/仮定法基礎/分詞構文基礎/間接疑問文) | 7 単元 (12 時制/仮定法完成/分詞応用/関係詞応用/完了助動詞/動名詞 vs 不定詞/受動態応用) | 6 単元 (強調/倒置/節応用/話法/否定構文/無生物主語) | 2 単元 (構文応用/総合演習) |
| **語彙** | 中1 500 語 | 中2 500 語 | 中3 500 語 | 高1 1000 語 | 高2 1000 語 | 大学入試 1000 語 |
| **読解** (学年区分なし) | 短文 / 段落 / 中長文 / 長文 (4 ノード) | | | | | |
| **聴解** (学年区分なし) | 短文 / 会話 / 長文 (3 ノード) | | | | | |
| **作文** (学年区分なし) | 単文 / 段落 / エッセイ (3 ノード) | | | | | |
| **会話** (学年区分なし) | 挨拶 / 日常 / 議論 (3 ノード) | | | | | |

### ノード状態 (5 種、色分け可視化)

| state | 色 | 意味 |
|---|---|---|
| `unlearned` | グレー | 未学習 |
| `in-progress` | 青 | 学習中 |
| `mastered` | 緑 | 完了 |
| `weak-detected` | **黄** | AI つまずき認定 (テスト誤答多 / ヒアリングで曖昧) |
| `weak-confirmed` | **赤** | 戻り誘導候補 (ヒアリング + 親確認済、「ここから戻ろう」とコーチング誘導) |

mock サンプル割り当て:
- 中1 系 = 全部 mastered (緑) = 既習
- 中2 = mastered (mastered) + 不定詞 3 用法 = **weak-detected (黄)** + 動名詞/比較/文型 = in-progress (青)
- 中3 = 関係代名詞 = **weak-confirmed (赤)** + 現在完了 = **weak-detected (黄)** + その他 unlearned
- 高1-高3 = ほぼ unlearned (グレー)
- 各分野で 5 色全部画面に出る配分

### 学年超え遡及の表現

`prerequisiteIds` フィールドで学年を超えた依存関係を表現:
- 中2 不定詞 → 中1 be 動詞 / 一般動詞 (= つまずいたらまず中1 に戻る)
- 中3 受動態 → 中1 過去形 (= 中3 で受動態がうまくいかないなら中1 過去形を確認)
- 高1 仮定法完成 → 中3 仮定法基礎 (中3 基礎ができてないと高1 完成は無理)
- 高1 動名詞 vs 不定詞 → 中2 不定詞 / 中2 動名詞 (= 高1 でつまずいたら中2 にまで遡及)

これは C1「学年を超える遡及」確定論点の具体実装。

### 画面動線

1. `/tutor` メニュー右側 (教材とプランの間) に **「カリキュラム」ボタン** (C67)
2. クリックで `/curriculum?subject=english` 遷移 (C66)
3. 画面構成:
   - Header (タイトル + 説明 + 「← ゆいに戻る」リンク)
   - Legend (5 色の凡例 + 黄/赤の意味説明)
   - Matrix:
     - 学年別ブロック (文法 / 語彙 × 6 学年 マトリックス)
     - 学年区分なしブロック (読解 / 聴解 / 作文 / 会話 を 4 グリッドで横並び)
   - Footer (仮実装の注意書き + 野球コーチアナロジー + 戻り誘導フロー説明)
4. ノードホバーで description ツールチップ表示

### 既存 MOCK_TREE との関係

- 既存 `MOCK_TREE` (教材ベースの極小範囲、英語/不定詞のみ) は **C2 確定で廃止予定**
- 当面は **並走** = 既存 `/learn` は MOCK_TREE 維持、新 `/curriculum` だけ新 mock 使用
- Phase 5 解体時に旧 MOCK_TREE を完全廃止、本仮実装を本格 DB に置き換え

### 残課題 (= カリキュラム DB grill 未確定 #2 で詰める論点)

1. **ノード粒度の判断** — 「不定詞 3 用法」を 1 ノードにするか「不定詞-名詞的」「不定詞-形容詞的」「不定詞-副詞的」と 3 分割するか (現状は 1 ノード)
2. **状態遷移ロジック** — テスト誤答何問で in-progress → weak-detected か / ヒアリング何回で weak-detected → weak-confirmed か / 復帰判定 (F6 ミニテスト 80% 以上) との連携
3. **AI つまずき認定のスキーム** — F4 AI 主導ヒアリング + 確認テストの結果から状態を自動更新するロジック (= Phase 6 Claude API 拡大と連動)
4. **個別ノード詳細画面** — クリックで「葵 chat / 関連教材 / ヒアリング履歴 / 再学習プラン提案」表示する? 現状はホバーツールチップのみ
5. **再学習プラン生成** — weak-confirmed (赤) になったらゆいから「ここから戻りませんか」発話 → 親と本人の納得を経て LearningPlan に SI 自動追加 (= F5 戻り誘導 + D2-1 OPT-OUT 親承認との統合実装)
6. **科目拡張** — 数/国/理/社 のカリキュラム DB (= MVP は英語のみだが、5 教科ハードコード S2/S9 と整合させる必要)
7. **カリキュラム源の信頼性** — 「小〜高の全カリキュラムを事前に AI が検索して用意」(C3) の具体方法 = Claude に検索依頼? 手動メンテ? 教科書ベース?
8. **進捗 % の集計** — 各分野 / 各学年でどれだけ mastered か可視化 (現状は色分けで個別表示のみ)
9. **親への共有 UI** — 体系図の現状を親にどう見せるか (D3 弱点絶対親共有 + A4 親⇄ゆい対話)
10. **戻り誘導の連鎖** — F6 細部 (3): 連鎖遡及最大 2 学年 → 体系図上で「中3 → 中1」までは OK だが「中3 → 小5」は親に専門家相談提案 = ノードに学年タグを使ったロジック

### 2026-05-28 後段: 教材ベース回帰 + 読まれていない範囲フォロー (C2/C3 撤回)

C68 (カリキュラム DB 仮実装 SSoT 同期) push 後、ito19 さんから本セクションのカリキュラム DB スキーム自体への **根本的な見直し** を提示:

> 公的カリキュラム / ウェブ公開データから体系図を作成するのは無理。中学受験 / 塾教材 / 学校テキストでカリキュラムが大幅に異なる、特に中学受験は学習指導要領を大幅超過するため。体系図は **読み込んだ教材から作る** しかない (= 当初 Phase 5 / 既存 Phase 6F 設計に回帰)。読まれていないテキスト範囲は **AI が「○○の学習が不足」と検出 → 推奨テキスト提案 → 親承認** で補完する。

これは grill 第 1-16 で確定していた **C2 (教材ノード生成廃止) + C3 (小〜高カリキュラム事前 DB) を撤回** + **新方針確定** にあたる。同セッション中に追加 grill ナシで即確定 (= ito19 さんの最終判断、議論で詰めるレベルではなく根本判断)。

#### 撤回 + 新方針

| # | 撤回された旧確定 | 新確定 |
|---|---|---|
| C2 | 教材アップロードから体系図ノードを作る方式を **廃止** | 教材アップロードから体系図を作る (= 当初設計に回帰、葵先生による教材読み込み + テキスト忠実体系図 + 評価コメント、2026-05-25 grill 1 確定 8/10/11 が本流に戻る) |
| C3 | 小〜高の全カリキュラムを事前に AI が検索して用意 | カリキュラム DB は持たない、教材ベースのみ |

#### 新 grill 論点 (G1-G5) — 次セッション以降

| # | 論点 |
|---|---|
| **G1** | 教材ベース体系図の **学年/分野マッピング** = 教材から葵 AI が抽出したノードを「何学年・何分野」にマップするロジック |
| **G2** | **「読まれていない範囲」検出ロジック** = AI がつまずき遡及時に「この範囲の教材が未登録」と判定するスキーム |
| **G3** | **推奨テキスト提案** = AI が「中1 ○○テキスト推奨」発話、ソース = Claude の事前知識 / 別途検索 / 教科書出版社情報 等 (= 旧 C3 のミニ版に近い、ただし「全カリキュラム DB」ではなく「個別教材推薦」) |
| **G4** | **親承認フロー** = 推奨テキストの購入/取得を親が OPT-OUT 承認 (= D2-1 と同型) |
| **G5** | **体系図の集約表示 UI** = C66 マトリックスを再目的化 (b 案)、データ源を教材ベースに切替 + 未登録範囲は「推奨テキスト提案カード」表示 |

#### 既存 Phase 5 / Phase 6F 設計が **本流に戻る**

| 領域 | 状態 |
|---|---|
| 教材セクション (C28-C54) MaterialEditWizard / MaterialDetailView / 体系図フローチャート | ✅ 生きる、本流 |
| 旧 MOCK_TREE (英語/不定詞、教材ベース) | ✅ 生きる、後で本格教材ベース DB に統合 |
| 葵先生による教材体系図生成 (旧 Phase 5 / Phase 6F 主役) | ✅ 復活、Phase 6 で本格実装する筆頭候補 |
| 教材ごと独立葵 chat スレッド (2026-05-25 grill 1 確定 12) | ✅ 復活 |

#### C66 仮実装の扱い = **(b) 再目的化** (ito19 さん 2026-05-28 確定)

C66 の `/curriculum` 画面 (マトリックス + 5 色凡例 + Footer) は **削除せず流用**:
- 画面構造 (分野 × 学年マトリックス + 5 状態色分け) は教材ベースでも使える
- データ源 = 現状 `MOCK_CURRICULUM_EN` (= Claude 事前知識で作った仮データ) → **教材から葵 AI が抽出したノードに切替予定**
- 教材未登録セル = 「**ここの教材未登録、推奨テキストあり**」エリア (G2/G3/G4 と直結)
- 5 状態色分けはそのまま使える (未学習 / 学習中 / 完了 / AI つまずき認定 / 戻り誘導候補)
- データ源切替の本実装は Phase 5 解体プラン確定後

#### Phase 5 解体プランへの影響

| 領域 | 解体方向 (2026-05-27 確定) | 再決定 (2026-05-28 後段) |
|---|---|---|
| ノード源 | 小〜高カリキュラム事前 DB | 教材ベースに回帰 |
| 体系図 | カリキュラム DB マトリックス | 教材ごと体系図 (旧 Phase 5 設計) + 集約マトリックス (C66 再目的化) |
| 葵先生役割 | 受動的補助 (A7、教材読み込みは廃止) | A7 受動的補助 + **教材読み込み + 体系図生成** (旧設計復活) |
| つまずき遡及 | カリキュラム DB 全体での学年超え遡及 | 教材ベース体系図内 + 教材外は推奨テキスト提案 (新メカニズム) |

→ Phase 5 解体の方向性は変わるが、**既存実装 (C28-C54 教材セクション) が活きる** ぶん解体規模は **縮小** する。

#### SSoT 整合の状態

- 本セクション (## カリキュラム DB 仮実装) は **方針撤回済、再目的化方針** で残置
- 既存 grill 確定論点 C2/C3 は **撤回済**、本セクションへのリンクで明示
- 新方針 G1-G5 は **次セッション以降の grill 論点** として残り 5 論点 (PlanType / 系統可視性 / 時間予算 / 統合管制 / 既存 #2 カリキュラム DB 運用) と並列で扱う (#2 は新方針による再フレーミング)

### Phase 6 教材体系図 AI 抽出 (C70-C72、2026-05-28)

C69 で C2/C3 撤回 + 教材ベース体系図回帰確定 → ito19 さん「教材を実際取り込み、体系図を作るまで AI に処理させたらどういう風になるか見てみたい」要望 → **既存 MaterialEditWizard / Step2Extraction (固定 12 ノード mock) を実際の Claude Opus 4.8 で置換する Step A 実装** を着手。

#### 実装内容

| # | SHA | 内容 |
|---|---|---|
| **C70** | `8064b06` | feat: 教材体系図 AI 抽出 Server Action `extract-claude.ts` 新設 — 葵 (あおい) 先生 persona の system prompt (PHILOSOPHY.md 全文埋め込み + テキスト忠実規律 + 監修なし規律) + 教材メタを Claude Opus 4.8 に渡して JSON 体系図抽出 + `Omit<AiExtractedNode, "matchedNodeId">[]` 返却 |
| **C71** | `acbf9ec` | feat: MaterialEditWizard で Claude API flag 分岐 + async 化 — mock-extraction.ts の照合ロジックを `matchToExistingNodes` として export 切り出し / MaterialEditWizard.handleExtractionDone を async + `NEXT_PUBLIC_USE_CLAUDE_API` flag 分岐 + try/catch で mock fallback / Step2Extraction に `isExtracting` + `extractionError` prop 追加 + ボタン 3 状態ローディング (「葵が抽出中…」「保存に進む」「解析中…」) |
| **C72** | (本 commit) | docs: Phase 6 教材体系図 AI 抽出 SSoT 同期 (本セクション追記 + SESSION_HANDOFF + memory) |

#### Step 段階分け

| Step | 内容 | 実装段階 |
|---|---|---|
| **Step A** | 教材メタ (name / subject / grade / label) のみで Claude 推測 | ✅ C70-C72 実装済 |
| Step B | PDF.js でブラウザ側テキスト抽出 → Claude にテキスト渡す | (検討中、Step C 優先かも) |
| Step C | PDF を base64 で Claude native PDF support に渡す (= 「実際の教材取り込み」感最大) | 将来 |

#### 動作の前提 env

- `AI_EDU_ANTHROPIC_API_KEY`: Anthropic API key (Phase 6 smoke test C56 と同じ env、親 harness `ANTHROPIC_API_KEY=""` injection 衝突回避)
- `NEXT_PUBLIC_USE_CLAUDE_API=true`: feature flag (false / 未設定で既存 mock fallback)
- 上記は `web/.env.local` に設定、dev server 再起動必須 (Next.js は env hot reload しない)

#### Phase 6 smoke test との関係

- C56 smoke test (= 「計画立てよう」ゆい入口 1 発話) と同じパターンを踏襲:
  - 同じ env (`AI_EDU_ANTHROPIC_API_KEY`)、同じモデル (`claude-opus-4-8`)
  - 同じ feature flag (`NEXT_PUBLIC_USE_CLAUDE_API`)
  - 失敗時 mock fallback で動線止めない規律
- C56 = ゆい (担任) の発話 1 つ、C70-C72 = 葵 (教科の先生) の構造化出力
- 同じ Phase 6 拡大の **F 案** (葵先生先行: 教材 PDF → 体系図 + 評価コメント) の Step A 実装

#### Claude プロンプト設計

- system: 葵 persona + PHILOSOPHY.md 全文 + テキスト忠実規律 + 監修なし規律 (ephemeral cache、再利用)
- user: 教材メタ (name / subject / grade / label) + 出力要求 (JSON 配列 3-4 階層 10-15 ノード)
- 出力: pure JSON 配列 (Claude が説明文付けても [...] 部分だけ切り出して parse する保険ロジック実装済)

#### 次の段階

- 動作確認 (ito19 さん dev server で実際に教材登録 → Claude 抽出を見る)
- Claude 応答のプロンプト調整 (= 不適切な構造 / 用語のフィードバック)
- Step C 拡張 (PDF native 解析、別セッション)
- G1: 教材ベース体系図の学年/分野マッピング → Step A の JSON 出力に学年/分野タグ追加で C66 マトリックスに乗せる
- G2: 「読まれていない範囲」検出ロジック → 抽出ノードと C66 マトリックスの学年/分野範囲を比較
- F4 AI 主導ヒアリング (= 葵 chat の本格化) との統合は別段階

#### Phase 5 解体プランへの影響

- 教材ベース回帰により C28-C54 教材セクションが本流復活 (C69 で確定)
- 本実装で「葵先生による教材体系図生成」が動く状態 → Phase 5 解体プラン設計時に「教材 → 体系図 → 学習プラン」の動線を mock ベース→実 Claude API ベースで設計可能
- mockExtractNodes は flag=false 時のフォールバックとして残置

### Phase 6 拡大: ゆい / 葵 全体 Claude 化 (C73-C76、2026-06-04)

C72 push 後、ito19 さん「Claude が入らないとイメージがつかない、入れられるところは全部入れて」要望 → **A (ゆい全発話) + B1 (葵 chat) + B2 (課題 chat) + B3 (葵評価コメント)** を Claude Opus 4.8 で実装。

#### 実装内容

| # | SHA | 内容 |
|---|---|---|
| **C73** | `b649279` | feat: ゆい Claude 共通基盤 + シーン汎用化で A1-A5 全発話 Claude 化 — tutor-claude.ts に `tutorClaudeRespondToScene` (シーン識別子 + sceneContext + fallbackText + userInput) 新設 + tutor-mock.ts の `buildNextTutorReplyAsync` 拡張 (= 同期で reply 構造 → シーン推定 → Claude で text のみ post-process) + `inferSceneFromResult` (計画立案 / 帰宅儀式 / ending / 朝振り返り の state 遷移網羅) + `buildSceneContext` (各シーン固有 context 構築) |
| **C74** | `d4c2df4` | feat: 葵先生 教材評価コメント Claude 化 (B3) — lib/admin/review-claude.ts (Server Action `generateMaterialReviewViaClaude`、葵 persona + 2 レイヤ規律) + MaterialDetailView の aoiReview を useEffect Claude ロードに改修 |
| **C75** | `405385e` | feat: 葵 chat 本実装 (B1、教材ごと独立スレッド + Claude 応答) — lib/admin/aoki-chat-claude.ts (`respondViaAokiChat`、教材文脈 + フォーカスノード名 + chat 履歴 + ユーザー発話) + MaterialDetailView の placeholder/disabled を本実装 (履歴表示 + Ctrl+Enter 送信 + 教材切替で chat クリア) |
| **C76** | `6f4b48a` | feat: 課題 chat (IssueChat) を Claude 化 (B2) — lib/learn/issue-chat-claude.ts (`issueChatRespondViaClaude`、科目の先生 persona) + issue-chat-mock.ts に `buildNextIssueChatReplyAsync` (同期版 post-process) + IssueChat.tsx を async 化 (resolve シグナル + quickReplies は維持) |

#### A 部 (ゆい全発話) のシーン網羅

C73 で `inferSceneFromResult` が以下の全 state 遷移を網羅:

| シーン群 | シーン識別子 |
|---|---|
| 計画立案フロー (A1) | plan-after-subject / plan-after-material / plan-after-duration / plan-after-weak-nodes / plan-confirm / replan-accept |
| 帰宅儀式 第 1 部 (A2) | evening-start / evening-period-ask-subject / evening-period-ask-content / evening-period-done / evening-school-summary |
| 帰宅儀式 第 2 部 (A2) | evening-show-schedule / evening-await-task-text / evening-await-more-tasks / evening-finalize |
| ending mode 学習終了 (A2) | ending-vent / ending-confirm / ending-done |
| 朝振り返り (A2、D5 廃止 flag off 時は使われない) | reflection-school / reflection-mood / reflection-questions / reflection-excavation / reflection-plan |

各シーンで context (科目名 / 教材名 / 期間 / 件数 / 時限数 等) を ID から名前に展開して JSON 化、Claude が「fallback text + context + 新方針指示」で自然に応答。

#### B 部 (葵: 教科の先生) の Claude 化

| 機能 | Claude 化済 | 場所 |
|---|---|---|
| 体系図抽出 (B-extract) | ✅ C70-C72 | MaterialEditWizard / Step2 |
| 評価コメント (B3) | ✅ C74 | MaterialDetailView |
| 葵 chat (B1) | ✅ C75 | MaterialDetailView |
| 課題 chat (B2) | ✅ C76 | IssueChat |
| PDF Step C (B4) | ❌ 未着手 | 別セッション |

#### D2-5 親通知の透明性 (= 新 PHILOSOPHY 整合)

C73 の system prompt に「計画立案完了 / Replan 完了等の場面で『お母さん・お父さんにも伝えたよ ✉️ + 24h 異議窓口』相当文を含める」指示を埋め込み。
C62 で固定 mock 文として追加した内容が、Claude 経由で動的に各シーン応答に自然に織り込まれる。

#### 動作確認時の注意

- `web/.env.local` で `AI_EDU_ANTHROPIC_API_KEY` + `NEXT_PUBLIC_USE_CLAUDE_API=true` 設定
- dev server 再起動必須 (Next.js env hot reload しない)
- 各 Claude 呼び出しは 5-15 秒待ち (Opus 4.8 max_tokens 600-1500)
- 失敗時はそのシーンのみ mock 維持 = 動線止まらない

#### 残し (= 次セッション以降の Claude 化候補)

| 機能 | 内容 | 規模 |
|---|---|---|
| **B4** PDF Step C | PDF を base64 で Claude native PDF support に渡す = 「実際の教材取り込み」感最大 | 大 |
| **C4** WeakNodes / NodeReviewSuggestion 自動判定 | NodeComprehension 低下検出 + AI 自動判定で suggestion 生成 | 中 |
| **C1** F4 AI 主導ヒアリング (誤答発見) | テスト誤答多 / ヒアリングで曖昧 → AI が「ここ怪しい」判定 | 大 |
| **C2** F5 戻り誘導 (AI + 親 OPT-OUT) | weak-confirmed ノード → 戻り学習 SI 自動生成 + 親通知 + 24h 異議窓口 | 大 |
| **C3** 試験前モード (E1-E9) | 状態モデル + 3 周 × 重点変化 + 試験範囲入力 + 試験後コーチング駆動振り返り | 特大 |
| **C5** F1 内部 3 分類 (サボリ / 誤答 / お休み) | 子供 UI ラベル + 内部判定 + carry-over | 中 |
| **D1-D4** 親 chat / 24h 異議窓口バナー / ゆい仲介コーチング / F3 carry-over 3 日連続検知 | 親アカウント UI 新ペイン + 連動ロジック | 特大 |

#### Phase 5 解体プランへの影響

- A 部 Claude 化により、ゆいの発話品質が全フローで Claude Opus 4.8 になる = mock → 実 AI への移行完了 (構造は維持)
- B 部 Claude 化により、葵 (教科の先生) との対話・評価コメント・体系図抽出すべて実 Claude に
- 次は C 部 (F4/F5/試験前/F1) と D 部 (親 chat) = 設計確定済の **新規機能実装** に進むフェーズ

---

## PDF メタ自動検知 + 教材本文理解システム grill (2026-06-04)

C73-C78 で「入れられる所は全部 Claude 化」した後、ito19 さんが実際に教材登録を試して発見した課題から派生した設計 + 実装。

### PDF メタ自動検知 (C81、grill 確定 + 実装済)

**課題**: 教材登録ウィザード Step1 が、教材名・科目・種別・学年を**先に手入力**させる UX。ito19 さん「先に手入力するのは面倒、PDF を入れたら AI が自動検知してほしい」。

**技術制約**: アップロードされた PDF が 186.90 MB と巨大で、Claude の PDF 直接読み込み上限 (~32MB) を超える。

**grill 確定 6 点**:
| # | 確定 |
|---|---|
| 1 | 読み取り方式 = 186MB 全文は渡さず、ブラウザ (pdf.js) で先頭3+末尾2ページのテキスト抽出 → Claude に渡す (教材名/科目/学年/種別は表紙・奥付に集中) |
| 2 | 確認ありの自動入力 = AI が 4 項目を埋め、入力欄は残して人が確認・修正 |
| 3 | トリガー = PDF を最上部に置き、アップロードした瞬間に自動検知開始 (「📖 AI が表紙を読んでいます…」表示) |
| 4 | 部分フォールバック = 取れた項目だけ埋め、取れない/失敗項目は空欄手入力。スキャン PDF / API 失敗でも動線止めない |
| 5 | 曖昧マッピング = 確信ある項目だけ埋め、決め打ちできない項目 (大学受験参考書の学年等) は空欄。3 択で最も近いもの (参考書→テキスト) は選ぶ |
| 6 | 教材名 = 表紙タイトル優先 + 奥付から出版社が分かれば「(出版社名)」を添える |

**実装ファイル**:
- `web/lib/admin/pdf-extract-text.ts` (新規、client): pdf.js で先頭3+末尾2ページ抽出。worker は `public/pdf.worker.min.mjs`、動的 import で SSR 回避
- `web/lib/admin/detect-meta-claude.ts` (新規、Server Action): 抽出テキスト+選択肢から Claude Opus 4.8 で 4 項目判定、確信なき項目は null に正規化
- `Step1MetaAndUpload.tsx`: カード反転 (PDF を最上部) + アップロード即検知 + 検知中/結果メッセージ
- `proxy.ts`: pdf.js worker (.mjs/.js) を認証 matcher から除外 (静的配信のため、未認証だと login HTML が返り worker が読めなかった)

### 教材一覧 in-memory 反映 (C82、残課題② 解消)

教材登録ウィザードで保存しても教材一覧 (MaterialsListPane) に出ない問題を解消。Step4Save が draft+extracted から Material を構築 → TutorWorkspace.handleMaterialAdded が materials state に push → 一覧・詳細に反映 (旧: MOCK_MATERIALS[0] 固定表示)。リロードで消える点は Phase 7 永続化で対応。

### 教材本文理解システム (葵ティーチング基盤) grill (2026-06-04、★未実装★)

**問題認識**: ito19 さん指摘「ティーチング (葵) には読み取ったテキストの内容を AI が理解しないといけない。今それで進んでいるか?」→ **進んでいない**。現状、葵の体系図・評価コメント・葵 chat はすべて教材名からの**推測**で、本文を 1 文字も読んでいない (証拠: 真英文法大全の体系図が 4 ノードしかない)。PHILOSOPHY のティーチングの土台「教材内容の理解」が欠落している = 最大の欠落。

**解決方向 = RAG (取り込み・索引化・検索)**。教材登録時に本文を取り込んで保存し、葵が答える時に関連箇所を引いて Claude に渡す。

**grill 確定 6 点**:
| # | 確定 |
|---|---|
| 1 | 取り込み結果を Supabase に保存 (Phase 7 永続化に踏み込む) |
| 2 | 図解対応 = テキストだけでは図・表・イラストが落ちる (ito19 さん指摘)。葵にページを**画像/PDF として見せる** (Claude vision)。元 PDF を保存し、回答時に該当ページを切り出して渡す |
| 3 | 検索 2 タイプ両対応: ①場所指定型 (「このテキストのここ」) = 単元→ページの直接マッピング (外部 API 不要) / ②横断検索型 (「これどこかに説明ある?」) = ベクトル検索 (embedding 外部 API) |
| 4 | 取り込みはバックグラウンド処理 + 完了通知 (数千ページで数分かかる) |
| 5 | 2 段階実装 (下記) |
| 6 | ① が子供のメイン動線 (場所を指定してくる)、② は横断検索用 (ito19 さん指摘で ①② を分離) |

**2 段階実装**:
- **段階 1**: 取り込み基盤 + **本物の体系図** (真英文法大全の実単元・ページ範囲) + **葵 chat 場所指定型** (単元を選んで「ここ説明して」→ そのページ画像を葵が見て答える)。embedding/ベクトル DB 不要 ← まずここで「4 ノード推測体系図」「中身を読まない葵」が実物ベースに変わる = 価値の大部分
- **段階 2**: **横断検索型** (embedding/ベクトル検索) + **評価コメントの本文ベース化**

**未決事項 (実装時 or 別 grill)**:
- スキャン PDF (画像のみ、テキスト抽出不可) の OCR 要否
- 印刷ページ番号 vs PDF 物理ページのズレ (子供に「42 ページ見て」と伝える時。内部の text⇄画像一致はズレない = 同じ pdf.js ページから両方取るため)
- 元 PDF (186MB) の Supabase Storage アップロード方法・容量・コスト
- embedding モデル選定 (OpenAI / Voyage 等)、ベクトル検索精度
- 単元ごとのページ範囲を AI がどう正確に特定するか
- バックグラウンド処理の実装方式 (Supabase Edge Function 等)

### 段階1-B 教材・PDF 永続化 (2026-06-05、実装済み)

段階1-A (本物の体系図) + 段階1-C (読書ビュー) は in-memory だったため、リロードで教材・体系図・PDF が消えていた。1-B でこの最小チェーン (教材 + 体系図ノード + 元 PDF) を Supabase に永続化し、**リロード／別セッションでも読書ビューが成立**するようにした。

**grill 確定 (2026-06-05、7 点)**:
| # | 確定 |
|---|---|
| 1 | スコープ = 教材 + 体系図ノード + 元 PDF のみ (葵 chat 履歴・科目は今回外す) |
| 2 | 持ち主 = `materials.owner_id` (娘さん)。本人は自分の分・admin は全部。既存 `profiles` RLS パターン踏襲 |
| 3 | PDF = Supabase **Pro 化**。186MB はブラウザから Storage へ**直接 (TUS 再開可能) アップロード** (Server Action 経由は不可) |
| 4 | テーブル = `materials` 1 つ。体系図ノードは **JSONB 列**、PDF は Storage (`pdf_path`/`pdf_size`) |
| 5 | 保存 = **行は即作成** (一覧/体系図は即表示)、**PDF は裏でアップロード + 完了通知**。`session-pdf-store` は L1 キャッシュとして温存 |
| 6 | 読込 = 本番は DB 取得 (最初は空)、`MOCK_MATERIALS` は mock モード専用フォールバックへ。読書ビューは メモリ→無ければ Storage DL→キャッシュ |
| 7 | 削除 = 行は論理削除 (`deleted_at`) で残し、PDF 実体は Storage から削除 (コスト優先) |

**実装ファイル**:
- `supabase/migrations/20260605000000_init_materials.sql` (新規): `materials` テーブル + RLS (`profiles` の `current_user_role()`/`touch_updated_at()` 再利用) + private バケット `material-pdfs` (file_size_limit 256MB) + Storage RLS (先頭フォルダ=owner_id で本人/admin)
- `web/lib/materials/materials-repo.ts` (新規): `fetchMaterials` / `insertMaterial` / `updateMaterialPdfPath` / `softDeleteMaterial` / `updateMaterialMeta` / `getCurrentUserId`、DB 行⇔Material 変換。browser client + RLS
- `web/lib/materials/pdf-storage.ts` (新規): `uploadMaterialPdf` (tus-js-client、chunk 6MB 固定、`${ownerId}/${materialId}.pdf`) / `downloadMaterialPdf` / `removeMaterialPdf`
- `web/lib/materials/is-supabase-configured.ts` (新規): real/mock 判定 (`NEXT_PUBLIC_SUPABASE_URL` の有無、空文字注入も mock 扱い)
- `web/lib/learn/types.ts`: `Material` に `pdfPath?` / `pdfSize?` 追加
- `web/components/tutor/TutorWorkspace.tsx`: materials 初期化を real=DB fetch / mock=MOCK_MATERIALS、`handleMaterialAdded` (行即作成→裏アップロード→完了通知、失敗時 in-memory フォールバック)、`handleMaterialDeleted` (論理削除 + Storage 削除)
- `web/components/materials/MaterialReadPane.tsx`: PDF ロードに Storage フォールバック (session-pdf-store→無ければ `pdfPath` から DL→L1 キャッシュ) + 「PDF を読み込み中…」表示
- 温存: `session-pdf-store.ts` (L1 キャッシュ) / `MOCK_MATERIALS` (mock フォールバック) / `Step4Save.tsx` (温存。real モードでは親 `handleMaterialAdded` が DB 採番 id で再構築)

**運用前提 (手動)**: Supabase を Pro へアップグレード + マイグレーション適用 (バケット作成・file size limit 256MB 含む) + `.env.local` に Supabase URL/ANON_KEY。娘さんアカウントでログイン。**未設定なら自動的に従来の mock モード**で動く (デモ 3 件、リロードで消える)。

**残課題 (将来)**: 親アカウントが娘さんの教材を登録する時の owner 指定 UX / アップロード中リロード時の「PDF 準備中」表示 / TUS 失敗時の再試行 UI / 葵 chat 履歴・科目の永続化 (段階2 以降)。

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
| `/tutor?view=today-tasks` | **右ペインに今日のタスクダッシュボード** (Phase 5 P5-Q7 で `view=schedule` からリネーム)。SI[] 一覧 + [開始] /learn 遷移 + 進捗 N/M + 全 done CTA | Phase 5 |
| `/tutor?view=history` | 右ペインに学習履歴 | Phase 3 |
| `/tutor?view=material-new` | 右ペインに新規教材登録ウィザード（`MaterialEditWizard` を embed） | Phase 3 (※ 2026-05-25 grill で 3 step 化予定、本書「## 教材アップロード設計 (2026-05-25 grill)」参照) |
| `/tutor?view=material-detail&id=xxx` | **右ペインに教材詳細ページ** (体系図 + 葵評価コメント + 教材ごと独立葵 chat、本書「## 教材アップロード設計 (2026-05-25 grill)」参照) | Phase 6 (新規追加予定) |
| `/tutor?view=subjects` | **右ペインに科目設定パネル** (`SubjectSettingsPanel`、ハードコード 5 教科一覧 + 手動追加フォーム、本書「## 科目追加設計 (2026-05-25 grill)」参照) | Phase 6/7 (新規追加予定) |
| `/tutor?view=subject-history&subjectId=xxx` | 右ペインに科目の先生との対話履歴ビュー（ノード対話 + 課題 chat の時系列集約）| Phase 3 |
| `/tutor?view=tutor-archive` | **右ペインにゆい先生対話アーカイブ**（日付セレクター + 話題フィルター、readonly） | ✓ Phase 3 中盤 |
| `/tutor?view=tutor-archive&date=YYYY-MM-DD` | 上記で特定日を即表示（検索結果カードからのジャンプ） | ✓ Phase 3 中盤 |
| `/tutor?view=reflections` | **右ペインに振り返りログ一覧**（cadence フィルタ、派生リンク表示、readonly） | ✓ Phase 3 レビュー追従 C4 |
| `/tutor?view=plan-new` | **右ペインに計画立案 (chat + カードハイブリッド)**: subject-picker → material-picker → duration-picker → **weak-node-picker (P5-Q2)** → roadmap-preview | Phase 4 + 5 |
| `/tutor?view=plans` | **Plan Engine ダッシュボード** (P5-Q6): 左サイドに LearningPlan[] 一覧 + 右パネルに詳細 (概要/全期間ロードマップ/weakNodes/pending Suggestion + Interrupt/PlanRevision 履歴) | Phase 5 |
| `/tutor?view=weekly-report` | **右ペインに週次レポート** (4 セクション、月末週は + 月次 + 来月計画) | Phase 4 |
| `/tutor?view=monthly-report` | **右ペインに月次レポート単独ビュー** (週次から抽出して見るバックアップ動線) | Phase 4 |
| `/tutor` 帰宅モード | **平日 16:00 以降の初回アクセスで自動起動**、第 1 部 学校レポート → 第 2 部 スケジュール確定 | Phase 4 |
| `/tutor?ending=1` | **学習終了振り返り (ending) モードでゆい起動**（`/learn` の「学習を終了」ボタンから） | ✓ Phase 3 中盤 |
| `/today-tasks` | 今日のタスク ダッシュボード（バックアップ動線、`/tutor?view=today-tasks` と同 `TodayTaskDashboard` コンポーネント）。P5-Q7 で `/schedule` からリネーム | Phase 5 (旧 Phase 1 `/schedule`) |
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

  // === Phase 4 追加 (帰宅儀式 + 突発タスク + 月次バッチ source 識別) ===
  tags?: string[]                              // 自由タグ「宿題」「提出物」「テスト範囲」「親」等
  source: "plan" | "carry-over" | "ad-hoc"
    // plan       = LearningPlan 月次バッチ展開
    // carry-over = 前日積み残し
    // ad-hoc     = 帰宅儀式で当日追加された突発タスク
}

ExamPrep      { id, subjectId, name, examDate, scopeNodeIds[], pageRangeNote?, ... }
Homework      { id, subjectId, name, dueDate, materialIds[], amountNote? }
LessonReview  { id, subjectId, lessonDate, topic, nodeIds[] }

// LearningPlan / PlanSegment / SchoolDailyReport / PeriodEntry の詳細は
// 上記「Phase 4: 中学生向け設計軌道修正」セクション参照。
// ReflectionLog は Phase 4 で schoolToday を撤去 (SchoolDailyReport に移行)、
// cadence: weekly/monthly は WeeklyMonthlyReport (4 セクション) を保持する形に再定義。
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
// Phase 3 では 5 セクション、Phase 4 で schoolToday を撤去 → 4 セクションに縮退。
// cadence: weekly/monthly は Phase 4 で WeeklyMonthlyReport (4 セクション) を保持する形に再定義。
// 詳細は上記「Phase 4: 中学生向け設計軌道修正」セクション参照。
ReflectionLog {
  id, learnerId
  date           // YYYY-MM-DD
  cadence: "daily" | "weekly" | "monthly"

  // === Phase 3: 5 セクション → Phase 4: 4 セクション (schoolToday 撤去) ===
  yesterdayReview?        // 昨日の学習レビュー
  schoolToday?            // ★Phase 4 で撤去 (帰宅儀式の SchoolDailyReport に移行)
  emotionsAndEvents?      // 起きたこと、気分
  questionsAndDoubts?     // 疑問・不安・「先生の言ってる意味分からない」
  todayPlan?              // 今日の計画

  // === Phase 4 追加 (cadence: weekly/monthly) ===
  weeklyMonthlyReport?    // 4 セクション (達成度 / 学校 / 弱いところ / 来週計画+Action)
                          //   月末週は + 月次達成度 + 来月計画 + 修正プラン draft

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
| **Phase 3 (構造)** | /tutor 2 ペイン司令室化 + 課題 chat 統合 + ゆいハブカード | ✓ 完了 |
| **Phase 3 拡張: コーチング設計** | ゆいを純粋コーチング エージェントに進化（下記 Phase 3 拡張スコープ 3a〜3g 参照） | 3a-3b + 拡張機能 多数 ✓、3c-3g 残 |
| **Phase 3 中盤の追加機能** | 1 日 1 chat 永続化 + 話題セクション + アーカイブ + 検索 + セッション pause/resume + 3 状態タイマー + ending dialogue（上記「Phase 3 中盤の実装スナップショット」参照） | ✓ 完了 |
| **Phase 3.5** | 学習開始の儀式 + 経過時間計測 + 離席検知 + 終了儀式（下記 Phase 3.5 スコープ参照） | 中盤の追加機能で部分実装済 (auto-pause / ending dialogue / 3 状態タイマー)、残りは next |
| **Phase 4** | **中学生向け設計軌道修正 (2026-05-25 grill)**: LearningPlan + 帰宅儀式 (2 部構成) + SchoolDailyReport + 週次/月次レポート (4 セクション) + 達成バッジ + 親共有 (本人同意制)。**既存 Phase 4 (宿題タスク) と旧 Phase 5 (授業の新しい学び) は本 Phase に統合** | ✓ 完了 (C7-C13、2026-05-25) |
| **Phase 5** | **学習戦略エンジン (2026-05-25 grill)**: 4 軸分離 (Plan Type / Mode / Resource / Node) + GeneratedTask × ScheduleItem 並走 + WeakNodes 半自動 + Replan Engine (3 トリガー) + NodeReviewSuggestion 即時 accept + Plan Engine ダッシュボード + 今日のタスクルート整理 | ✓ 一旦完了 (C14 試作 + C15-C24、2026-05-25)。**2026-05-27: 学習プラン再設計 grill により骨格を解体・再構築方向** (本書「## 学習プラン再設計 grill (2026-05-27)」セクション参照: 長期計画→1 ヶ月更新、学校/塾の二系統、教材ノード生成廃止 → 小〜高カリキュラム事前 DB 等) |
| **Phase 6** | Claude API 接続、scripted mock を本物の対話に置換、コンテキスト圧縮（rolling summary / prompt cache）、ゆいによるサマリー読み込み、**葵先生による教材読み込み (体系図 + 評価コメント、本書「## 教材アップロード設計 (2026-05-25 grill)」参照)**、教材詳細ページ + 教材ごと独立 chat、WeakNodes 自動判定の AI 化、`MaterialEditWizard` の 3 step 化 (監修ステップ撤去) | **smoke test 着手済 (2026-05-26 C56、本書「## Phase 6: Claude API 接続」参照)**: 「計画立てよう」入口 1 発話のみ Opus 4.8 化、Server Action + feature flag + mock fallback、TUTOR-ROLE + PHILOSOPHY 全文 system prompt、`AI_EDU_ANTHROPIC_API_KEY` で親 harness env 衝突回避。**2026-05-27: Phase 6 拡大 A-G grill は着手前にプロジェクト前提から見直し方向に転換** (本書「## 学習プラン再設計 grill (2026-05-27)」セクション参照、PHILOSOPHY 全書き換え C58 = コーチング・ファースト型へ) |
| **Phase 7** | Supabase スキーマ + mock → 永続化 (LearningPlan / SchoolDailyReport / ScheduleItem 拡張 / GeneratedTask / バッジ等含む) | 未着手 |
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

> **2026-05-25 grill 追記**: 本セクションは Phase 3 時点の動線設計。教材アップロード全体の設計 (主体 / AI 役割 / 葵の出力構造 / 動線 / 監修廃止 等の 13 確定) は別途まとめてある → **本書「## 教材アップロード設計 (2026-05-25 grill)」** を参照。本セクションの「担当 AI = ゆい先生が全部担当」は **撤回**: 確定 8 により **教材を読むのは葵先生**、ゆいは入口/出口のみ。

| 論点 | 確定 |
|---|---|
| 対象ユーザー | **両方で同じフロー**（権限区別なし、学習者も教材追加できる）|
| 担当 AI | ~~**ゆい先生が全部担当**~~ → **2026-05-25 grill 確定 8 で撤回**: 教材を読むのは葵先生 (科目の先生)、ゆいは入口/出口のみ |
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
| 科目の先生 persona | `Subject.teacher: SubjectTeacher` で固有名 / アバター / サブタイトルを保持。MVP は **あおい先生（英語）** のみ (※ 2026-05-25 追加 grill 2 で **主要 5 教科ハードコード展開** + 手動追加経路を設計確定、本書「## 科目追加設計 (2026-05-25 grill)」参照、実装は Phase 6/7) |

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

### Phase 3 中盤の追加決定（2026-05-24）

| 論点 | 確定 |
|---|---|
| 「学習を終了」ボタンの挙動 | 即終了せず `/tutor?ending=1` に遷移 → ゆいが ending 振り返り対話 → 確定後にセッション終了 |
| ending 開始発話 | ito19 さん canonical script「お疲れさま！今から、頭の中のふわっとしたものを、私がまとめて具体化していくね...」(TUTOR-ROLE.md 記載) |
| ending 振り返りの構造 | **ループ型サマリー**: 本人発話 → 累積サマリー + 「他にある?」を毎ターン繰り返す → 「もうない」で確定 |
| 設計意図 | AI の要約能力を本人のメタ認知促進に転用（「あ、まだあった」を誘発）|
| アイドル検知 | 15 分で auto-pause（auto-end しない）|
| ブラウザ閉じ | 終了せず snapshot を localStorage に保存 |
| 翌日復帰 | 完全サイレント。前日以前のセッションは静かに破棄、ゆいは過去に触れず通常の朝の振り返りから |
| 同日復帰 | localStorage から復元、paused 起動、任意操作で auto-resume |
| chat の lifecycle | **1 日 1 thread**。同日継続、別日新規。Claude API コンテキストは 1 日分で bounded |
| 同日内の区切り | 1 本のスレッドに **話題セクションヘッダー** を自動挿入（topic 変化時）|
| 話題タグの数 | 10 種（朝の振り返り / 掘り起こし / 課題確認 / スケジュール / 履歴 / 教材追加 / 先生対話 / 学習開始 / 学習終了 / おしゃべり）|
| Topic の見た目 | 中2 女子向け: 絵文字 + パステル色（amber / sky / orange / violet / slate / emerald / indigo / fuchsia / rose / neutral） |
| ゆい対話アーカイブ | 1 日 1 chat ベース、日付セレクター + 話題フィルター、readonly |
| アクセス導線 | HubMenu「先生との対話」プルダウンに「ゆい先生」を追加、+ chat に「ゆい対話履歴」等のキーワードで |
| 過去 chat 検索 | 「あの話したよね?」系トリガー 18 種で検出、grep ベース、結果はクリックでアーカイブにジャンプ |
| 「先生との対話」プルダウンの構成 | 担任セクション（ゆい）+ 科目セクション（あおい先生 等）の 2 段構成 |
| HubMenu の quickReplies 撤去 | ending-vent ループは quickReplies 撤去（テキスト本文で「続けて話す or 『もうない』」を明示）|
| サイドバー整理 | 科目の先生エントリを撤去（HubMenu プルダウンに集約）、ゆい先生のみ最上位に残す |
| /learn の「ゆい先生に戻る」ボタン | 撤去（サイドバーと重複）|

### 学習計測・離席検知（Phase 3.5 / 部分実装済）

#### 旧設計から改訂（2026-05-24）

ito19 さん指示により、ブラウザ閉じ / アイドル / 翌日復帰の扱いを以下に再定義:

| 論点 | 旧設計 | **新設計（2026-05-24 改訂、実装済）** |
|---|---|---|
| アイドル検知 | 15 分で pause、30 分で auto-end | **15 分で pause のみ。auto-end しない**（終了は本人意思のみ） |
| 自動復帰 | アイドル復帰 → ゆい「お帰り」 | **任意の操作 (mouse/key/click/scroll/touch) で自動 resume（throttle 1 秒）。明示挨拶なし** |
| ブラウザ閉じ | `endReason: "browser-close"` で終了 + 警告ダイアログ | **終了しない。snapshot を localStorage に保存（ブラウザ閉じ ≠ 学習終了）。警告ダイアログも撤去** |
| 翌日復帰 | 「今日始める?」儀式を再表示 | **完全サイレント**。前日以前のセッションは静かに破棄、ゆいは過去に触れず通常の朝の振り返りから始まる |
| 同日復帰（数時間後）| 「ちょっと空いたけど続ける?」 | localStorage 復元 → paused 状態で起動、本人の任意操作で resume |
| 日付跨ぎ | `endReason: "auto-day-change"` 自動終了 | （未実装、現状はサイレント破棄で代用）|

#### 現行実装（`useLearningSession`）

| 論点 | 確定 |
|---|---|
| 開始 | mount 時に自動。`/tutor` 「今日始める?」儀式は将来追加（既存のは内部 startedAt 切り） |
| 計測の正体 | active 区間の累積秒数のみカウント（paused 中は止まる）|
| 状態モデル | `"active" \| "paused" \| "ended"` の 3 状態 |
| 永続化 | localStorage、5 秒に 1 回 save + beforeunload で save |
| 復元 | mount 時に localStorage チェック、**ローカル日付一致なら復元（paused 起動）**、別日は破棄 |
| 終了 | `endSession()` 明示呼び出しのみ → localStorage clear。/learn ヘッダの「学習を終了」→ /tutor で ゆいに報告 → 終了 |
| アイドル検知（pause） | 15 分操作なしで auto-pause、セッションは終了しない |
| アクティビティ検知 | mouse / keyboard / click / scroll / touch を global listen（throttle 1 秒）。paused 中の操作で auto-resume |
| しきい値の根拠 | 15 分: トイレ・食事・家族会話を許容 |
| 表示 | LearnHeader の状態ドット 3 色（緑 active + ping / 黄 paused / 赤 ended） |
| 「うざい」回避 | サボった日は何も聞かない。1 週間後でも「久しぶり」とすら言わない（ito19 さん指示）|

#### 未実装（次フェーズ）

- 日付跨ぎ自動終了（現状はサイレント破棄で代用）
- /tutor 起動時の「今日始める? お休み?」儀式（mount で自動開始してる）
- 終了儀式 = `SessionEndDialog`（旧版あり、ゆい report への遷移と統合は未整理）

### 中学生向け設計軌道修正 (Phase 4, 2026-05-25 grill)

ito19 さん観察「現状の仕組みは大人の学習方法に寄っている」を受けた軌道修正。詳細設計は本書「## Phase 4: 中学生向け設計軌道修正」セクション参照。grill-me で 17 問詰めた結果:

| Q | 論点 | 確定 |
|---|---|---|
| Q1 | 問題定義 | 「外から降ってくるタスク中心」「戻る仕組み欠落」「夕方の儀式空白」の整理で合意 |
| Q3 | 計画立案の中心型 | **新型 `LearningPlan`** (ExamPrep と並走、独立) |
| Q4 | 回転と最小単位 | **全体通読 × 3 回 + ページ単位** (「教科書を 3 回読む」と本人説明) |
| Q5 | 落とし込み方式 | **roadmap (全期間プラン、3 ヶ月で 1 回転) + 月次バッチ展開 + 週次フィードバック + 月末繰り越し / 修正プラン** (PDCA フラクタル) |
| Q6 | 帰宅儀式 | **朝 (既存振り返り) と帰宅を 2 儀式分離**、帰宅は時間帯トリガー |
| Q7 | Inbox 設計 | **Inbox 型は作らない**、`ScheduleItem.tags` + `source` を追加 (タグだけで運用) |
| Q8 | 帰宅儀式の中身 | **2 部構成**: 第 1 部 学校レポート (時限別シーケンシャル、新型 `SchoolDailyReport`) / 第 2 部 スケジュール確定 (plan + carry-over + ad-hoc) |
| Q9 | 週次/月次レポート構成 | **4 セクション**: 達成度 → 学校 → 弱いところ → 来週計画+Action (サンドイッチ + **達成感最優先**) |
| Q10 | 弱いところの基盤 | **Issue (点) + NodeComprehension (面) ハイブリッド** (会計士試験的振り返り) |
| Q11 | 計画立案 UX | **ゆい対話 + カード ハイブリッド** (subject-picker / material-picker / duration-picker / roadmap-preview) |
| Q12 | 月次バッチ + 月末判定 | **月末週の週次レポートに統合** (月次レポート + 来月計画展開を拡張版に被せる、儀式爆発を防ぐ) |
| Q13 | 帰宅儀式起動 | **平日 16:00 以降 初回アクセスで自動 + 土日 skip + 緊急時 HubMenu 明示** |
| Q14 | 時限数 | **可変** (毎回「何時限あった?」を 1 タップ選択、短縮日・行事日対応) |
| Q15 | 親 (admin) への共有 | **本人同意制** (デフォルト OFF、本人が選んだ項目のみ admin 可視、プライバシー + 達成感のもう 1 層) |
| Q16 | 達成バッジ | **5-7 種類** (連続 3/7/30 日、月達成 80%/100%、Issue 5 件、復元全問)、プロフィールに静的に残る。連続日数は「1 日 5 分でも OK」の軽め基準 |
| Q17 | 月末修正プラン | **ゆい対話 + draft カード + 4-5 選択肢** (時間増 / 期間延長 / 教材変更 / 順序変更) + 「考えさせて」(中学生の決断疲れ回避) |

**新型 / 既存型変更まとめ**:

| 種別 | 型 |
|---|---|
| 新型 | `LearningPlan` / `PlanSegment` / `ExpandedMonth` / `PlanRevision` / `SchoolDailyReport` / `PeriodEntry` / `WeeklyMonthlyReport` / `AchievementBadge` / `ActionProposal` / `SharedToParent` |
| 拡張 | `ScheduleItem.tags / source`、`ReflectionLog.weeklyMonthlyReport` 追加 |
| 縮退 | `ReflectionLog.schoolToday` 撤去 (SchoolDailyReport に移行、4 セクションに縮退) |

**未決事項** (実装中 or 後で詰める):
- バッジの具体的ビジュアル (絵文字 / SVG / ステッカー風)
- 親への通知方法 (admin 側 UI、メール等)
- 月末週の判定ロジック細部 (「最終週」の判定基準)
- ~~計画立案の AI による教材目次自動読み込み (Phase 6 で実装、現状は手動入力 mock)~~ → **2026-05-25 grill で再設計確定** (葵先生が体系図 (テキスト忠実) + 評価コメント 2 レイヤで生成、Phase 6 で実装)。本書「## 教材アップロード設計 (2026-05-25 grill)」参照
- 教材変更時の roadmap 再計算ロジック

---

## 教材アップロード設計 (2026-05-25 grill)

Phase 5 完了後の追加 grill。教材ウィザード (Phase 4 実装済 = `MaterialEditWizard`) / Plan Engine の `MaterialPickerCard` (Phase 5 実装済) / Phase 6 計画 (教材 PDF → roadmap 自動生成) を貫く「**教材という入力レイヤ**」の設計を 13 個の確定で固めた。grill 結果は本セクションに集約、既存セクション (教材追加ゆいハブ化 / Phase 4 grill 確定 等) からは本セクションへの参照を置く。

### 13 確定事項

| # | 確定 |
|---|---|
| 1 | 順序: **教材アップロード → 計画** (現状実装維持) |
| 2 | 計画主体: ゆい (担任) が提案 → 娘さん承認/修正 |
| 3 | ゆいは **教材選びの提案はしない** (与えた教材に対する計画案のみ。「○○本を買って」は禁止) |
| 4 | 教材アップロード主体: **親 + 娘さん両方** (admin/learner 区別なし、本書 1408 既設計) |
| 5 | 教材アップロード後の動線は **計画と疎結合**: (a) 体系図/評価コメントを見る・葵に質問 (b) 計画立案で使う (c) 何もしない の 3 経路 |
| 6 | 学校宿題は **SchoolDailyReport 側** で写真/PDF アップ可 (教材 = Material エンティティとは別カテゴリ、計画の対象外) |
| 7 | 教材は **事前アップが基本** (同時アップも例外可) |
| 8 | 教材 AI persona = **葵先生** (科目の先生)。TUTOR-ROLE 境界 (ゆい=教えない / 葵=教える) より、ゆいは入口のみ |
| 9 | **監修ステップは全廃** (どの場面でも、人間が AI 出力を承認するステップは置かない。葵生成・ゆい計画案・週次レポート 等すべて) |
| 10 | **葵生成はテキストに忠実** (AI 解釈・取捨選択禁止、「中3範囲だから削除」みたいな勝手な判断 NG。教科書に書かれているノードは必ず体系図に含める) |
| 11 | 葵の教材出力 = **体系図 (テキスト忠実) + 評価コメント (葵の見解: coverage / difficulty / fit / notes)** の 2 レイヤ |
| 12 | 教材についての葵 chat = **教材ごと独立スレッド** (教材詳細ページに集約、既存「課題ごと独立 chat」と相似形) |
| 13 | アップ完了動線 = **ゆい hub 経由**「葵が読んだよ、見る?」(本書 1404 ハブ化方針と一貫) |

### 設計の流れ図

```
[アップロード]
     ↓
[葵が読む]  ← 体系図 (テキスト忠実) + 評価コメント (葵の見解) を 2 レイヤで生成
     ↓
[保存] (監修ステップなし、葵生成をそのまま保存)
     ↓
[ゆい「葵が読んだよ、見る?」] ← hub 復帰、quickReplies で 3 択
     ↓
  ┌──────────────────┼──────────────────┐
  ↓                  ↓                  ↓
教材詳細ページ      計画立案で使う      何もしない
(体系図 +           (材料として        (後で使う、
 評価コメント +     ピッカーに出る、    既登録教材として
 葵 chat)           ゆいが提案)        他の経路で利用可能)
```

### 葵先生の教材出力構造 (新型)

```typescript
type AoiMaterialAnalysis = {
  materialId: string
  nodes: KnowledgeNode[]      // 体系図 (テキスト忠実、AI 解釈なし)
  review: MaterialReview      // 評価コメント (葵の見解)
}

type MaterialReview = {
  coverage: string             // 範囲評価 「中2文法を網羅、関係代名詞は中3範囲だが基礎部分」
  difficulty: string           // 難易度評価 「やや易しめ、演習問題が少ない」
  fit: string                  // 対象との整合 「中2 1月時点でちょうど良い」
  notes: string[]              // その他コメント
}
```

### 影響を受ける既存実装

| 既存実装 | 影響 |
|---|---|
| `MaterialEditWizard` (Phase 4) | **Step3Review 撤去**, Step4Save を Step3 に詰めて **3 step 化** (メタ・アップ / 葵生成 / 保存)。Step2 の AI 抽出 (現状 mock) は Phase 6 で本物の葵生成に置換 |
| `MaterialPickerCard` (Phase 5) | **確定 1, 2, 3 と整合、既存挙動でOK**。ゆいが「どの教材で?」と聞いて娘さんが既登録教材から選ぶのは「教材選び提案」(=新規購入提案) ではなく「選択肢提示」。**✅ C36 で SubjectPickerCard C29 と同じパターンの「+ 新規テキスト追加」リンクをリスト末尾に追加** (`/tutor?view=material-new` 遷移 = `MaterialEditWizard` 起動、計画立案中に「教材がない」気づきから即追加可能) |
| 教材詳細ページ (`/tutor?view=material-detail&id=xxx`) | **新規追加** (確定 5, 11, 12)。体系図表示 + 葵評価コメント + 葵 chat 入力欄を一体表示 |
| ゆい mock (`tutor-mock.ts`) | 教材アップ完了 onComplete 後の「葵が読んだよ、見る?」発話 + 3 択 quickReplies を追加 (確定 13) |
| 教材追加ゆいハブ化 (本書 1404-1413) | 確定 4 と既存設計が整合済、確定 13 でアップ完了動線が「ゆい hub 復帰」として明文化 |
| `IssueChatMessage` | 教材ごと独立 chat (確定 12) で同型を流用するか `MaterialChatMessage` を新設するかは Phase 6 着手時に判断 |

### Phase 6 で実装する具体タスク (この grill が決めたもの)

- 葵先生による教材 PDF / 写真読み込み (Claude Opus マルチモーダル、画像 OCR + 構造抽出) — **Phase 6 未着手**
- 体系図出力: テキスト忠実の `KnowledgeNode[]` 抽出 (確定 10) — **Phase 6 未着手** (mockExtractNodes で代用中)
- 評価コメント出力: `MaterialReview` 新型 (確定 11) — **✅ C32 ガワ実装** (現状は固定 mock テキスト coverage/difficulty/fit/notes、Phase 6 で Claude Opus 出力に置換)
- 教材詳細ページ UI (`/tutor?view=material-detail&id=xxx`) — **✅ C32 ガワ + C40/C41 取り残し fix + C43 体系図フローチャート + C45 スケジュール組み込み状況 + C46 編集・削除 + C48 体系図リスト⇄マップ切替 で完全実装** (C32: `MaterialDetailView` 骨格 / C40: viewFromParam fix / C41: スクロール fix / C43: MindMapPane 流用で体系図フローチャート追加 / C45: 当月 SI 紐付け表示 + today-tasks 遷移 / C46: MaterialEditDialog 再利用で編集削除 / C48: フローチャートとノードリストを 1 Card にトグル統合 [デフォルト=リスト])
- 教材一覧の再アクセス動線 (隠れ取り残し論点⑤、C42 で発見) — **✅ C44 完全解消** (ゆいメニュー「教材」ボタン + MaterialsListPane 科目別 grouping + 末尾「+ 新規教材を追加」リンク、grill 1 確定 12「教材ごと独立葵 chat = 教材詳細ページに集約」を機能させる拠点アクセス動線が初めて確立)
- 教材ごと独立 chat スレッド (型と永続化、確定 12) — **Phase 6 未着手** (現状は placeholder/disabled textarea)
- ゆい mock の onComplete 発話 ("葵が読んだよ、見る?") 追加 (確定 13) — **✅ C32 ガワ実装** (現状は自動 material-detail 遷移、quickReplies「[見る][あとで]」は Phase 6)
- `MaterialEditWizard` 3 step 化 (Step3Review 撤去、確定 9) — **✅ C31 + C38 全 fix** (C31: `Step3Review.tsx` 削除済、STEP_LABELS 3 個に縮退 / C38: Step3Review 撤去の取り残し全 fix — Step2「監修に進む」→「保存に進む」、Step4Save の approved → extracted 統一、`AiExtractedNode.reviewStatus` 型フィールド削除、ゆい発話「監修していこう」→「その教科の先生が…体系図と評価コメントを出してくれる」、致命バグ「保存ボタンが永遠に disabled」fix)

### 実装状況 (2026-05-25/26 ガワ実装、C28-C34)

| Commit | SHA | 内容 |
|---|---|---|
| C31 | `10e933e` | MaterialEditWizard 3 step 化 (Step3Review 撤去、確定 9) |
| C32 | `379e5e5` | 教材詳細ページ skeleton + view=material-detail + ゆい「葵が読んだよ」発話 (確定 5/11/12/13) |
| C36 | `fae0852` | MaterialPickerCard に「+ 新規テキスト追加」リンク追加 (SubjectPickerCard C29 と同じパターン、計画立案中の「教材がない」即追加動線) |
| C37 | `b9b5b3e` | fix: Step1MetaAndUpload 科目セレクトの Radix Select quirk 修正 (value !== children な SelectItem で raw value 表示されていたバグ) |
| C38 | `14f1125` | fix: C31 取り残し全 fix (Step2「監修に進む」→「保存に進む」、Step4Save approved → extracted 統一、`AiExtractedNode.reviewStatus` 型削除、ゆい発話更新、致命バグ「保存ボタン永遠 disabled」fix、確定 9/10 整合) |
| C40 | `f93cc83` | fix: TutorWorkspace.viewFromParam に "material-detail" 追加忘れ修正 (C32 ガワ実装時に許可リスト追加漏れで、URL が material-detail に変わっても default に丸められ右ペインが切り替わらなかった致命バグ) |
| C41 | `04074b4` | fix: MaterialDetailView スクロール不能 fix (flex 子の min-height: auto 規則で overflow が効かなかった、WeeklyMonthlyReportView の二層 min-h-0 flex-1 パターンに統一) |
| C43 | `79ee7b0` | feat: MaterialDetailView に体系図フローチャート追加 (G 案、ito19 さん意見「学習画面のフローチャートと同じものを教材詳細にも」、MindMapPane 流用、coveredNodes filter + h-[420px]、ノードリストと併せて 2 表現) |
| C44 | `21f6a22` | feat: ゆいメニュー「教材」+ MaterialsListPane 新規 (A+B 一気実装、残課題⑤ 教材詳細の再アクセス動線完全解消、配置 δ プランの左、科目別 grouping + 末尾「+ 新規教材を追加」+ keyword「教材一覧」「教材」「教材を見る」「教材見せて」分岐) |
| C45 | `5b0623d` | feat: 教材詳細にスケジュール組み込み状況表示 + 遷移リンク (D+E α 案、SI → GT → resource.materialId 経路で当月 SI 集計、計画名 + 進捗 + 未着手 SI 上位 3 件 + [今月の予定を見る] / [計画を立てる] ボタン) |
| C46 | `63a4f6b` | feat: 教材編集・削除 (F α 案、MaterialEditDialog 再利用、TutorWorkspace materials state 管理、handleMaterialUpdated/Deleted callback、誤操作防止のため削除はダイアログ内ゴミ箱、関連データ整合は Phase 7) |
| C48 | `bea7c2e` | refactor: MaterialDetailView 体系図セクションを「リスト ⇄ マップ 切替」UI に統合 (ito19 さん意見、旧 C43 で 2 Card 縦並びだったフローチャート + ノードリストを 1 Card に統合、ヘッダー右側トグルボタン、デフォルト = リスト) |
| C49 | `47ca5a3` | feat: 学習スケジュール進捗を信号機色 (🟢順調 / 🟡ペース注意 / 🔴遅れ気味) で表示 (ito19 さん意見、暫定閾値 80%/50%、プログレスバー色も連動、本物の閾値ロジック = 日付経過率比較等は Phase 6/7 で要件 grill 後確定) |
| C50 | `4cd181f` | style: 体系図マップモードの高さを 420px → 700px に拡大 (ito19 さん「マップは縦に大きくしないと見づらい」、33 ノード階層図の視認性向上) |
| C51 | `225d385` | fix: スケジュール組み込み状況 - 今月 0 件時の [今月の予定を見る] ボタン非表示化 (ito19 さん「学習スケジュールに組み込まれていない場合は予定の画面に遷移できなくていい」、計画には紐付くが今月分 SI が 0 件のケースは「今月の予定はまだありません」テキストに切替) |
| C52 | `f59ddd3` | feat: ノードリスト → 葵 chat 遷移ガワ (ito19 さん「ノードリスト = チャット一覧、押すと chat に遷移」、各ノード button 化 + hover/icon + クリックで chat エリア scroll + 選択ノードで chat ヘッダ/placeholder 動的更新、本物 thread 設計は Phase 6 grill) |
| C53 | `2269131` | feat: 教材詳細最上部に「← 教材一覧に戻る」ボタン追加 (ito19 さん「教材一覧に戻るボタンが欲しい」、ghost button、ゆいメニュー経由せず 1 クリックで MaterialsListPane 復帰) |
| C54 | `e3e8717` | style: TutorWorkspace ヘッダから「/ ゆい先生」breadcrumb 削除 (ito19 さん「ヘッダのこの表示いらない」、ページタイトル「ゆい先生（司令室）」と重複していたため整理) |
| C55 | (今 push) | docs: 教材セクション完成 + 次セッション「プラン (計画立案) grill = 一番の肝、慎重に」引継ぎ準備 (ito19 さん「教材の作成 OK、次はプランの作成、ここが一番の肝、慎重に」明示、SESSION_HANDOFF Header + §3 末尾ラップアップ + §6 状態+次作業 全更新) |

ガワ実装範囲: 確定 9/11/13 のうち UI + フロー部分のみ。Phase 6 (本物の葵 Claude Opus 接続 + 評価コメント生成 + 教材ごと独立 chat 本実装) + Phase 7 (Material/MaterialReview/chat の Supabase 永続化) は未着手。

### 未決事項 (実装着手時に詰める)

- ウィザード簡素化後の入力タイプ UX (PDF / 写真 / スキャン の出し分け)
- 計画立案フローでの教材ピッカー動作の細部 (既登録教材の並び順 / 検索 / 削除)
- 学校宿題写真アップ時の葵介入度 (マルチモーダル解析するか、ファイル保存のみか) — Phase 6 議論
- 教材詳細ページの細部 UI (体系図ビジュアル / 評価コメントレイアウト / chat 入力欄配置)
- 永続化 (Phase 7 Supabase スキーマで決まる: Material / KnowledgeNode / MaterialReview / 教材 chat スレッド)

### PHILOSOPHY / TUTOR-ROLE との整合

- **PHILOSOPHY.md 本文**: 修正不要。中核 2「頭の中にツールを組み立てる」は「葵が体系図を提示 → 娘さんが見て理解する」立て付けで成立 (本文に「娘さん自身が一人でゼロから組み立てる」とは書かれていない)。中核 5「体系の骨格を先に掴む」は葵生成体系図がまさに骨格提示なので強化される
- **TUTOR-ROLE.md**: 修正不要。ゆい = 教えない / 葵 = 教える の境界に従って教材体系図生成と教材 chat を葵に割り当てたので、境界設計が強化される
- **削除した過去解釈**: memory `project_ai_education.md` に記載していた「娘さん自身が AI と対話しながら自分で作る (生成効果)」は本 grill で撤回 (中2 には負荷過剰 + ゆい計画提案路線と矛盾)

### 関連箇所

- 本書 1404-1413 (教材追加ゆいハブ化)
- 本書 1514-1551 (Phase 4 grill 確定、教材ウィザード関連の Q3-Q11)
- 本書 1287 (Phase 6 ロードマップ「教材 PDF → roadmap 自動生成」)
- 本書「## 科目追加設計 (2026-05-25 grill)」 (姉妹 grill、同日、共通設計原則あり)
- `TUTOR-ROLE.md` (ゆい / 葵の境界)
- `PHILOSOPHY.md` 中核 2 (ツール化) / 中核 5 (体系の骨格)

---

## 科目追加設計 (2026-05-25 grill)

2026-05-25 追加 grill 2 回目 (教材アップロード設計 grill と同日)。計画立案・教材ウィザードの `SubjectPickerCard` が **英語 1 科目のみ表示** という UX 状態 (`MOCK_SUBJECTS` には subj-english しかハードコードされていないため) をきっかけに、「**科目**」エンティティの追加動線設計を 9 個の確定で固めた。MVP 範囲は英語 1 科目のみ継続、本セクションは設計の SSoT、実装は Phase 6/7 以降。

### 9 確定事項

| # | 確定 |
|---|---|
| S1 | MVP は英語のみ継続、本 grill は設計確定のみ、実装は Phase 6/7 以降 |
| S2 | **主要科目はハードコードでデフォルトセット**、先生キャラも同時に決め打ち (S9 で 5 教科に確定) |
| S3 | ハードコード外 (技術家庭・道徳 等) は **手動追加** (科目名 + 先生名を入力) |
| S4 | 「科目の設定」専用入口が必要 |
| S5 | 計画立案フローで「科目がない」と気づいた時、ゆいが「科目設定に行こう」と誘導する発話を実装 |
| S6 | 入口 = **ゆいハブメニュー「科目を追加」主動線 + `/admin/subjects` バックアップ動線** (教材追加と同じ二重構造、本書 1404-1413 と同パターン) |
| S7 | 追加主体 = **親 + 娘さん両方** (教材アップ確定 4 と同じ、admin/learner 区別なし)。削除運用は実装時に詰める (ハードコード 5 教科は削除不可、手動追加分は管理画面で削除可 を予定) |
| S8 | 各「科目を選ぶ」UI (SubjectPickerCard / ウィザード Step1 科目ドロップダウン) に **「+ 新規科目」リンク**、クリックで **ゆいハブの科目設定画面に遷移**、追加完了後元のフローに戻る (追加処理ロジックは 1 箇所に統一) |
| S9 | ハードコードデフォルト = **主要 5 教科 (英・数・国・理・社)**。AI 学習に親和性高い座学教科に限定、実技 (体育・音楽・美術) は対象外、必要なら S3 で手動追加 |

### データモデル現状と変更

```
現状 (mock-data.ts:554-574):
- MOCK_SUBJECTS: [subj-english (あおい先生)] 1 件のみ
- ROOT_NODE_TO_SUBJECT: { grammar: "subj-english" } のみ

S9 後 (ハードコード拡張):
- MOCK_SUBJECTS: [英語(あおい), 数学(?), 国語(?), 理科(?), 社会(?)] 5 件
- ROOT_NODE_TO_SUBJECT: { grammar: "subj-english", math-root: "subj-math", ... } 5 件
- KnowledgeNode root: 各教科の root ノードを新規追加
- (先生キャラ命名は ito19 さんが実装時に提示)

S3 (手動追加分):
- MOCK_SUBJECTS に動的 push (Phase 7 で Supabase 永続化)
```

### 設計の流れ図

```
[科目選択 UI: SubjectPickerCard or ウィザード Step1]
        ↓
候補リスト: ハードコード 5 教科 + 手動追加分
        ↓
  ┌─────────────┴─────────────┐
  ↓                            ↓
既存科目から選ぶ           [+ 新規科目] リンク
  ↓                            ↓
元のフロー続行              ゆいハブ「科目を追加」画面に遷移
                              (右ペインに embedded)
                              ↓
                          科目名 + 先生名入力フォーム
                              ↓
                          MOCK_SUBJECTS に push
                              ↓
                          ゆいが「追加したよ」発話
                              ↓
                          元のフローに戻る (科目選択肢に新科目登場)
```

### 入口の二重構造 (S6)

| 動線 | 説明 | 想定ユーザー |
|---|---|---|
| 主動線 | ゆいハブメニュー「もっと ▼」→「科目を追加」 → 右ペインに科目設定パネル embedded | 親 + 娘さん両方 |
| バックアップ動線 | `/admin/subjects` (URL バー直入力、サイドバーには出さない) | 親が一括設定する時 (学校シラバス見ながら等) |

### 影響を受ける既存実装

| 既存実装 | 影響 |
|---|---|
| `MOCK_SUBJECTS` (mock-data.ts:554) | 1 件 → 5 件 (主要 5 教科ハードコード、各先生キャラ命名) |
| `ROOT_NODE_TO_SUBJECT` (mock-data.ts:572) | `grammar` のみ → 5 教科分追加 |
| `KnowledgeNode` root (mock-data.ts) | 各教科の root ノードを新規追加 |
| `SubjectPickerCard` (Phase 5 実装) | 候補リスト末尾に **「+ 新規科目」リンク** 追加、クリックで `/tutor?view=subjects` 遷移 (S8) |
| `Step1MetaAndUpload` (Phase 4 実装、教材ウィザード) | 科目選択ドロップダウンの末尾に **「+ 新規科目」オプション** 追加、選択で同上の遷移 |
| ゆい mock (`tutor-mock.ts`) | 「科目を追加」 keyword 分岐 + 計画立案中の「科目がない」分岐 (S5) + 科目設定完了 onComplete 発話 |
| 新規 UI コンポーネント | `SubjectSettingsPanel` (右ペインに embedded、リスト + 追加フォーム) |
| 新規ルート | `/tutor?view=subjects` (科目設定パネル) + `/admin/subjects` (一括管理画面、S6 バックアップ動線) |

### Phase 6/7 で実装する具体タスク (本 grill が決めたもの)

- MOCK_SUBJECTS 拡張 (5 教科ハードコード、先生キャラ命名) — **✅ C28 ガワ実装** (英=あおい / 数=かずや / 国=みやび / 理=さとし / 社=ゆうき + 5 人分シンプル SVG アバター)
- 各教科 root KnowledgeNode 追加 — **✅ C28 ガワ実装** (math-root / japanese-root / science-root / social-root を MOCK_TREE に追加、内部ノードは英語以外未展開)
- ゆいハブメニュー「科目を追加」分岐 + `SubjectSettingsPanel` 新規実装 — **✅ C30 ガワ実装** (tutor-mock に「科目を追加」keyword 分岐 + 右ペイン展開、SubjectSettingsPanel で 5 教科リスト + 追加フォーム)
- SubjectPickerCard / Step1MetaAndUpload に「+ 新規科目」リンク追加 — **✅ C29 ガワ実装** + **✅ C34 fix** (tutor-mock の subject-picker options 4 箇所を MOCK_SUBJECTS 動的化、英語以外も表示されるよう修正)
- `/admin/subjects` バックアップ動線実装 — **✅ C33 ガワ実装** (`web/app/admin/subjects/page.tsx` で SubjectSettingsPanel を再利用)
- 計画立案フローでの「科目がない」検出 + ゆい誘導発話 (S5) — **部分実装**: 「+ 新規科目」リンクは配置済 (C29)、自動検出によるゆい発話誘導は Phase 6
- Phase 7 Supabase: `subjects` テーブル + RLS (家族のみアクセス) + 削除運用 (ハードコード保護 + 手動追加分削除時の関連データ整合) — **Phase 7 未着手**

### 実装状況 (2026-05-25/26 ガワ実装、C28-C34)

| Commit | SHA | 内容 |
|---|---|---|
| C28 | `d8e7153` | MOCK_SUBJECTS 5 教科 + SVG アバター + SubjectTeacherAvatar 共通コンポーネント (S2/S9) |
| C29 | `749f8a2` | SubjectPickerCard + Step1MetaAndUpload に「+ 新規科目」リンク (S8) |
| C30 | `96075dc` | SubjectSettingsPanel + view=subjects + ゆい mock 「科目を追加」分岐 (S4/S5/S6) |
| C33 | `f80d4e7` | /admin/subjects バックアップ動線 (S6) |
| C34 | `b1b92a1` | fix: subject-picker options を MOCK_SUBJECTS から動的生成 (C28 で残った hardcode の修正) |

ガワ実装範囲: S2/S3/S4/S5/S6/S7/S8/S9 のうち UI + フロー部分が完成。S7 の削除運用 + Phase 7 Supabase 永続化 + Phase 6 で実装予定の「ゆいによる『科目がない』自動検出発話」が残作業。

### 未決事項 (実装着手時に詰める)

- 5 教科の先生キャラ命名 (英語=葵既存、残り 4 教科 = ito19 さん命名)
- 科目追加 UI の入力項目 (科目名 / 先生名 + アバター文字 / 色 / subtitle 等)
- 削除運用の細部 (ハードコード 5 教科は削除不可、手動追加分削除時の関連 Material / LearningPlan の扱い)
- `SubjectSettingsPanel` の UI 細部 (リスト + 追加フォーム + 編集機能の有無)
- 「+ 新規科目」リンクのビジュアル (ボタン / リンク / アイコン付きカード)
- ゆい mock の「科目を追加」 keyword 分岐パターン (「科目追加」「教科追加」「英語以外もやりたい」等)

### 教材アップロード設計 (本書 1554 セクション) との関係

| 観点 | 教材アップロード | 科目追加 |
|---|---|---|
| 主体 | 親 + 娘さん両方 (確定 4) | 親 + 娘さん両方 (S7) |
| 入口 | ゆいハブ + `/admin/materials/new` バックアップ | ゆいハブ + `/admin/subjects` バックアップ |
| 「+ 新規」誘導 | 教材一覧 / 詳細遷移時 | SubjectPickerCard / Step1 ドロップダウン |
| AI 処理 | **葵が読む** (体系図 + 評価コメント生成) | **AI 処理なし** (人間入力のみ、純粋な設定追加) |
| 出力 | 体系図 + 評価コメント + 教材ごと chat | MOCK_SUBJECTS に push、それだけ |

### PHILOSOPHY / TUTOR-ROLE との整合

- **PHILOSOPHY.md 本文**: 修正不要 (中2 5 教科全てが学習対象になり得るが、MVP は英語のみという縮約は維持、PHILOSOPHY「広く浅くは NG」と整合)
- **TUTOR-ROLE.md**: 修正不要 (科目ごとに先生 = 葵パターンの拡張、葵は英語、他教科に同様の専門先生を配置)
- **境界違反 NG**: 「葵 1 人が複数科目を兼任」は禁止 (キャラ崩壊、TUTOR-ROLE「科目専門性」違反)

### 関連箇所

- 本書「## 教材アップロード設計 (2026-05-25 grill)」 (姉妹 grill、同日、共通設計原則あり)
- 本書 1404-1413 (教材追加ゆいハブ化、入口の二重構造の原型)
- 本書 1425 (MVP は あおい先生 (英語) のみ — 本 grill S1 で再確認)
- `web/lib/learn/mock-data.ts:554-574` (MOCK_SUBJECTS / ROOT_NODE_TO_SUBJECT 現状)
- `web/components/tutor/cards/SubjectPickerCard.tsx` (Phase 5 実装、「+ 新規科目」リンク追加対象)
- `web/components/admin/steps/Step1MetaAndUpload.tsx` (Phase 4 実装、科目ドロップダウン拡張対象)

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
│   ├── HandoffBanner.tsx           # ★C5: ゆいからの申し送りバナー（IssueChat ヘッダ下）
│   └── cards/
│       ├── TriggerMessageQuoteCard.tsx  # ★Phase 3: AI 発 Issue の triggerMessage 引用
│       └── ResolveSuggestionCard.tsx    # ★Phase 3: 「クリアして OK そう」AI 提案
├── history/                        # ★ 履歴（/tutor 右ペインと /history で共用）
│   ├── HistoryView.tsx
│   ├── HistorySummary.tsx          # 週/月の集計 + 科目別バー
│   └── HistoryCalendarView.tsx     # 月単位カレンダー
├── subjects/                       # ★Phase 3: 科目の先生 履歴ビュー
│   └── SubjectHistoryView.tsx      # ノード対話 + 課題 chat の時系列集約タイムライン
├── chat/                           # ★Phase 3 レビュー追従: chat 共通基盤
│   └── MarkdownText.tsx            # ★C1: chat バブル用 markdown renderer + stripMarkdown
├── reflections/                    # ★Phase 3 レビュー追従 C4
│   └── ReflectionListView.tsx      # ★C4: 振り返りログの日付別一覧 + cadence フィルタ + 派生リンク
├── plans/                          # ★Phase 4: LearningPlan 関連
│   ├── PlanWizard.tsx              # 計画立案 (chat + カード) のハブ
│   ├── PlanListView.tsx            # /tutor?view=plans 一覧
│   └── cards/
│       ├── DurationPickerCard.tsx  # 期間 + 回転数選択カード
│       └── RoadmapPreviewCard.tsx  # AI 生成 roadmap のプレビューカード
├── reports/                        # ★Phase 4: 週次/月次レポート (4 セクション)
│   ├── WeeklyMonthlyReportView.tsx # 4 セクション表示の本体
│   ├── AchievementSection.tsx      # セクション 1: 達成度 + バッジ
│   ├── SchoolSummarySection.tsx    # セクション 2: 学校まとめ (SchoolDailyReport 集約)
│   ├── WeakSpotsSection.tsx        # セクション 3: 弱いところ (Issue + NodeComprehension)
│   ├── NextPlanSection.tsx         # セクション 4: 来週/来月計画 + Action
│   └── badges/
│       └── AchievementBadgeChip.tsx # 達成バッジ表示
├── school/                         # ★Phase 4: 帰宅儀式の学校レポート
│   ├── SchoolReportWizard.tsx      # 第 1 部 学校レポート対話 (時限別シーケンシャル)
│   └── SchoolReportView.tsx        # SchoolDailyReport の閲覧 (履歴・アーカイブ)
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
├── tutor-teaching-guard.ts         # ★C6: 「教えない」ハードガード (detectTeachingRequest)
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
