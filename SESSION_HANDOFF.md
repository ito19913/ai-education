# SESSION_HANDOFF.md

AI-Education プロジェクトの **セッション間引継ぎドキュメント**。次セッションの最初に必ず読む。最終更新: 2026-05-25 (Phase 4 完了 + Phase 5 grill 確定 + C15-C24 全実装完了 + **2026-05-25 追加 grill 1: 教材アップロード設計 13 確定 (C26)** + **2026-05-25 追加 grill 2: 科目追加設計 9 確定 (C27)**)

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

## §3. 今日のセッション (2026-05-25) 全成果

**27 commit、約 +9200 行**。`7aaf7df`..(C27 SHA) の範囲。**Phase 5 grill 確定 + 全実装完了 + ARCHITECTURE 完全同期 + 2026-05-25 追加 grill 1 (教材アップロード設計 13 確定 / C26) + 2026-05-25 追加 grill 2 (科目追加設計 9 確定 / C27) を SSoT 同期**。

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
- 5 教科の先生キャラ命名 (英語=葵既存、残り 4 教科)
- 科目追加 UI 入力項目細部 (科目名 / 先生名 / アバター文字 / 色 / subtitle)
- 削除運用 (ハードコード保護 + 手動追加分削除時の関連 Material/LearningPlan 整合)
- `SubjectSettingsPanel` の UI 細部
- 「+ 新規科目」リンクのビジュアル
- ゆい mock 「科目を追加」 keyword 分岐パターン

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

### 選択肢 E: Phase 4 ウィザード簡素化 + 科目追加 UI ガワ (軽量、Phase 6 前哨戦)
- 2026-05-25 grill 1 確定 9 (監修撤去) + 11 (体系図 + 評価コメント) の **ガワを先行実装**
- `Step3Review.tsx` 削除 + Step4Save を Step3 に詰めて **3 step 化**
- AI 抽出は mock のまま (Phase 6 で本物の葵 API に置換、その時の基盤を整える)
- 教材詳細ページ skeleton (体系図 + 評価 mock + 葵 chat 入力欄) も同時実装可
- **2026-05-25 grill 2 由来の科目追加 UI も同時で軽実装**: MOCK_SUBJECTS を 5 教科に拡張 + SubjectPickerCard / Step1 に「+ 新規科目」リンク追加 + `SubjectSettingsPanel` ガワ (mock 表示)
- A の前にやると Phase 6 が軽くなる、独立で 1 セッション収まる軽さ

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
AI-Education プロジェクトの作業を継続します。

1. C:\dev\projects\home\Ai-Education\SESSION_HANDOFF.md を読んで状況把握
2. C:\dev\projects\home\Ai-Education\ARCHITECTURE.md の「## Phase 5: 学習戦略エンジン」セクションを確認
3. memory MEMORY.md の project_ai_education.md を確認

【今日の状態 (Phase 5 完全完了 + 2026-05-25 追加 grill 1+2 確定)】
- Phase 3 レビュー追従 完了 (C1-C6)
- Phase 4 中学生向け設計軌道修正 完了 (C7-C13)
- Phase 5 学習戦略エンジン 試作型 + mock (C14)
- **Phase 5 grill 確定 (P5-Q1〜Q7 + サブ問い計 11 問、ARCHITECTURE.md SSoT 反映済み)**
- **Phase 5 全実装完了 (C15 docs + C16 型 + C17 立案 + C18 Suggestion + C19 Replan + C20 週次 + C21 Plan Engine + C22 today-tasks + C23 動線 + C24 引継ぎ + C25 ARCHITECTURE 同期)**
- **2026-05-25 追加 grill 1 (C26): 教材アップロード設計 13 確定 を ARCHITECTURE / SESSION_HANDOFF / memory に同期。詳細は ARCHITECTURE「## 教材アップロード設計 (2026-05-25 grill)」**
- **2026-05-25 追加 grill 2 (C27): 科目追加設計 9 確定 を ARCHITECTURE / SESSION_HANDOFF / memory に同期。詳細は ARCHITECTURE「## 科目追加設計 (2026-05-25 grill)」**
- 27 commit / main 直 push 済 / tsc + lint クリア / dev server で動作確認可

【次の作業 (本セッション内に「進めて」で続行 or 次回新セッションで開始)】
SESSION_HANDOFF.md §5 の選択肢 A-E から選んで進める:
- A: Phase 6 (Claude API 接続) — scripted mock → 本物の AI、葵による教材体系図 + 評価コメント、教材詳細ページ + 教材ごと独立 chat、ウィザード 3 step 化、**科目追加 UI (5 教科ハードコード + SubjectSettingsPanel)**
- B: Phase 5 細部改善 (Suggestion/Interrupt 自動生成、永続化対応等)
- C: Phase 7 (Supabase 永続化) 設計 grill-me 開始 (Material/MaterialReview/教材 chat/**subjects テーブル + 削除運用** も対象)
- D: Phase 8 (音声対話) 着手
- E: Phase 4 ウィザード簡素化 + **科目追加 UI ガワ** (監修撤去 + 3 step 化 + 教材詳細ページ skeleton + MOCK_SUBJECTS 5 教科展開 + 「+ 新規科目」リンク、Phase 6 前哨戦の軽量タスク)

ito19 さんに「次どれ?」とアスクしてから進める。

各 commit ごとに tsc --noEmit + eslint クリアを確認、conventional commit
(feat: / docs: / refactor:) + 「なぜ / 何を / どう動くか」を本文に書く。
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com> を末尾に。

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
| **Co-Authored-By** | `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` を末尾に |
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
