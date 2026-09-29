"""File writers for exporting query results: delimited text and Excel (.xlsx).

The .xlsx writer uses only the standard library (zipfile + hand-written
SpreadsheetML), so exporting doesn't add a dependency that would also have
to be installed on the server.
"""

import io
import re
import zipfile
from xml.sax.saxutils import escape

XLSX_MIMETYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_EXCEL_COLUMNS = 16384
MAX_EXCEL_CELL_CHARS = 32767
# Excel stores numbers as IEEE doubles: integers beyond 2**53 would be
# silently rounded, so those are written as text instead.
MAX_SAFE_INT = 2**53

_ILLEGAL_XML_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")
# Leading characters that make spreadsheet apps treat a text cell as a formula.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def neutralize_formula(value):
    """Prefix text that would be read as a formula with a single quote."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


# --- Delimited text --------------------------------------------------------


def _text_cell(value, delimiter):
    if value is None:
        return ""
    text = str(value)
    if delimiter in text or '"' in text or "\n" in text or "\r" in text:
        return '"' + text.replace('"', '""') + '"'
    return text


def build_text(columns, rows, delimiter, header=True, formula_safe=True):
    """Delimited text, UTF-8, one record per line. Fields are quoted only
    when they contain the delimiter, a quote or a line break. The delimiter
    may be several characters long (the csv module only allows one)."""
    prep = neutralize_formula if formula_safe else (lambda v: v)
    lines = []
    if header:
        lines.append(delimiter.join(_text_cell(prep(c), delimiter) for c in columns))
    for row in rows:
        lines.append(delimiter.join(_text_cell(prep(v), delimiter) for v in row))
    return ("\r\n".join(lines) + "\r\n").encode("utf-8") if lines else b""


# --- Excel -----------------------------------------------------------------


def _col_letter(index):
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def _clean(text):
    return escape(_ILLEGAL_XML_CHARS.sub("", text)[:MAX_EXCEL_CELL_CHARS])


def _xlsx_cell(ref, value, style=None):
    s = f' s="{style}"' if style else ""
    if value is None:
        return ""
    if isinstance(value, bool):
        return f'<c r="{ref}"{s} t="b"><v>{int(value)}</v></c>'
    if isinstance(value, int) and abs(value) < MAX_SAFE_INT:
        return f'<c r="{ref}"{s}><v>{value}</v></c>'
    if isinstance(value, float) and value == value and abs(value) != float("inf"):
        return f'<c r="{ref}"{s}><v>{value!r}</v></c>'
    return f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{_clean(str(value))}</t></is></c>'


def _column_widths(columns, rows):
    widths = [len(str(c)) for c in columns]
    for row in rows:
        for i, v in enumerate(row):
            if v is not None:
                n = len(str(v))
                if n > widths[i]:
                    widths[i] = n
    # Roughly one width unit per character, within a readable range.
    return [min(max(w + 2, 8), 60) for w in widths]


_CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    "</Types>"
)
_ROOT_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    "</Relationships>"
)
_WORKBOOK_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    "</Relationships>"
)
# Style 0 = default, style 1 = bold header with a light grey fill.
_STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    '<fills count="3"><fill><patternFill patternType="none"/></fill>'
    '<fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F7"/><bgColor indexed="64"/></patternFill></fill></fills>'
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    "</styleSheet>"
)


def _sheet_title(title):
    # Excel forbids these characters and caps sheet names at 31 characters.
    cleaned = re.sub(r"[\[\]:*?/\\]", " ", title or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()[:31]
    return cleaned or "Hasil Query"


def build_xlsx(columns, rows, sheet_title="Hasil Query"):
    """A single-sheet workbook: bold, frozen header row and sized columns.
    Numbers stay numeric, NULL stays an empty cell, text is never parsed as
    a formula (it is stored as a string)."""
    if len(columns) > MAX_EXCEL_COLUMNS:
        raise ValueError(f"Excel maksimal {MAX_EXCEL_COLUMNS} kolom")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _CONTENT_TYPES)
        zf.writestr("_rels/.rels", _ROOT_RELS)
        zf.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheets><sheet name="{escape(_sheet_title(sheet_title), {chr(34): "&quot;"})}" sheetId="1" r:id="rId1"/></sheets>'
            "</workbook>",
        )
        zf.writestr("xl/_rels/workbook.xml.rels", _WORKBOOK_RELS)
        zf.writestr("xl/styles.xml", _STYLES)

        with zf.open("xl/worksheets/sheet1.xml", "w") as sheet:
            w = lambda s: sheet.write(s.encode("utf-8"))
            w(
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                f'<dimension ref="A1:{_col_letter(max(len(columns), 1) - 1)}{len(rows) + 1}"/>'
                '<sheetViews><sheetView workbookViewId="0">'
                '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
                "</sheetView></sheetViews>"
            )
            if columns:
                w("<cols>")
                for i, width in enumerate(_column_widths(columns, rows), start=1):
                    w(f'<col min="{i}" max="{i}" width="{width}" customWidth="1"/>')
                w("</cols>")
            w("<sheetData>")
            w(
                '<row r="1">'
                + "".join(_xlsx_cell(f"{_col_letter(i)}1", str(c), style=1) for i, c in enumerate(columns))
                + "</row>"
            )
            for r, row in enumerate(rows, start=2):
                cells = "".join(_xlsx_cell(f"{_col_letter(i)}{r}", v) for i, v in enumerate(row))
                w(f'<row r="{r}">{cells}</row>')
            w("</sheetData></worksheet>")
    return buffer.getvalue()
