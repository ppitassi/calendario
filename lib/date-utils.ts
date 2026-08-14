export function normalizeDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
}

export function assertPostDate(value: unknown): string {
  const date = normalizeDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date === "0000-00-00") {
    throw new Error("Data de postagem invalida.");
  }
  return date;
}
