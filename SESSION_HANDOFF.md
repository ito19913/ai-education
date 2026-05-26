# SESSION_HANDOFF.md

AI-Education プロジェクトの **セッション間引継ぎドキュメント**。次セッションの最初に必ず読む。最終更新: 2026-05-26 (Phase 4 完了 + Phase 5 grill 確定 + C15-C24 全実装完了 + 2026-05-25 追加 grill 1+2 (C26-C27) + 両 grill ガワ実装 (C28-C34) + C35 SSoT 同期 + 緊急 fix 5 件 (C36-C38, C40-C41) + 2 回 SSoT 同期 (C39, C42) + **2026-05-26 ito19 さん意見実装 (C43 G フローチャート / C44 A+B ゆいメニュー教材 + 一覧ペイン / C45 D+E スケジュール組み込み + 遷移 / C46 F 編集削除) + C47 SSoT 同期 完了 → 教材ハブ動線 (登録 → 一覧 → 詳細 → スケジュール連携 → 編集削除 → 葵 chat 拠点) 完全実装**)

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

**53 commit、約 +10715 行**。`7aaf7df`..(C53 SHA) の範囲。**Phase 5 grill 確定 + 全実装完了 + ARCHITECTURE 完全同期 + 2026-05-25 追加 grill 1+2 (教材アップロード 13 + 科目追加 9) SSoT 同期 + 両 grill ガワ実装 (C28-C34) + 緊急 fix 5 件 (C36-C38 / C40-C41) + 2026-05-26 ito19 さん意見実装 4 件 (C43 G フローチャート / C44 A+B 教材メニュー+一覧 / C45 D+E スケジュール連携 / C46 F 編集削除) で教材ハブ動線完全実装**。

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

### 2026-05-26 信号機進捗表示 (C49、暫定): スケジュール進捗を 🟢/🟡/🔴 でパッと見可視化

C48 push 後 ito19 さん追加意見「学習スケジュールの進捗状況を信号機の赤青黄色で表示、パッと見で順調かどうかが分かるように。赤青黄色の要件はプログラムで指定できるが、ここに関しては後で要件を詰めたい」 → MaterialDetailView の D+E スケジュール組み込み状況 Card に **信号バッジ** (色ドット + ラベル) と **プログレスバー色連動** を追加。

| # | SHA | 内容 |
|---|---|---|
| C49 | `47ca5a3` | feat: 学習スケジュール進捗を信号機色で表示 (暫定閾値) |
| C50 | `4cd181f` | style: 体系図マップモードの高さを 420px → 700px に拡大 |
| C51 | `225d385` | fix: スケジュール組み込み状況 - 今月 0 件時のボタン非表示化 |
| C52 | `f59ddd3` | feat: ノードリスト → 葵 chat 遷移ガワ |
| C53 | (今 push) | feat: 教材詳細最上部に「← 教材一覧に戻る」ボタン追加 (ito19 さん「教材一覧に戻るボタンが欲しい」、1 クリックで MaterialsListPane 復帰) |

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
AI-Education プロジェクトの作業を継続します。

1. C:\dev\projects\home\Ai-Education\SESSION_HANDOFF.md を読んで状況把握
2. C:\dev\projects\home\Ai-Education\ARCHITECTURE.md の「## Phase 5: 学習戦略エンジン」「## 教材アップロード設計 (2026-05-25 grill)」「## 科目追加設計 (2026-05-25 grill)」セクションを確認
3. memory MEMORY.md の project_ai_education.md を確認

【今日の状態 (53 commit、Phase 5 + grill 1+2 ガワ + 緊急 fix 5 件 + SSoT 同期 3 回 + ito19 さん意見実装 10 件 [C43-C46 + C48 体系図トグル + C49 信号機進捗 + C50 マップ高さ拡大 + C51 0 件時ボタン非表示 + C52 ノード→chat 遷移 + C53 教材一覧戻るボタン] で教材ハブ動線完全実装)】
- Phase 3 レビュー追従 完了 (C1-C6)
- Phase 4 中学生向け設計軌道修正 完了 (C7-C13)
- Phase 5 学習戦略エンジン 試作型 + mock (C14)
- **Phase 5 grill 確定 (P5-Q1〜Q7 + サブ問い計 11 問、ARCHITECTURE.md SSoT 反映済み)**
- **Phase 5 全実装完了 (C15-C24 + C25 ARCHITECTURE 同期)**
- **2026-05-25 追加 grill 1+2 (C26-C27): 教材アップロード設計 13 + 科目追加設計 9 SSoT 同期**
- **両 grill のガワ実装完了 (C28-C34) + C35 SSoT 同期**
- **2026-05-26 緊急 fix C36-C38 + C39 SSoT 同期** (材料ピッカー追加リンク / Radix Select quirk / C31 取り残し全 fix)
- **2026-05-26 後段緊急 fix C40-C41 + C42 SSoT 同期**:
  - **C40 `f93cc83`**: fix: TutorWorkspace.viewFromParam に "material-detail" 抜け fix (C32 ガワ実装時に URL parser 許可リスト追加忘れ → URL が material-detail でも DefaultPane 表示の致命バグ)
  - **C41 `04074b4`**: fix: MaterialDetailView スクロール不能 fix (flex 子の min-height: auto 規則で overflow が効かない問題、WeeklyMonthlyReportView 二層パターンに統一)
  - これで教材登録ウィザード Step1 → Step2 → Step3 → material-detail 自動展開 → 体系図全件スクロール閲覧、まで **2 セッション越しに初めて全動線完走**
- **C42 `e8f42d7`**: docs: C40-C41 を ARCHITECTURE / SESSION_HANDOFF / memory に同期 + 残課題 ②③④ を明記
- **2026-05-26 ito19 さん意見実装 (C43-C46)** で教材ハブ動線完全実装 (詳細は §3「2026-05-26 ito19 さん意見実装 (C43-C46)」セクション):
  - **C43 `79ee7b0`**: feat: MaterialDetailView に体系図フローチャート (G、MindMapPane 流用、ノードリスト + フローチャート 2 表現)
  - **C44 `21f6a22`**: feat: ゆいメニュー「教材」+ MaterialsListPane (A+B、残課題⑤ 完全解消、δ プランの左配置 + 科目別 grouping)
  - **C45 `5b0623d`**: feat: 教材詳細にスケジュール組み込み状況 + 遷移リンク (D+E α 案、当月 SI 集計 + today-tasks 遷移)
  - **C46 `63a4f6b`**: feat: 教材編集・削除 (F α 案、MaterialEditDialog 再利用、materials state 管理)
- **C47 (今 push): C43-C46 を ARCHITECTURE / SESSION_HANDOFF / memory に SSoT 同期**
- 47 commit / main 直 push 済 / tsc + lint クリア

【本セッション中対応しなかった残課題 (ito19 さん明示「一旦終了」)】
教材登録動線 C40-C41 fix の後、画面確認で見つかった以下の問題は **次セッション以降**:
- ② **表示教材が MOCK_MATERIALS[0] (中2英語教科書) 固定** → in-memory mock push 実装で解決、Phase 7 永続化とは別件
- ③ **2 回目以降の教材登録で「テスト」発話の重複** → 複数登録時の挙動 grill 要
- ④ **計画立案フロー + material-detail 並走** (左:plan-await-material / 右:material-detail) → grill 1 確定 5「疎結合」の UX 違和感、grill 要

【次の作業 — 計画立案フロー grill (P6 前段) 再開、または残課題対応】
前々回セッションで ito19 さん明示確定:
- **Phase 6 = ゆい AI 化 (コーチング担当の AI 実装) を core スコープ**
- ただしその前に **計画立案フロー grill を再度詰める** が確定 (grill 順序: 計画立案 grill 先 → ゆい AI 化 grill)
- 計画立案 grill 候補 9 個:
  ① 計画立案の「起点」(本人発話 only? ゆいから「そろそろ計画見直し時期?」と提案?) ← 推奨
  ② 教材ピッカー UX 細部 / ③「科目がない」自動検出 / ④ roadmap-preview 表示内容 /
  ⑤ キャンセル・一時保留 / ⑥ 複数並走計画 / ⑦ ゆいの事前情報 /
  ⑧ 既存計画との関係 / ⑨ 1 計画 1 教材 vs 複数教材

【本セッション中対応せず次セッション以降に持ち越しの残課題】
- ② 表示教材が MOCK_MATERIALS[0] (中2英語教科書) 固定 (アップロード時 fallback 設計、in-memory mock push 実装で即解消可能、Phase 7 永続化とは別件)
- ③ 2 回目以降の教材登録で「テスト」発話の重複 (複数登録時のゆい振る舞い + material-detail 更新ロジック未定義、設計 grill 要)
- ④ 計画立案フロー + material-detail 並走 (左 plan-await-material / 右 material-detail の UX 違和感、grill 1 確定 5「疎結合」の解釈 grill 要)
- ⑥ 信号機進捗表示の **本物の閾値ロジック** (C49 で暫定実装、ito19 さん「要件は後で詰める」明示、Phase 6/7 で要件 grill: 日付経過率比較 / 教材ごと / PlanType 別 / 配色アクセシビリティ / 集計範囲)

ito19 さんに **「(a) 残課題 ②③④ を先に片付ける / (b) 計画立案フロー grill (①〜⑨) から進める / (c) 別の作業」** をアスクして start。
推奨: 教材ハブ動線が完成した今、次は計画立案 grill (b の ①) から進めるのが自然 (Phase 6 ゆい AI 化の前段として枠を固める)。残課題 ②③④ は educational 動線の UX 細部だが、Phase 6 AI 化と同時に振る舞いが変わる可能性があり、優先度は低め。

各 commit ごとに tsc --noEmit + eslint クリアを確認、conventional commit
(feat: / fix: / docs: / refactor:) + 「なぜ / 何を / どう動くか」を本文に書く。
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
