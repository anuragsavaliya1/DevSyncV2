/** Download holiday month calendar as a PNG (canvas draw — no extra deps). */
import {
  buildCalendarGrid,
  isIndiaWeekend,
} from "@/lib/attendance-month";

type HolidayChip = {
  date: string;
  name: string;
  kind: "holiday" | "weekoff";
};

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Prefer drawing from data so export matches holiday/Sunday/week-off highlights
 * even when Tailwind styles are not available to html-to-image style capture.
 */
export async function downloadHolidayCalendarImage(input: {
  monthKey: string;
  holidays: HolidayChip[];
  fileName?: string;
}) {
  const cells = buildCalendarGrid(input.monthKey);
  const holidayByDate = new Map(input.holidays.map((h) => [h.date, h]));
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const pad = 28;
  const colGap = 8;
  const rowGap = 8;
  const colW = 118;
  const rowH = 108;
  const headerH = 72;
  const weekdayH = 22;
  const cols = 7;
  const rows = Math.ceil(cells.length / 7);
  const gridW = cols * colW + (cols - 1) * colGap;
  const gridH = rows * rowH + (rows - 1) * rowGap;
  const width = pad * 2 + gridW;
  const height = pad * 2 + headerH + weekdayH + gridH + 16;

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create calendar image.");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#294354";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText("Holiday calendar", pad, pad + 18);
  ctx.fillStyle = "#8B9BA6";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillText(
    `Sundays, week offs, and holidays · ${monthTitle(input.monthKey)}`,
    pad,
    pad + 38,
  );

  // Legend
  const legendY = pad + 52;
  roundRect(ctx, pad, legendY, 118, 18, 9);
  ctx.fillStyle = "#FFF5F4";
  ctx.fill();
  ctx.strokeStyle = "#F0C9C4";
  ctx.stroke();
  ctx.fillStyle = "#A64D43";
  ctx.font = "700 9px system-ui, sans-serif";
  ctx.fillText("SUNDAY / WEEK OFF", pad + 10, legendY + 12);

  roundRect(ctx, pad + 128, legendY, 78, 18, 9);
  ctx.fillStyle = "#FFF6E8";
  ctx.fill();
  ctx.strokeStyle = "#F0C98A";
  ctx.stroke();
  ctx.fillStyle = "#9A5B1F";
  ctx.fillText("HOLIDAY", pad + 138, legendY + 12);

  const gridTop = pad + headerH;
  weekdays.forEach((day, index) => {
    const x = pad + index * (colW + colGap) + colW / 2;
    ctx.fillStyle = day === "Sun" ? "#A64D43" : "#8B9BA6";
    ctx.font = "700 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(day.toUpperCase(), x, gridTop + 12);
  });
  ctx.textAlign = "left";

  cells.forEach((cell, index) => {
    const col = index % 7;
    const row = Math.floor(index / 7);
    const x = pad + col * (colW + colGap);
    const y = gridTop + weekdayH + row * (rowH + rowGap);
    const holiday = holidayByDate.get(cell.date) ?? null;
    const isSunday = isIndiaWeekend(cell.date);

    let fill = "#FBFCFD";
    let stroke = "#EEF3F5";
    let dayColor = cell.inMonth ? "#294354" : "#B7C4CC";
    if (isSunday || holiday?.kind === "weekoff") {
      fill = "#FFF5F4";
      stroke = "#F0C9C4";
      if (cell.inMonth) dayColor = "#A64D43";
    } else if (holiday?.kind === "holiday") {
      fill = "#FFF6E8";
      stroke = "#F0C98A";
      if (cell.inMonth) dayColor = "#9A5B1F";
    }

    roundRect(ctx, x, y, colW, rowH, 12);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!cell.inMonth) {
      ctx.globalAlpha = 0.45;
    }

    const dayNum = Number(cell.date.slice(8, 10));
    ctx.fillStyle = dayColor;
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillText(String(dayNum), x + 8, y + 18);

    let chipY = y + 28;
    if (isSunday) {
      roundRect(ctx, x + 6, chipY, colW - 12, 16, 4);
      ctx.fillStyle = "#FFF1EF";
      ctx.fill();
      ctx.fillStyle = "#A64D43";
      ctx.font = "700 9px system-ui, sans-serif";
      ctx.fillText("Sunday", x + 10, chipY + 11);
      chipY += 20;
    } else if (holiday?.kind === "weekoff") {
      roundRect(ctx, x + 6, chipY, colW - 12, 16, 4);
      ctx.fillStyle = "#FFF1EF";
      ctx.fill();
      ctx.fillStyle = "#A64D43";
      ctx.font = "700 9px system-ui, sans-serif";
      const label = (holiday.name || "Week off").slice(0, 14);
      ctx.fillText(label, x + 10, chipY + 11);
      chipY += 20;
    } else if (holiday?.kind === "holiday") {
      roundRect(ctx, x + 6, chipY, colW - 12, 16, 4);
      ctx.fillStyle = "#FFE9C9";
      ctx.fill();
      ctx.fillStyle = "#9A5B1F";
      ctx.font = "700 9px system-ui, sans-serif";
      const label = (holiday.name || "Holiday").slice(0, 14);
      ctx.fillText(label, x + 10, chipY + 11);
    }

    ctx.globalAlpha = 1;
  });

  const fileName =
    input.fileName || `devsync-holiday-calendar-${input.monthKey}.png`;

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not create calendar image."));
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}
