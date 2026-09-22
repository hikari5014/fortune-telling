/* 自繪線條圖示集（不使用 emoji）。24×24，stroke = currentColor。 */
const P = {
  home: '<path d="M4 11.2 12 4l8 7.2"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
  profile: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.9-3.8 3.9-5.8 7.5-5.8s6.6 2 7.5 5.8"/>',
  astro: '<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2"/><path d="m12 7.4 1.6 3 3 1.6-3 1.6-1.6 3-1.6-3-3-1.6 3-1.6z"/>',
  ziwei: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="1.6"/><path d="M3.6 9h16.8M3.6 15h16.8M9 3.6v16.8M15 3.6v16.8"/>',
  naming: '<rect x="4" y="4" width="16" height="16" rx="1.6" stroke-dasharray="3 2.6"/><path d="M8 9h8M12 9v7M9.4 12.6h5.2"/>',
  numbers: '<path d="M5 9h14M5 15h14M10 4.5 8.4 19.5M15.6 4.5 14 19.5"/>',
  prompt: '<path d="M9 5 5.5 8.5 5.5 15.5 9 19"/><path d="M15 5l3.5 3.5v7L15 19"/><path d="M11 15.5 13 8.5"/>',
  records: '<path d="m12 3.6 8 4.2-8 4.2-8-4.2z"/><path d="m4 12 8 4.2 8-4.2"/><path d="m4 16.2 8 4.2 8-4.2"/>',
  settings: '<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="14" cy="17" r="2"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
  moon: '<path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.4 8.4 0 1 0 20 14.4z"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.8"/><path d="M15.5 5.5h-11v11"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.6h5V7M6.5 7l1 13h9l1-13"/>',
  down: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 20h15"/>',
  up: '<path d="M12 20V9M7.5 13.5 12 9l4.5 4.5M4.5 4h15"/>',
  share: '<circle cx="17.5" cy="6" r="2.6"/><circle cx="6.5" cy="12" r="2.6"/><circle cx="17.5" cy="18" r="2.6"/><path d="m9 10.7 6-3.4M9 13.3l6 3.4"/>',
  edit: '<path d="M4.5 19.5h4L19 9a2.3 2.3 0 0 0-3.2-3.2L5.3 16.3z"/><path d="m14.5 6.5 3 3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  star: '<path d="m12 4 2.3 5 5.5.7-4 3.8 1 5.5-4.8-2.7-4.8 2.7 1-5.5-4-3.8 5.5-.7z"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19.5 4.5V10H14"/>',
  install: '<path d="M12 3.5v11M8 11l4 4 4-4"/><path d="M4.5 16v3.5h15V16"/>',
  compass: '<circle cx="12" cy="12" r="8.4"/><path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="3.6" y="5.4" width="16.8" height="15" rx="1.8"/><path d="M3.6 10h16.8M8.4 3.6v3.6M15.6 3.6v3.6"/><circle cx="12" cy="14.6" r="1.3" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7v5.4l3.4 2"/>',
  pin: '<path d="M12 21s6.4-6.2 6.4-10.4A6.4 6.4 0 1 0 5.6 10.6C5.6 14.8 12 21 12 21z"/><circle cx="12" cy="10.4" r="2.3"/>',
  spark: '<path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18l-1.7-5.6L5 10.7 10.3 9z"/><path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5 17.8 20.2 15.5 19.5 17.8 18.8z"/>',
  search: '<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4 4"/>',
  link: '<path d="M10 14a4.4 4.4 0 0 0 6.3 0l2.4-2.4a4.5 4.5 0 0 0-6.4-6.3L11 6.6"/><path d="M14 10a4.4 4.4 0 0 0-6.3 0l-2.4 2.4a4.5 4.5 0 0 0 6.4 6.3L13 17.4"/>',
  swap: '<path d="M6 8h12l-3-3M18 16H6l3 3"/>',
  info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none"/>',
  folder: '<path d="M3.6 7.4h6l2 2.4h8.8v9.8H3.6z"/><path d="M3.6 7.4V5h6l2 2.4"/>',
};

export function icon(name, cls = '') {
  const d = P[name] || P.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round" class="${cls}" data-icon="${name}"
    aria-hidden="true" focusable="false">${d}</svg>`;
}
export const iconNames = Object.keys(P);
