/**
 * /learn — 旧学習画面 (4 ペイン: 体系図 / 対話 / ノート + 課題)。
 *
 * ★2026-06-08 廃止 (ito19 判断「ここで学習することはまずなくなった」)★:
 * 学習はレジュメ構想の **読書ビュー (教材の「一緒に読む」→ まとまり → レジュメ)** に集約された。
 * /learn は役目を終えたため /tutor (司令室) へリダイレクトする。
 *
 * コードは即削除せず残置 (`components/learn/` には MindMapPane など レジュメ体系図 /
 * 教材詳細が使う共有部品が含まれるため)。完全削除は別途、安全に行う。
 */
import { redirect } from "next/navigation";

export default function LearnPage() {
  redirect("/tutor");
}
