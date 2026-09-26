let strings = {};

export async function loadLocale() {
  const response = await fetch("./locales/ko.json");
  if (!response.ok) throw new Error(`Locale HTTP ${response.status}`);
  strings = await response.json();
}

export const t = (key) => strings[key] ?? key;
