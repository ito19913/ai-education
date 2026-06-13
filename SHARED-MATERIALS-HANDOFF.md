# 共有教材の表設計 — 引き継ぎ資料（2026-06-13 grill 確定、★未実装★）

次のチャットはこの1枚を読めば「共有教材機能」の実装に入れる。設計は grill-me で確定済み。
コードはまだ1行も書いていない（migration も未作成）。これは**ロールアウト③**（①Vercel デプロイ済 →
②まとまり生成ジョブ有効化 → **③共有教材機能** → ④スタッフ段階オンボード）。

---

## 1. なぜやるか（背景）

AI-Education は娘さん専用から、**親戚＋ExceLike 会計事務所スタッフ 20〜30 名のマルチユーザー製品**へ
拡大した（2026-06-13 Vercel 公開済み、本番 `https://ai-education-6cqr.vercel.app`）。
事務所スタッフの税務学習では **admin（ito19 さん）が共通の税務テキストを1回登録 → 全スタッフが同じ教材を読み、
各自が自分のレジュメを作る**運用がしたい。個人が自分の教材を足すこと（今の挙動）も両立させる
＝**ハイブリッド**。重い vision 区切りを30人分やらず1回で済むので**コストも圧縮**できる。

---

## 2. 現状のデータ構造（実装前）

**`materials` テーブル**（`supabase/migrations/20260605000000_init_materials.sql` ＋後続で列追加）:
- 基本: `id` / `owner_id`(not null, → profiles) / `subject_id`(text) / `name` / `label` / `grade_level` /
  `pdf_path` / `pdf_size` / `deleted_at`(論理削除) / `created_at` / `updated_at`
- 後続追加列: `concept_segments`(JSONB=まとまり) / `guided_plans`(JSONB=ガイドの順序・青枠bbox) /
  `extracted_nodes`(JSONB=目次体系図) / `covered_node_ids` / `publisher` / `author` / `cover_thumb` /
  `kind`(book/assignment) / `assignment_type` / `due_date` / `assignment_status` / `segment_status`
- **RLS**: SELECT/INSERT/UPDATE すべて `owner_id = auth.uid() OR current_user_role()='admin'`（＝本人＋admin）。
  DELETE ポリシー無し（論理削除 deleted_at の UPDATE で行う）。

**Storage バケット `material-pdfs`**（private）: オブジェクトパス = `${owner_id}/${material_id}.pdf`。
Storage RLS は「先頭フォルダ(=owner_id)が本人、または admin のみ読み書き」。

**個人ごとのデータ**（既に user 別）: `note_entries`(レジュメ本文・進捗 status) / `resumes`(冊) /
`issues`(課題) / `plans` / `daily_picks` 等。← ここは共有しない。

つまり今は**教材も含めて全部「本人のもの」**。admin が全部見えるのは「娘さんの進捗を親が見る」用で、
**配る(共有)用ではない**。

---

## 3. grill 確定事項（5点）

1. **同じ `materials` 表に「共有フラグ」を1列足す**（共有専用の別表は作らない）。
   重い仕組み（まとまり・ガイド・読書ビュー・Storage）を丸ごと再利用するため。

2. **フラグ = `is_shared boolean not null default false`、持ち主(owner_id)は「アップした admin」のまま**。
   `owner_id` を nullable にしない。将来「部署だけに配る」が要れば `visibility`(個人/全体/グループ) の
   区分列に育てる（今は○/×で十分）。

3. **RLS のルール**:
   - **読む(SELECT)**: 全員が「自分の教材 **または** `is_shared=true`」を読める（既存の own-or-admin に `OR is_shared` を足す）。
   - **作る・直す(INSERT/UPDATE)で `is_shared=true` にできるのは admin だけ**。
   - **★learner が自分の個人教材を勝手に `is_shared=true` に切り替えられないように DB ルールで縛る**
     （非admin の書き込みは `is_shared=false` の行に限定 / 既存の共有行を learner が UPDATE できない）。
     → 勝手に全員へ配られる事故を防ぐ。

4. **構造(まとまり・ガイド・“保存される”青枠位置)は共有 & admin が整える。learner は読む専用だが
   “一時的な操作”は自由**:
   - `concept_segments` / `guided_plans`(保存される bbox) は共有教材なら全員共通。admin だけが編集・保存。
   - **learner は共有教材でも青枠をドラッグできる（画面では動く）が「保存されない」**＝その場限り・
     他人に影響しない（実装: 共有教材かつ非admin のとき、bbox ドラッグは**ローカル state のみ更新し
     persistGuidedPlans を呼ばない**）。
   - **場所選び（タップ／前へ・次へ／「ここを解説」）は誰でも自由**（読むときの一時選択・保存しない）。
   - **learner の“自分らしさ”は教材でなく各自のレジュメに出る**（note_entries/resumes は元から個人ごと）
     → **進捗用の新しい表は不要**。同じ共有教材を読んでもまとめは全員バラバラに育つ。

5. **PDF 本体も Storage の RLS で守る（(B)案を採用）**:
   - 共有教材の PDF は admin のフォルダ(`${admin_id}/...`)にあるので、今のままでは learner が開けない。
   - **Storage に「対象ファイルの material が `is_shared=true` なら誰でも SELECT 可」のポリシーを足す**
     （ファイル名 `${owner}/${material_id}.pdf` から material_id を引いて共有か判定する関数 + policy）。
   - 採用理由 = このアプリは**「DB のルール(RLS)が最後の砦」で統一**してきた流儀。サーバーが期限付き
     署名URLを出す(A)案は楽だが、アクセス判定がアプリのコードに移り、コードのバグ＝漏れになる。
     一貫性と堅さを取って(B)。

---

## 4. 未決事項（次チャットで詰める or 実装中に判断）

- **共有教材を admin が削除したとき**、それを出典にした learner のレジュメ(note_entries)の出典リンクをどうする？
  （案: 論理削除で残して出典は生かす／通知する 等。note_entries は material/segment を参照している）。
- **learner が個人で入れた本と、後から admin が出した共有版の重複**をどう扱う？（MVP では放置でも可）。
- **「手元だけの枠調整を保存したい」**を将来やるなら、個人ごとの bbox override を別表に持つ必要がある
  （MVP では不要＝一時操作で割り切る）。
- 将来の `visibility`(個人/全体/**グループ**=部署単位) 拡張。

---

## 5. 実装プランのスケッチ（着手時に plan 化）

**migration（1本）** `supabase/migrations/2026XXXX_add_material_is_shared.sql`:
- `alter table public.materials add column is_shared boolean not null default false;`
- 部分 index（任意）: `where is_shared`。
- RLS 差し替え: SELECT を `owner_id=auth.uid() OR is_shared OR admin` に。INSERT/UPDATE の with check に
  「非admin は is_shared=false のみ」を加える（admin のみ is_shared=true を作れる/維持できる）。
- Storage policy 追加: material-pdfs の SELECT に「ファイルの material が is_shared なら可」を OR で足す
  （SECURITY DEFINER 関数で material_id→is_shared を引く）。
- **適用は本番 Supabase に SQL Editor で .sql から直接コピー（鉄則）。** 既存教材は is_shared=false のまま無害。

**アプリ側**:
- `lib/materials/materials-repo.ts` — 一覧取得を「自分のもの＋共有」を返すように（RLS が効くのでクエリは素直に）。
  登録/編集で is_shared を扱えるように（admin のみ）。
- `app/admin/materials/` — admin の「公開（共有○にする）」UI。教材を共有にする/戻すトグル。
- `components/materials/MaterialReadPane.tsx` + `components/materials/EditableHighlight.tsx` —
  **共有教材かつ非admin のとき、青枠ドラッグは保存しない（persistGuidedPlans を呼ばない）**。
  場所選び・ここを解説は従来通り。「これは共有教材（読む専用）」のさりげない表示も検討。
- `hooks/use-materials.ts` — material に is_shared を載せる。本棚で「みんなの教材」バッジ等。
- `lib/materials/pdf-storage.ts` — 共有教材の PDF 取得経路の確認（Storage RLS が通れば既存ダウンロードで OK）。
- 型 `Material` に `isShared` 追加。

**順序**: ①migration（列+RLS+Storage policy）→ ②admin の公開UI ＋ 一覧が共有を拾う →
③読書ビューで learner の bbox を一時操作化（保存しない）→ ④本棚バッジ等の仕上げ。各段階 tsc/lint/build。

---

## 6. 関連 SSoT / 補足
- 本番デプロイ・ロールアウト順: memory `deploy_ai_education_production.md` ／ `SESSION_HANDOFF.md` ヘッダー。
- 認証ロール: `admin`(ito19) / `learner`(既定)。`current_user_role()` 関数あり（profiles migration）。
- ユーザー発行は admin が Supabase「Add user」（公開サインアップ OFF）。
- この設計は AIスクール発表用の整理も兼ねた（図 = チャット内の「共有教材のしくみ付き」widget）。
