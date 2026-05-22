/**
 * ルート `/` は担任「ゆい」さんの chat にリダイレクトする。
 *
 * ログインしたら必ず担任 chat にランディング（東進で「来たらチューター席に
 * 必ず座る」スタイル）。担任との会話の中で今日やる教科 / 教材 / 範囲が
 * 決まり、そこから学習画面に進む流れ。
 *
 * 旧 workspace-ui-kit の採用管理サンプル UI は git 履歴に残っているので、
 * いつでも復元できる。
 */
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/tutor");
}
