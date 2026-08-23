const PDFDocument = require("pdfkit");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle
} = require("docx");
const { renderMetricChart, seriesColor } = require("./chart.service");

/**
 * Report documents.
 *
 * Both formats render from one intermediate model built by buildModel(), so a
 * change to the report's shape lands in the PDF and the DOCX together instead
 * of drifting between two hand-maintained layouts.
 */

function fmt(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function fmtPct(value) {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

function fmtDate(value) {
  return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function safeRange(threshold, unit) {
  if (!threshold) return "not set";
  const suffix = unit ? ` ${unit}` : "";
  return `${fmt(threshold.safeMin, 1)} – ${fmt(threshold.safeMax, 1)}${suffix}`;
}

const STAT_COLUMNS = [
  { key: "metric", header: "Metric", width: 104, align: "left" },
  { key: "mean", header: "Mean", width: 62, align: "right" },
  { key: "min", header: "Min", width: 62, align: "right" },
  { key: "max", header: "Max", width: 62, align: "right" },
  { key: "count", header: "Readings", width: 66, align: "right" },
  { key: "breach", header: "Breach", width: 56, align: "right" },
  { key: "safe", header: "Safe range", width: 87, align: "left" }
];

const COMPARE_COLUMNS = [
  { key: "plant", header: "Plant", width: 150, align: "left" },
  { key: "mean", header: "Mean", width: 70, align: "right" },
  { key: "min", header: "Min", width: 70, align: "right" },
  { key: "max", header: "Max", width: 70, align: "right" },
  { key: "count", header: "Readings", width: 70, align: "right" },
  { key: "breach", header: "Breach", width: 69, align: "right" }
];

function statRows(report, stats) {
  return report.metrics.map((metric) => {
    const s = stats[metric.key] || {};
    return {
      metric: metric.unit ? `${metric.label} (${metric.unit})` : metric.label,
      mean: fmt(s.mean),
      min: fmt(s.min),
      max: fmt(s.max),
      count: String(s.count ?? 0),
      breach: fmtPct(s.breachPct),
      safe: safeRange(s.threshold, metric.unit)
    };
  });
}

function chartBlock(title, series, threshold, legend) {
  const png = renderMetricChart({ series, threshold });
  if (!png) return null;
  return { type: "chart", title, png, legend: legend || null };
}

function scopeLine(report) {
  if (report.scope.allPlants) return `All plants (${report.scope.plantCount})`;
  const names = report.scope.plants.map((p) => p.name);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

const MODE_LABEL = {
  aggregate: "Network average",
  individual: "Individual plants",
  comparison: "Plant comparison"
};

function buildModel(report) {
  const blocks = [];

  if (report.mode === "aggregate") {
    blocks.push({ type: "heading", text: "Network average" });
    blocks.push({
      type: "note",
      text:
        report.scope.allPlants
          ? "Mean of every water-quality reading across all plants in the range."
          : "Mean of every water-quality reading across the selected plants."
    });
    blocks.push({ type: "table", columns: STAT_COLUMNS, rows: statRows(report, report.aggregate.stats) });

    for (const metric of report.metrics) {
      const block = chartBlock(
        metric.unit ? `${metric.label} (${metric.unit})` : metric.label,
        [{ points: report.aggregate.series.map((p) => ({ ts: p.ts, value: p[metric.key] })) }],
        report.aggregate.stats[metric.key]?.threshold
      );
      if (block) blocks.push(block);
    }
  }

  if (report.mode === "individual") {
    for (const entry of report.perPlant) {
      blocks.push({ type: "heading", text: entry.plant.name });
      if (entry.plant.address) blocks.push({ type: "note", text: entry.plant.address });
      blocks.push({ type: "table", columns: STAT_COLUMNS, rows: statRows(report, entry.stats) });

      for (const metric of report.metrics) {
        const block = chartBlock(
          metric.unit ? `${metric.label} (${metric.unit})` : metric.label,
          [{ points: entry.series.map((p) => ({ ts: p.ts, value: p[metric.key] })) }],
          entry.stats[metric.key]?.threshold
        );
        if (block) blocks.push(block);
      }
    }
  }

  if (report.mode === "comparison") {
    const legend = report.perPlant.map((entry, i) => ({
      label: entry.plant.name,
      color: seriesColor(i)
    }));

    for (const metric of report.metrics) {
      blocks.push({
        type: "heading",
        text: metric.unit ? `${metric.label} (${metric.unit})` : metric.label
      });
      blocks.push({
        type: "table",
        columns: COMPARE_COLUMNS,
        rows: report.perPlant.map((entry) => {
          const s = entry.stats[metric.key] || {};
          return {
            plant: entry.plant.name,
            mean: fmt(s.mean),
            min: fmt(s.min),
            max: fmt(s.max),
            count: String(s.count ?? 0),
            breach: fmtPct(s.breachPct)
          };
        })
      });

      // Every plant on one axis — the point of a comparison is reading them
      // against each other, not flipping between charts.
      const block = chartBlock(
        null,
        report.perPlant.map((entry, i) => ({
          color: seriesColor(i),
          points: entry.series.map((p) => ({ ts: p.ts, value: p[metric.key] }))
        })),
        report.perPlant[0]?.stats[metric.key]?.threshold,
        legend
      );
      if (block) blocks.push(block);
    }
  }

  return {
    title: "Water Quality Report",
    meta: [
      `Scope: ${scopeLine(report)}`,
      // En dash, not an arrow: pdfkit's built-in Helvetica is WinAnsi, which has
      // no U+2192 and silently mangles it into two wrong glyphs.
      `Period: ${report.range.label} (${fmtDate(report.range.from)} – ${fmtDate(report.range.to)})`,
      `View: ${MODE_LABEL[report.mode] || report.mode}`,
      `Generated: ${fmtDate(report.generatedAt)}`
    ],
    blocks,
    empty: blocks.length === 0
  };
}

function filenameFor(report, extension) {
  const scope = report.scope.allPlants
    ? "all-plants"
    : report.scope.plants.length === 1
    ? report.scope.plants[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : `${report.scope.plants.length}-plants`;
  const date = new Date(report.generatedAt).toISOString().slice(0, 10);
  return `waternet-quality-${scope}-${report.range.key}-${date}.${extension}`;
}

/* ------------------------------------------------------------------ PDF -- */

const PDF_MARGIN = 48;
const RGB_INK = "#0f172a";
const RGB_MUTED = "#64748b";
const RGB_LINE = "#e2e8f0";
const RGB_HEAD = "#f1f5f9";

function ensureSpace(doc, needed) {
  const limit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > limit) doc.addPage();
}

function drawTable(doc, columns, rows) {
  const rowHeight = 20;
  ensureSpace(doc, rowHeight * Math.min(rows.length + 1, 4));

  const startX = doc.page.margins.left;
  let y = doc.y;

  const header = () => {
    doc.rect(startX, y, columns.reduce((s, c) => s + c.width, 0), rowHeight).fill(RGB_HEAD);
    doc.fillColor(RGB_MUTED).font("Helvetica-Bold").fontSize(8);
    let x = startX;
    for (const col of columns) {
      doc.text(col.header.toUpperCase(), x + 6, y + 6, {
        width: col.width - 12,
        align: col.align,
        lineBreak: false
      });
      x += col.width;
    }
    y += rowHeight;
  };

  header();
  doc.font("Helvetica").fontSize(9);

  for (const row of rows) {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.y;
      header();
      doc.font("Helvetica").fontSize(9);
    }
    let x = startX;
    for (const col of columns) {
      doc.fillColor(RGB_INK).text(String(row[col.key] ?? ""), x + 6, y + 6, {
        width: col.width - 12,
        align: col.align,
        lineBreak: false
      });
      x += col.width;
    }
    y += rowHeight;
    doc
      .moveTo(startX, y)
      .lineTo(startX + columns.reduce((s, c) => s + c.width, 0), y)
      .strokeColor(RGB_LINE)
      .lineWidth(0.5)
      .stroke();
  }

  doc.y = y + 12;
  doc.x = startX;
}

function drawLegend(doc, legend) {
  doc.font("Helvetica").fontSize(8).fillColor(RGB_MUTED);
  let x = doc.page.margins.left;
  const y = doc.y;
  for (const item of legend) {
    const [r, g, b] = item.color;
    doc.rect(x, y + 2, 8, 8).fill(`rgb(${r},${g},${b})`);
    doc.fillColor(RGB_MUTED).text(item.label, x + 12, y, { lineBreak: false });
    x += 12 + doc.widthOfString(item.label) + 16;
  }
  doc.y = y + 16;
  doc.x = doc.page.margins.left;
}

async function renderPdf(report) {
  const model = buildModel(report);
  const doc = new PDFDocument({ size: "A4", margin: PDF_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const contentWidth = doc.page.width - PDF_MARGIN * 2;

  doc.font("Helvetica-Bold").fontSize(20).fillColor(RGB_INK).text(model.title);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9).fillColor(RGB_MUTED);
  for (const line of model.meta) doc.text(line);
  doc.moveDown(0.6);
  doc
    .moveTo(PDF_MARGIN, doc.y)
    .lineTo(doc.page.width - PDF_MARGIN, doc.y)
    .strokeColor(RGB_LINE)
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.8);

  if (model.empty) {
    doc.font("Helvetica").fontSize(11).fillColor(RGB_MUTED).text("No readings in this period.");
  }

  for (const block of model.blocks) {
    if (block.type === "heading") {
      ensureSpace(doc, 60);
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(RGB_INK).text(block.text);
      doc.moveDown(0.3);
    } else if (block.type === "note") {
      doc.font("Helvetica").fontSize(9).fillColor(RGB_MUTED).text(block.text);
      doc.moveDown(0.4);
    } else if (block.type === "table") {
      drawTable(doc, block.columns, block.rows);
    } else if (block.type === "chart") {
      const imageHeight = contentWidth * 0.32;
      ensureSpace(doc, imageHeight + (block.title ? 18 : 0) + (block.legend ? 18 : 0) + 12);
      if (block.title) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(RGB_INK).text(block.title);
        doc.moveDown(0.2);
      }
      doc.image(block.png, PDF_MARGIN, doc.y, { width: contentWidth });
      doc.y += imageHeight + 8;
      doc.x = PDF_MARGIN;
      if (block.legend) drawLegend(doc, block.legend);
      doc.moveDown(0.4);
    }
  }

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(RGB_MUTED)
      .text(
        `WaterNet · page ${i + 1} of ${pages.count}`,
        PDF_MARGIN,
        doc.page.height - PDF_MARGIN + 12,
        { width: contentWidth, align: "center", lineBreak: false }
      );
  }

  doc.end();
  return { buffer: await done, filename: filenameFor(report, "pdf"), contentType: "application/pdf" };
}

/* ----------------------------------------------------------------- DOCX -- */

const DOCX_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" };
const DOCX_BORDERS = {
  top: DOCX_BORDER,
  bottom: DOCX_BORDER,
  left: DOCX_BORDER,
  right: DOCX_BORDER,
  insideHorizontal: DOCX_BORDER,
  insideVertical: DOCX_BORDER
};

function docxCell(text, { bold = false, align = "left", shaded = false } = {}) {
  return new TableCell({
    shading: shaded ? { fill: "F1F5F9" } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [
      new Paragraph({
        alignment: align === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: String(text ?? ""), bold, size: 18 })]
      })
    ]
  });
}

function docxTable(columns, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: DOCX_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map((c) =>
          docxCell(c.header.toUpperCase(), { bold: true, align: c.align, shaded: true })
        )
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: columns.map((c) => docxCell(row[c.key], { align: c.align }))
          })
      )
    ]
  });
}

async function renderDocx(report) {
  const model = buildModel(report);
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: model.title, bold: true, size: 40 })]
    }),
    ...model.meta.map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 18, color: "64748B" })]
        })
    ),
    new Paragraph({ text: "" })
  ];

  if (model.empty) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: "No readings in this period.", size: 20 })] })
    );
  }

  for (const block of model.blocks) {
    if (block.type === "heading") {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: block.text, bold: true, size: 26 })]
        })
      );
    } else if (block.type === "note") {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: block.text, size: 18, color: "64748B" })]
        })
      );
    } else if (block.type === "table") {
      children.push(docxTable(block.columns, block.rows));
      children.push(new Paragraph({ text: "" }));
    } else if (block.type === "chart") {
      if (block.title) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [new TextRun({ text: block.title, bold: true, size: 20 })]
          })
        );
      }
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: "png",
              data: block.png,
              transformation: { width: 600, height: 192 }
            })
          ]
        })
      );
      if (block.legend) {
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: block.legend.flatMap((item, i) => {
              const hex = item.color.map((c) => c.toString(16).padStart(2, "0")).join("");
              return [
                new TextRun({ text: i === 0 ? "" : "    " }),
                new TextRun({ text: "■ ", color: hex, size: 18 }),
                new TextRun({ text: item.label, size: 18, color: "64748B" })
              ];
            })
          })
        );
      }
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return {
    buffer,
    filename: filenameFor(report, "docx"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
}

module.exports = { renderPdf, renderDocx, buildModel };
