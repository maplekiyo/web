// GET /api/export — download the workbook (.xlsx) regenerated from DB + template.
import { buildWorkbook } from "@/lib/excel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const year = Number(new URL(req.url).searchParams.get("year") ?? 2026);
    const buffer = await buildWorkbook(year);
    const filename = `AtelierM_kaikei_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "export failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
