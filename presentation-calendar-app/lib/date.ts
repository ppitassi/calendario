/** Centraliza chaves e rótulos de data usados pelo calendário e pelas APIs. */

const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** Formata uma data como `mês ano`, com o mês escrito em português. */
export const monthLabel = (date: Date) => `${months[date.getMonth()]} ${date.getFullYear()}`;
/** Converte uma data em `AAAA-MM`, chave mensal aceita pelas APIs. */
export const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
/** Converte uma data em `AAAA-MM-DD`, sem depender do fuso de `toISOString`. */
export const dateKey = (date: Date) => `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
/** Move para o primeiro dia do mês indicado pelo deslocamento, inclusive entre anos. */
export const shiftMonth = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
/** Converte `AAAA-MM` no primeiro dia do mês; chave ausente ou inválida usa o mês atual. */
export const parseMonthKey = (mKey: string): Date => {
  if (!mKey || !mKey.includes("-")) return new Date();
  const [y, m] = mKey.split("-");
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
};
/** Formata `AAAA-MM-DD` por extenso; o meio-dia evita recuo de data por fuso. */
export const longDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${value}T12:00:00`));

/**
 * Lista as datas do mês que caem nos dias selecionados; os números seguem
 * `Date.getDay()`, de domingo `0` a sábado `6`.
 */
export const getDatesForWeekdays = (year: number, monthIndex: number, weekdays: number[]): string[] => {
  const dates: string[] = [];
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    if (weekdays.includes(d.getDay())) {
      dates.push(dateKey(d));
    }
  }
  return dates;
};
