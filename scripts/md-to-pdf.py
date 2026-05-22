"""
Markdown ドキュメントを PDF に変換する。
日本語フォントは Windows 標準の Meiryo / Meiryo Bold を使用。

シンプルな Markdown サブセットを解釈:
  - # / ## / ### 見出し
  - 箇条書き (-, *) と番号付きリスト
  - 太字 (**...**)
  - インラインコード (`...`)
  - 引用 (> ...)
  - 水平線 (---)
  - 表 (| ... | ... |)

完璧な変換ではないが、内容は読める形で出力する。
"""

import re
import sys
from pathlib import Path
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ============================================================================
# 日本語フォント登録
# ============================================================================
pdfmetrics.registerFont(TTFont("JP", "C:/Windows/Fonts/meiryo.ttc"))
pdfmetrics.registerFont(TTFont("JP-Bold", "C:/Windows/Fonts/meiryob.ttc"))
pdfmetrics.registerFont(TTFont("JP-Mono", "C:/Windows/Fonts/consola.ttf"))

# ============================================================================
# スタイル定義
# ============================================================================
styles = getSampleStyleSheet()

style_normal = ParagraphStyle(
    "JpNormal",
    parent=styles["Normal"],
    fontName="JP",
    fontSize=10,
    leading=16,
    spaceAfter=4,
)
style_h1 = ParagraphStyle(
    "JpH1",
    parent=styles["Heading1"],
    fontName="JP-Bold",
    fontSize=20,
    leading=28,
    spaceBefore=18,
    spaceAfter=12,
    textColor=colors.HexColor("#1f2937"),
    borderPadding=4,
)
style_h2 = ParagraphStyle(
    "JpH2",
    parent=styles["Heading2"],
    fontName="JP-Bold",
    fontSize=16,
    leading=22,
    spaceBefore=14,
    spaceAfter=8,
    textColor=colors.HexColor("#1f2937"),
)
style_h3 = ParagraphStyle(
    "JpH3",
    parent=styles["Heading3"],
    fontName="JP-Bold",
    fontSize=13,
    leading=18,
    spaceBefore=10,
    spaceAfter=6,
    textColor=colors.HexColor("#374151"),
)
style_h4 = ParagraphStyle(
    "JpH4",
    parent=styles["Heading4"],
    fontName="JP-Bold",
    fontSize=11,
    leading=16,
    spaceBefore=8,
    spaceAfter=4,
)
style_list = ParagraphStyle(
    "JpList",
    parent=style_normal,
    leftIndent=18,
    bulletIndent=6,
    spaceAfter=2,
)
style_quote = ParagraphStyle(
    "JpQuote",
    parent=style_normal,
    leftIndent=20,
    borderColor=colors.HexColor("#6366f1"),
    borderPadding=6,
    backColor=colors.HexColor("#f3f4f6"),
    textColor=colors.HexColor("#4b5563"),
)


# ============================================================================
# Markdown 行 → ReportLab Flowables 変換
# ============================================================================
INLINE_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
INLINE_CODE_RE = re.compile(r"`([^`]+)`")


def inline_format(text: str) -> str:
    """インラインの装飾を ReportLab Paragraph 用 HTML に変換"""
    text = escape(text)
    # コードを先に処理（太字より優先）
    text = INLINE_CODE_RE.sub(
        r'<font name="JP-Mono" backColor="#f3f4f6">\1</font>', text
    )
    text = INLINE_BOLD_RE.sub(r"<b>\1</b>", text)
    return text


def is_table_row(line: str) -> bool:
    s = line.strip()
    return s.startswith("|") and s.endswith("|") and s.count("|") >= 2


def is_table_separator(line: str) -> bool:
    s = line.strip()
    if not is_table_row(s):
        return False
    cells = [c.strip() for c in s.strip("|").split("|")]
    return all(re.match(r"^:?-+:?$", c) for c in cells)


def parse_table_row(line: str) -> list[str]:
    s = line.strip().strip("|")
    return [c.strip() for c in s.split("|")]


def md_to_flowables(md_text: str) -> list:
    """Markdown を ReportLab Flowables のリストに変換"""
    lines = md_text.splitlines()
    flowables: list = []
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip()

        # 空行
        if not stripped.strip():
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        # 水平線
        if re.match(r"^\s*-{3,}\s*$", stripped):
            flowables.append(
                HRFlowable(
                    width="100%",
                    thickness=0.5,
                    color=colors.HexColor("#d1d5db"),
                    spaceBefore=6,
                    spaceAfter=6,
                )
            )
            i += 1
            continue

        # 見出し
        if stripped.startswith("# "):
            flowables.append(Paragraph(inline_format(stripped[2:]), style_h1))
            i += 1
            continue
        if stripped.startswith("## "):
            flowables.append(Paragraph(inline_format(stripped[3:]), style_h2))
            i += 1
            continue
        if stripped.startswith("### "):
            flowables.append(Paragraph(inline_format(stripped[4:]), style_h3))
            i += 1
            continue
        if stripped.startswith("#### "):
            flowables.append(Paragraph(inline_format(stripped[5:]), style_h4))
            i += 1
            continue

        # テーブル（| ... | ... | 形式）
        if is_table_row(stripped):
            table_lines = []
            j = i
            while j < len(lines) and is_table_row(lines[j].rstrip()):
                table_lines.append(lines[j].rstrip())
                j += 1
            if (
                len(table_lines) >= 2
                and is_table_separator(table_lines[1])
            ):
                header = parse_table_row(table_lines[0])
                body_lines = table_lines[2:]
                rows = [header] + [parse_table_row(b) for b in body_lines]
                # Paragraph 化（折り返し可能）
                wrapped = [
                    [Paragraph(inline_format(c), style_normal) for c in row]
                    for row in rows
                ]
                tbl = Table(wrapped, repeatRows=1, hAlign="LEFT")
                tbl.setStyle(
                    TableStyle(
                        [
                            ("FONTNAME", (0, 0), (-1, -1), "JP"),
                            ("FONTSIZE", (0, 0), (-1, -1), 9),
                            (
                                "BACKGROUND",
                                (0, 0),
                                (-1, 0),
                                colors.HexColor("#f3f4f6"),
                            ),
                            ("FONTNAME", (0, 0), (-1, 0), "JP-Bold"),
                            (
                                "GRID",
                                (0, 0),
                                (-1, -1),
                                0.25,
                                colors.HexColor("#d1d5db"),
                            ),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 4),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                            ("TOPPADDING", (0, 0), (-1, -1), 3),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ]
                    )
                )
                flowables.append(tbl)
                flowables.append(Spacer(1, 6))
                i = j
                continue

        # 引用
        if stripped.startswith("> "):
            quote_lines = []
            while i < len(lines) and lines[i].rstrip().startswith("> "):
                quote_lines.append(lines[i].rstrip()[2:])
                i += 1
            flowables.append(
                Paragraph(
                    inline_format("\n".join(quote_lines).replace("\n", "<br/>")),
                    style_quote,
                )
            )
            continue

        # 箇条書き (-, *)
        m = re.match(r"^(\s*)([-*])\s+(.+)$", stripped)
        if m:
            indent_chars = len(m.group(1))
            indent = max(0, indent_chars // 2) * 12
            text = m.group(3)
            flowables.append(
                Paragraph(
                    f"• {inline_format(text)}",
                    ParagraphStyle(
                        "li", parent=style_list, leftIndent=18 + indent
                    ),
                )
            )
            i += 1
            continue

        # 番号付きリスト
        m = re.match(r"^(\s*)(\d+)\.\s+(.+)$", stripped)
        if m:
            indent_chars = len(m.group(1))
            indent = max(0, indent_chars // 2) * 12
            num = m.group(2)
            text = m.group(3)
            flowables.append(
                Paragraph(
                    f"{num}. {inline_format(text)}",
                    ParagraphStyle(
                        "ol", parent=style_list, leftIndent=18 + indent
                    ),
                )
            )
            i += 1
            continue

        # 通常段落
        flowables.append(Paragraph(inline_format(stripped), style_normal))
        i += 1

    return flowables


def md_to_pdf(md_path: Path, pdf_path: Path):
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    with md_path.open(encoding="utf-8") as f:
        md_text = f.read()

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=md_path.stem,
    )
    story = md_to_flowables(md_text)
    doc.build(story)
    print(f"[OK] {md_path.name} -> {pdf_path}")


# ============================================================================
# メイン
# ============================================================================
def main():
    project_root = Path(r"C:\dev\projects\home\Ai-Education")
    plan_root = Path(r"C:\Users\ito19\.claude\plans")
    out_dir = project_root / "docs"

    targets = [
        (project_root / "PHILOSOPHY.md", out_dir / "PHILOSOPHY.pdf"),
        (project_root / "README.md", out_dir / "README.pdf"),
        (
            plan_root / "home-ai-educarion-merry-kazoo.md",
            out_dir / "Project-Plan.pdf",
        ),
    ]

    for md, pdf in targets:
        if not md.exists():
            print(f"[NG] {md} not found", file=sys.stderr)
            continue
        md_to_pdf(md, pdf)

    print(f"\n出力先: {out_dir}")


if __name__ == "__main__":
    main()
