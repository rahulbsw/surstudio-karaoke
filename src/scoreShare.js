import { callNative, hasNativeMacBridge } from "./nativeMac.js";

function safeFilePart(value = "surstudio-score") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "surstudio-score";
}

function fitText(context, value, maxWidth) {
  const original = String(value || "");
  if (context.measureText(original).width <= maxWidth) return original;
  let shortened = original;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not render the score card.")), "image/png"));
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not prepare the score card for sharing."));
    reader.readAsDataURL(blob);
  });
}

export async function createScoreCardFile(take) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  const background = context.createLinearGradient(0, 0, 1200, 630);
  background.addColorStop(0, "#090712");
  background.addColorStop(0.55, "#1b1029");
  background.addColorStop(1, "#38152f");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 630);

  const glow = context.createRadialGradient(930, 110, 20, 930, 110, 470);
  glow.addColorStop(0, "rgba(236,72,153,.34)");
  glow.addColorStop(1, "rgba(168,85,247,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1200, 630);

  context.fillStyle = "#d8b4fe";
  context.font = "800 26px Outfit, -apple-system, sans-serif";
  context.fillText("SURSTUDIO", 70, 74);
  context.fillStyle = "#756b82";
  context.font = "650 18px Outfit, -apple-system, sans-serif";
  context.fillText("YOUR VOICE, YOUR MEHFIL", 70, 104);

  context.fillStyle = "#f9a8d4";
  context.font = "800 18px Outfit, -apple-system, sans-serif";
  context.fillText("MY KARAOKE TAKE", 70, 176);
  context.fillStyle = "#fff7ff";
  context.font = "800 55px Outfit, -apple-system, sans-serif";
  context.fillText(fitText(context, take.title, 650), 70, 240);
  context.fillStyle = "#b5aabd";
  context.font = "500 25px Outfit, -apple-system, sans-serif";
  context.fillText(fitText(context, take.artist || "SurStudio singer", 650), 70, 280);

  context.fillStyle = "rgba(255,255,255,.055)";
  context.fillRect(760, 58, 370, 286);
  context.fillStyle = "#f3e8ff";
  context.font = "900 150px Outfit, -apple-system, sans-serif";
  context.textAlign = "center";
  context.fillText(Number(take.score || take.overall || 0).toFixed(1), 945, 238);
  context.fillStyle = "#8f839a";
  context.font = "700 23px Outfit, -apple-system, sans-serif";
  context.fillText("OUT OF 10", 945, 276);
  context.fillStyle = "#fde68a";
  context.font = "800 20px Outfit, -apple-system, sans-serif";
  context.fillText(String(take.tier || "Practice take").toUpperCase(), 945, 317);
  context.textAlign = "left";

  const metrics = [
    ["PITCH", take.metrics?.pitch || 0, "#ec4899"],
    ["TIMING", take.metrics?.timing || 0, "#fb923c"],
    ["RANGE", take.metrics?.range || 0, "#a855f7"],
    ["CONTROL", take.metrics?.control || 0, "#f472b6"],
  ];
  metrics.forEach(([label, value, color], index) => {
    const x = index % 2 === 0 ? 70 : 610;
    const y = 380 + Math.floor(index / 2) * 92;
    context.fillStyle = "#b8afc1";
    context.font = "800 17px Outfit, -apple-system, sans-serif";
    context.fillText(label, x, y);
    context.textAlign = "right";
    context.fillStyle = "#f4edfa";
    context.fillText(String(value), x + 450, y);
    context.textAlign = "left";
    context.fillStyle = "rgba(255,255,255,.1)";
    context.fillRect(x, y + 18, 450, 10);
    context.fillStyle = color;
    context.fillRect(x, y + 18, 450 * Math.max(0, Math.min(100, Number(value))) / 100, 10);
  });

  context.fillStyle = "#746b7d";
  context.font = "500 17px Outfit, -apple-system, sans-serif";
  const date = take.createdAt ? new Date(take.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Made locally";
  context.fillText(`${date}  ·  Private, local-first practice`, 70, 585);

  const blob = await canvasBlob(canvas);
  return new File([blob], `${safeFilePart(take.title)}-surstudio-score.png`, { type: "image/png" });
}

export async function shareScoreCard(take, destination = "picker") {
  const file = await createScoreCardFile(take);
  const text = `${take.title} — ${Number(take.score || take.overall || 0).toFixed(1)}/10 (${take.tier || "SurStudio take"})`;

  if (hasNativeMacBridge()) {
    try {
      const dataUrl = await blobDataUrl(file);
      return await callNative("shareScoreCard", { dataUrl, fileName: file.name, text, destination });
    } catch (error) {
      if (!import.meta.env.DEV) throw error;
    }
  }

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "My SurStudio score", text, files: [file] });
    return { shared: true };
  }

  const download = document.createElement("a");
  const url = URL.createObjectURL(file);
  download.href = url;
  download.download = file.name;
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  await navigator.clipboard?.writeText(text).catch(() => {});
  return { downloaded: true };
}

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("dashboard-preview")) window.__surStudioCreateScoreCard = createScoreCardFile;
