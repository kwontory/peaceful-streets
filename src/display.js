const STORAGE_KEY = "peaceful-streets.display";

export function createDisplaySettings(storage) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  let compact = false;
  try { compact = storage?.getItem(STORAGE_KEY) === "compact"; } catch { /* Storage can be unavailable. */ }

  return {
    isCompact: () => compact,
    setCompact(value) {
      compact = Boolean(value);
      try { storage?.setItem(STORAGE_KEY, compact ? "compact" : "auto"); } catch { /* Keep this session's choice. */ }
      return compact;
    },
  };
}

export function canvasScale(raw, compact = false) {
  const automatic = raw >= 2 ? Math.floor(raw) : raw;
  if (!compact) return automatic;
  return automatic >= 2 ? automatic - 1 : automatic * 0.8;
}
