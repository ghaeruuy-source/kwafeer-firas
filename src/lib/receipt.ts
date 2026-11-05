import "server-only";
import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { formatDuration, formatInstantDate, formatInstantTime, formatPhonePlain } from "@/lib/format";
import { SHOP_TZ } from "@/lib/time";
import type { BookingStatus } from "@/lib/types";

/** Everything the receipt shows. Optional fields are simply left out when missing. */
export interface ReceiptData {
  copy: "barber" | "customer";
  code: string;
  status: BookingStatus;
  starts_at: string;
  price_iqd: number;
  customer_name: string;
  customer_phone?: string | null;
  service_name: string;
  barber_name: string;
  duration_minutes?: number | null;
  customer_note?: string | null;
  visit_number?: number | null;
  shop_name?: string | null;
  timezone?: string | null;
  issued_at?: string | null;
}

const ROOT = process.cwd();
const FONT_DIR = path.join(ROOT, "src/assets/fonts");
const LOGO = path.join(ROOT, "public/logo.png");

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  GlobalFonts.registerFromPath(path.join(FONT_DIR, "Amiri-Bold.ttf"), "RcptSerif");
  GlobalFonts.registerFromPath(path.join(FONT_DIR, "Readex-Regular.ttf"), "RcptSans");
  GlobalFonts.registerFromPath(path.join(FONT_DIR, "Readex-SemiBold.ttf"), "RcptSansBold");
  fontsReady = true;
}

const C = {
  bg: "#081d17",
  ink: "#0d2a22",
  coal: "#12352b",
  bone: "#efe9db",
  mute: "#a7b8ae",
  faint: "#7f978a",
  gold: "#c89b5a",
  goldLight: "#e7c88e",
  goldDeep: "#8a6430",
  red: "#e07a6a",
};

const W = 1080;
const PAD = 70; // card inset from the canvas edge
const IN = 70; // text inset inside the card

export async function renderReceipt(d: ReceiptData): Promise<Buffer> {
  ensureFonts();
  const tz = d.timezone || SHOP_TZ;
  const cancelled = d.status === "cancelled";

  const rows: [string, string, "rtl" | "ltr"][] = [["الزبون", d.customer_name, "rtl"]];
  if (d.customer_phone) rows.push(["الموبايل", formatPhonePlain(d.customer_phone), "ltr"]);
  rows.push(["الخدمة", d.service_name, "rtl"]);
  rows.push(["الحلاق", d.barber_name, "rtl"]);
  rows.push(["اليوم", formatInstantDate(d.starts_at, tz), "rtl"]);
  rows.push(["الساعة", formatInstantTime(d.starts_at, tz), "rtl"]);
  if (d.duration_minutes) rows.push(["المدة", formatDuration(d.duration_minutes), "rtl"]);
  if (d.visit_number && d.visit_number > 0) rows.push(["الزيارة", d.visit_number === 1 ? "أول زيارة" : `رقم ${d.visit_number}`, "rtl"]);

  const ROW_H = 84;
  const noteH = d.customer_note ? 130 : 0;
  const H = 1330 + rows.length * ROW_H + noteH;

  const canvas = createCanvas(W, H);
  const x = canvas.getContext("2d");

  // backdrop
  x.fillStyle = C.bg;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 0, 50, W / 2, 0, W);
  glow.addColorStop(0, "rgba(200,155,90,0.18)");
  glow.addColorStop(1, "rgba(200,155,90,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);

  // card body (gold rim, emerald fill, torn bottom edge like a printed receipt)
  const top = PAD;
  const bottom = H - PAD;
  const left = PAD;
  const right = W - PAD;
  const tearY = bottom - 18;
  const cardPath = () => {
    x.beginPath();
    x.moveTo(left + 36, top);
    x.lineTo(right - 36, top);
    x.quadraticCurveTo(right, top, right, top + 36);
    x.lineTo(right, tearY);
    const teeth = 26;
    const step = (right - left) / teeth;
    for (let i = 0; i < teeth; i++) {
      const xa = right - i * step;
      x.lineTo(xa - step / 2, bottom);
      x.lineTo(xa - step, tearY);
    }
    x.lineTo(left, top + 36);
    x.quadraticCurveTo(left, top, left + 36, top);
    x.closePath();
  };
  x.save();
  x.shadowColor = "rgba(0,0,0,0.6)";
  x.shadowBlur = 50;
  x.shadowOffsetY = 20;
  cardPath();
  const fill = x.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, "#174235");
  fill.addColorStop(0.45, C.ink);
  fill.addColorStop(1, "#0a221b");
  x.fillStyle = fill;
  x.fill();
  x.restore();
  cardPath();
  x.lineWidth = 4;
  x.strokeStyle = goldGrad(x, left, right);
  x.stroke();
  // inner hairline frame
  x.strokeStyle = "rgba(200,155,90,0.35)";
  x.lineWidth = 1.5;
  roundRect(x, left + 18, top + 18, right - left - 36, tearY - top - 40, 22);
  x.stroke();

  // baroque corner flourishes
  flourish(x, left + 18, top + 18, 1, 1);
  flourish(x, right - 18, top + 18, -1, 1);

  // logo
  const cx = W / 2;
  let y = top + 70;
  try {
    const logo = await loadImage(LOGO);
    const s = 190;
    x.save();
    x.beginPath();
    x.arc(cx, y + s / 2, s / 2 + 8, 0, Math.PI * 2);
    x.fillStyle = goldGrad(x, cx - s / 2, cx + s / 2);
    x.fill();
    x.beginPath();
    x.arc(cx, y + s / 2, s / 2, 0, Math.PI * 2);
    x.fillStyle = C.ink;
    x.fill();
    x.clip();
    x.drawImage(logo, cx - s / 2, y, s, s);
    x.restore();
    y += s + 40;
  } catch {
    y += 40;
  }

  // shop name + caption
  text(x, d.shop_name || "فراس اوباما", cx, y + 60, { font: "72px RcptSerif", color: C.goldLight, align: "center" });
  y += 110;
  text(x, d.copy === "barber" ? "وصل حجز · نسخة الحلاق" : "وصل حجز · نسخة الزبون", cx, y + 10, {
    font: "30px RcptSans", color: C.mute, align: "center",
  });
  ornamentLine(x, cx, y + 50);
  y += 100;

  // status badge
  const label = cancelled ? "انلغى الحجز" : d.copy === "barber" ? "حجز جديد عندك" : d.status === "confirmed" ? "تم تأكيد الحجز" : "وصل الحجز للصالون";
  x.font = "34px RcptSansBold";
  const bw = x.measureText(label).width + 120;
  roundRect(x, cx - bw / 2, y, bw, 76, 38);
  x.fillStyle = cancelled ? "rgba(224,122,106,0.14)" : "rgba(200,155,90,0.14)";
  x.fill();
  x.strokeStyle = cancelled ? C.red : C.gold;
  x.lineWidth = 2;
  x.stroke();
  // tick / cross circle on the right side of the badge
  const ix = cx + bw / 2 - 44;
  const iy = y + 38;
  x.beginPath();
  x.arc(ix, iy, 20, 0, Math.PI * 2);
  x.fillStyle = cancelled ? C.red : C.gold;
  x.fill();
  x.strokeStyle = C.ink;
  x.lineWidth = 4.5;
  x.lineCap = "round";
  x.beginPath();
  if (cancelled) {
    x.moveTo(ix - 8, iy - 8); x.lineTo(ix + 8, iy + 8);
    x.moveTo(ix + 8, iy - 8); x.lineTo(ix - 8, iy + 8);
  } else {
    x.moveTo(ix - 9, iy + 1); x.lineTo(ix - 2, iy + 8); x.lineTo(ix + 10, iy - 7);
  }
  x.stroke();
  text(x, label, cx - 18, y + 51, { font: "34px RcptSansBold", color: cancelled ? C.red : C.goldLight, align: "center" });
  y += 130;

  // amount
  text(x, "المبلغ", cx, y, { font: "28px RcptSans", color: C.faint, align: "center" });
  const amount = new Intl.NumberFormat("en-US").format(d.price_iqd);
  x.font = "110px RcptSansBold";
  const aw = x.measureText(amount).width;
  x.font = "40px RcptSans";
  const cw = x.measureText("د.ع").width;
  const total = aw + 18 + cw;
  text(x, amount, cx + total / 2 - aw, y + 120, { font: "110px RcptSansBold", color: C.bone, align: "left", dir: "ltr" });
  text(x, "د.ع", cx - total / 2, y + 120, { font: "40px RcptSans", color: C.gold, align: "left" });
  if (cancelled) {
    x.strokeStyle = C.red;
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(cx - total / 2 - 10, y + 85);
    x.lineTo(cx + total / 2 + 10, y + 85);
    x.stroke();
  }
  y += 175;

  // perforation with punched notches
  perforation(x, left, right, y);
  y += 60;

  // detail rows
  const rx = right - IN;
  const lx = left + IN;
  for (const [k, v, dir] of rows) {
    text(x, k, rx, y + 40, { font: "32px RcptSans", color: C.faint, align: "right" });
    x.font = "36px RcptSansBold";
    const max = rx - lx - 200;
    text(x, fit(x, v, max), lx, y + 40, { font: "36px RcptSansBold", color: C.bone, align: "left", dir });
    y += ROW_H;
    if (k !== rows[rows.length - 1][0]) {
      x.strokeStyle = "rgba(200,155,90,0.13)";
      x.lineWidth = 1.5;
      x.beginPath();
      x.moveTo(lx, y - 20);
      x.lineTo(rx, y - 20);
      x.stroke();
    }
  }

  if (d.customer_note) {
    roundRect(x, lx, y, rx - lx, 100, 18);
    x.fillStyle = "rgba(255,255,255,0.04)";
    x.fill();
    text(x, "ملاحظة", rx - 24, y + 40, { font: "26px RcptSans", color: C.faint, align: "right" });
    x.font = "30px RcptSans";
    text(x, fit(x, d.customer_note, rx - lx - 48), rx - 24, y + 80, { font: "30px RcptSans", color: C.bone, align: "right" });
    y += noteH;
  }

  y += 10;
  perforation(x, left, right, y);
  y += 70;

  // booking code
  text(x, "رمز الحجز", cx, y, { font: "28px RcptSans", color: C.faint, align: "center" });
  x.save();
  x.letterSpacing = "18px";
  text(x, d.code, cx + 9, y + 92, { font: "84px RcptSansBold", color: C.goldLight, align: "center", dir: "ltr" });
  x.restore();
  y += 140;
  const issued = d.issued_at ? `${formatInstantDate(d.issued_at, tz, { weekday: undefined })} · ${formatInstantTime(d.issued_at, tz)}` : "";
  text(x, issued ? `انحجز ${issued}` : "احتفظ بهذا الوصل ليوم موعدك", cx, y, { font: "26px RcptSans", color: C.faint, align: "center" });

  return canvas.toBuffer("image/png");
}

// ---- drawing helpers --------------------------------------------------------

function text(
  x: SKRSContext2D,
  s: string,
  px: number,
  py: number,
  o: { font: string; color: string; align: CanvasTextAlign; dir?: "rtl" | "ltr" },
) {
  x.font = o.font;
  x.fillStyle = o.color;
  x.textAlign = o.align;
  x.direction = o.dir ?? "rtl";
  x.fillText(s, px, py);
}

function fit(x: SKRSContext2D, s: string, max: number): string {
  if (x.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && x.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

function goldGrad(x: SKRSContext2D, a: number, b: number) {
  const g = x.createLinearGradient(a, 0, b, 0);
  g.addColorStop(0, "#f3d79a");
  g.addColorStop(0.3, C.gold);
  g.addColorStop(0.55, C.goldDeep);
  g.addColorStop(0.8, "#d9b072");
  g.addColorStop(1, "#f3d79a");
  return g;
}

function roundRect(x: SKRSContext2D, px: number, py: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

function perforation(x: SKRSContext2D, left: number, right: number, y: number) {
  x.fillStyle = C.bg;
  for (const px of [left, right]) {
    x.beginPath();
    x.arc(px, y, 24, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = C.gold;
  x.lineWidth = 2;
  for (const px of [left, right]) {
    x.beginPath();
    x.arc(px, y, 24, px === left ? -Math.PI / 2 : Math.PI / 2, px === left ? Math.PI / 2 : (3 * Math.PI) / 2);
    x.stroke();
  }
  x.setLineDash([14, 12]);
  x.strokeStyle = "rgba(200,155,90,0.5)";
  x.beginPath();
  x.moveTo(left + 40, y);
  x.lineTo(right - 40, y);
  x.stroke();
  x.setLineDash([]);
}

/** A gold rule with a diamond in the middle. */
function ornamentLine(x: SKRSContext2D, cx: number, y: number) {
  x.strokeStyle = C.gold;
  x.lineWidth = 2;
  for (const s of [-1, 1]) {
    const g = x.createLinearGradient(cx, 0, cx + s * 170, 0);
    g.addColorStop(0, C.gold);
    g.addColorStop(1, "rgba(200,155,90,0)");
    x.strokeStyle = g;
    x.beginPath();
    x.moveTo(cx + s * 16, y);
    x.lineTo(cx + s * 170, y);
    x.stroke();
  }
  x.beginPath();
  x.moveTo(cx, y - 9);
  x.lineTo(cx + 9, y);
  x.lineTo(cx, y + 9);
  x.lineTo(cx - 9, y);
  x.closePath();
  x.fillStyle = C.goldLight;
  x.fill();
}

/** Baroque scroll in a card corner. sx/sy mirror it for the other corners. */
function flourish(x: SKRSContext2D, ox: number, oy: number, sx: number, sy: number) {
  x.save();
  x.translate(ox, oy);
  x.scale(sx, sy);
  x.strokeStyle = C.gold;
  x.lineWidth = 2.5;
  x.lineCap = "round";
  // main acanthus sweep
  x.beginPath();
  x.moveTo(0, 120);
  x.bezierCurveTo(0, 50, 30, 20, 70, 14);
  x.bezierCurveTo(100, 10, 112, 34, 96, 46);
  x.bezierCurveTo(84, 55, 68, 44, 76, 34);
  x.stroke();
  x.beginPath();
  x.moveTo(120, 0);
  x.bezierCurveTo(50, 0, 20, 30, 14, 70);
  x.bezierCurveTo(10, 100, 34, 112, 46, 96);
  x.bezierCurveTo(55, 84, 44, 68, 34, 76);
  x.stroke();
  // leaf + dot
  x.beginPath();
  x.moveTo(26, 26);
  x.quadraticCurveTo(58, 34, 64, 64);
  x.quadraticCurveTo(34, 58, 26, 26);
  x.fillStyle = "rgba(200,155,90,0.55)";
  x.fill();
  x.beginPath();
  x.arc(14, 14, 5, 0, Math.PI * 2);
  x.fillStyle = C.goldLight;
  x.fill();
  x.restore();
}
