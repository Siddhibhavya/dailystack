const KEY = 'dailystack_theme';
export function readTheme(): 'light' | 'dark' {
  try { const stored = localStorage.getItem(KEY); if (stored === 'light' || stored === 'dark') return stored; } catch { /* Use system preference. */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function setTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* Theme works for this session. */ }
}
