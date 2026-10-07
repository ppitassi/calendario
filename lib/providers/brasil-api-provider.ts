import type { CalendarReferenceProvider, ExternalCalendarEvent } from "../reference-events";

/**
 * Provider de Feriados Nacionais Brasileiros via BrasilAPI.
 * Conforme Seção 7.1 do plano técnico.
 */
export class BrasilApiHolidayProvider implements CalendarReferenceProvider {
  id = "brasilapi";

  async getEvents({
    year,
    country,
    signal,
  }: {
    year: number;
    country: string;
    state?: string;
    cityCode?: string;
    signal?: AbortSignal;
  }): Promise<ExternalCalendarEvent[]> {
    if (country.toUpperCase() !== "BR") return [];

    try {
      const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
        signal,
        next: { revalidate: 86400 * 7 }, // Cache semanal
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item: { date: string; name: string; type: string }) => {
        // Cálculo do dia seguinte para limite exclusivo (endsOn)
        const dateParts = item.date.split("-").map(Number);
        const nextDay = new Date(dateParts[0], dateParts[1] - 1, dateParts[2] + 1);
        const endsOnStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;

        return {
          externalKey: `brasilapi_${item.date}_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          title: item.name,
          type: "holiday",
          startsOn: item.date,
          endsOn: endsOnStr,
          country: "BR",
          sourceUrl: "https://brasilapi.com.br/docs#tag/Feriados-Nacionais",
          sourceLabel: "BrasilAPI (Feriados Nacionais)",
        };
      });
    } catch (err) {
      console.error("[BrasilApiHolidayProvider] Falha ao consultar feriados:", err);
      return [];
    }
  }
}
