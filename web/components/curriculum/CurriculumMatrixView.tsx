"use client";

/**
 * CurriculumMatrixView - 英語 体系図マトリックス表示 (C66、2026-05-28)
 *
 * 横軸: 学年 (中1 → 高3、6 列)
 * 縦軸: 分野 (文法 / 語彙 / 読解 / 聴解 / 作文 / 会話、6 行)
 *
 * 学年区分なし分野 (読解 / 聴解 / 作文 / 会話) は 6 列全幅で表示。
 * ノードは状態 5 色で色分け、AI つまずき認定 (黄) / 戻り誘導候補 (赤) が
 * 一目で分かる。野球選手のスキルマップ的な見え方を目指す。
 *
 * 設計詳細: ARCHITECTURE「## カリキュラム DB 仮実装 (2026-05-28)」セクション参照。
 */

import Link from "next/link";
import {
  CURRICULUM_DOMAINS,
  CURRICULUM_DOMAIN_LABELS,
  CURRICULUM_GRADES,
  CURRICULUM_GRADE_LABELS,
  CURRICULUM_NODE_STATES,
  GRADE_AGNOSTIC_DOMAINS,
  MOCK_CURRICULUM_EN,
  nodeStateColor,
  nodesInCell,
  type CurriculumNode,
} from "@/lib/learn/curriculum-mock";

export function CurriculumMatrixView() {
  const nodes = MOCK_CURRICULUM_EN;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Header />
      <Legend />
      <Matrix nodes={nodes} />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          英語 体系図 (中1〜高3)
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          小〜高カリキュラム全体の地図 (C66 仮実装、2026-05-28)。AI がつまずきを認定し、ここから戻り誘導の候補を提示する。
        </p>
      </div>
      <Link
        href="/tutor"
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        ← ゆいに戻る
      </Link>
    </header>
  );
}

function Legend() {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        凡例 (ノード状態)
      </h2>
      <div className="flex flex-wrap gap-2">
        {CURRICULUM_NODE_STATES.map((state) => {
          const color = nodeStateColor(state);
          return (
            <div
              key={state}
              className={`rounded border px-2.5 py-1 ${color.bg} ${color.border}`}
            >
              <span className={`text-xs font-medium ${color.text}`}>
                {color.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        <strong className="text-amber-800">黄 (AI つまずき認定)</strong>: テスト誤答多 / ヒアリングで曖昧と AI が判定。<strong className="ml-2 text-rose-800">赤 (戻り誘導候補)</strong>: 本人ヒアリング + 親確認済 = 「ここから戻ろう」とコーチング誘導。
      </p>
    </section>
  );
}

function Matrix({ nodes }: { nodes: CurriculumNode[] }) {
  // 学年別分野 と 学年区分なし分野 を 2 段に分けて表示
  const gradedDomains = CURRICULUM_DOMAINS.filter(
    (d) => !GRADE_AGNOSTIC_DOMAINS.includes(d),
  );
  const agnosticDomains = CURRICULUM_DOMAINS.filter((d) =>
    GRADE_AGNOSTIC_DOMAINS.includes(d),
  );

  return (
    <section className="space-y-6">
      {/* 学年別ブロック (文法 / 語彙) */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          学年別 (文法 / 語彙)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-x-1.5 border-spacing-y-1">
            <thead>
              <tr>
                <th className="w-20 text-left text-xs font-semibold text-slate-600">
                  分野
                </th>
                {CURRICULUM_GRADES.map((grade) => (
                  <th
                    key={grade}
                    className="text-center text-xs font-semibold text-slate-700"
                  >
                    {CURRICULUM_GRADE_LABELS[grade]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradedDomains.map((domain) => (
                <tr key={domain}>
                  <td className="text-sm font-semibold text-slate-700">
                    {CURRICULUM_DOMAIN_LABELS[domain]}
                  </td>
                  {CURRICULUM_GRADES.map((grade) => {
                    const cellNodes = nodesInCell(nodes, domain, grade);
                    return (
                      <td key={grade} className="align-top">
                        <CellBox nodes={cellNodes} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 学年区分なしブロック (読解 / 聴解 / 作文 / 会話) */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          学年区分なし (読解 / 聴解 / 作文 / 会話)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agnosticDomains.map((domain) => {
            const cellNodes = nodes.filter((n) => n.domain === domain);
            return (
              <div key={domain}>
                <div className="mb-1 text-xs font-semibold text-slate-700">
                  {CURRICULUM_DOMAIN_LABELS[domain]}
                </div>
                <CellBox nodes={cellNodes} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CellBox({ nodes }: { nodes: CurriculumNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="min-h-[80px] rounded border border-dashed border-slate-200 bg-slate-50/30 p-2 text-center text-xs text-slate-300">
        —
      </div>
    );
  }
  return (
    <div className="min-h-[80px] rounded border border-slate-200 bg-white p-1.5 shadow-sm">
      <ul className="space-y-1">
        {nodes.map((node) => {
          const color = nodeStateColor(node.state);
          return (
            <li
              key={node.id}
              className={`rounded border px-2 py-1 ${color.bg} ${color.border}`}
              title={`${node.name}${node.description ? ` — ${node.description}` : ""}\n状態: ${color.label}`}
            >
              <div className={`text-xs font-medium ${color.text}`}>
                {node.name}
              </div>
              {node.description ? (
                <div className={`mt-0.5 text-[10px] leading-tight ${color.text} opacity-75`}>
                  {node.description}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
      <p className="mb-2">
        <strong>※ これは仮の体系図</strong>。Phase 5 解体プラン確定後、カリキュラム DB grill (未確定 #2) で構造を本格的に詰めて作り直す予定。
      </p>
      <p className="mb-2">
        AI が「テスト誤答多 / ヒアリングで曖昧」と判定すると <strong className="text-amber-800">黄 (AI つまずき認定)</strong> になる。本人ヒアリング + 親確認を経て <strong className="text-rose-800">赤 (戻り誘導候補)</strong> に進む。最終的に「ここから戻りませんか?」とゆいが提案 → 親と本人の納得を得て再学習プラン生成 (F5 戻り誘導 = 親 OPT-OUT 承認、F4 AI 主導ヒアリング、E6 試験後コーチング駆動振り返り)。
      </p>
      <p>
        プロ野球コーチアナロジー: 打撃の問題は人によって違う。英語は野球より選択肢が決まっているので、体系図さえあれば「ここが問題」と AI が指摘でき、個別の練習プランが組める。
      </p>
    </footer>
  );
}
