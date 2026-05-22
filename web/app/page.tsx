/**
 * ルート `/` は学習画面にリダイレクトする。
 *
 * 旧 workspace-ui-kit の採用管理サンプル UI は git 履歴に残っているので、
 * いつでも復元できる。当面は AI-Education の本編 (/learn) を入口とする。
 *
 * 将来「教材選択 / ホームダッシュボード」が必要になったら、ここを置き換える。
 */
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/learn");
}
