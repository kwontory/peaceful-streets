export function settingsMenu(soundEnabled, compact) {
  return [
    { action: "sound", label: soundEnabled ? "settings.soundOn" : "settings.soundOff" },
    { action: "scale", label: compact ? "settings.scaleSmall" : "settings.scaleAuto" },
    { action: "back", label: "settings.back" },
  ];
}
