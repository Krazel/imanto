// Accessible controls keep their text; these decorative icons follow the existing HUD strokes.
const paths={
  play:'M8 5v14l11-7Z',
  trophy:'M7 3h10v5c0 4-2 6-5 6S7 12 7 8V3Zm0 2H3v3c0 3 2 5 5 5M17 5h4v3c0 3-2 5-5 5M12 14v5m-4 2h8m-9-2h10',
  settings:'m9 3-1 3-3 1-2 3 2 2-1 3 3 2 2-1 3 1 2-2 3-1 1-3-2-2 1-3-3-2-2 1Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  book:'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15',
  sound:'M4 9h4l5-5v16l-5-5H4Z M17 8q4 4 0 8m3-11q6 7 0 14',
  music:'M9 17V5l11-2v12M9 9l11-2M9 17c0 4-6 5-6 2s6-5 6-2M20 15c0 4-6 5-6 2s6-5 6-2',
  haptics:'M8 3h8v18H8ZM4 7q-3 5 0 10M20 7q3 5 0 10',
  globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M5 6h14M5 18h14M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',
  crown:'m3 6 5 5 4-7 4 7 5-5-2 14H5Z',
  shield:'m12 3 9 4v6c0 4-5 7-9 9-4-2-9-5-9-9V7ZM8 12l3 3 5-6',
  credits:'M6 3h12v18H6ZM9 7h6M9 12h6M9 17h4',
  video:'M3 4h18v16H3ZM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4m-11-7 5 4-5 4Z'
};
export function decorateScreenIcons(){
  for(const element of document.querySelectorAll('[data-icon]')){
    const path=paths[element.dataset.icon];if(!path)continue;
    element.setAttribute('aria-hidden','true');
    element.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  }
}
