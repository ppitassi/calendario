import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { BrasilApiHolidayProvider } from "@/lib/providers/brasil-api-provider";

/**
 * Consulta de Datas e Referências Editoriais (Feriados e Comemorações).
 * Rota: GET /api/calendar-reference-events?month=YYYY-MM&country=BR
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || ""; // formato YYYY-MM
    const country = searchParams.get("country") || "BR";

    if (!month || month.length < 7) {
      return NextResponse.json({ error: "Parâmetro 'month' (YYYY-MM) obrigatório." }, { status: 400 });
    }

    const year = parseInt(month.slice(0, 4), 10);
    const provider = new BrasilApiHolidayProvider();
    const events = await provider.getEvents({ year, country });

    // Filtra pelo mês civil selecionado (startsOn inicia com YYYY-MM)
    const monthEvents = events.filter((ev) => ev.startsOn.startsWith(month));

    return NextResponse.json({
      month,
      country,
      events: monthEvents,
      count: monthEvents.length,
    });
  } catch (err: any) {
    console.error("[api/calendar-reference-events] Erro:", err);
    return NextResponse.json({ error: "Erro interno ao consultar eventos de referência." }, { status: 500 });
  }
}
