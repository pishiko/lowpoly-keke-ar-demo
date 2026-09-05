const paths = {
  frame: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="8" y="8" width="8" height="8" rx="2"/>',
  volume: '<path d="M11 4 5 9H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  home: '<path d="m4 10 8-7 8 7v10h-6v-6h-4v6H4z"/><path d="M17 3h4v4"/>',
  size: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l5 5m11 11-5-5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  flip: '<path d="M3 8h3l2-3h8l2 3h3v12H3z"/><path d="M9 11a4 4 0 1 1-1 5m-1-5 2 1 2-1"/>',
  squish: '<path d="M7 8c0-5 10-5 10 0l3 7c2 6-18 6-16 0zM1 10l3 2-3 2m22-4-3 2 3 2"/><path d="M9 13v1m6-1v1m-5 3h4"/>',
  jump: '<path d="M5 18c-3-7 2-9 7-9s10 2 7 9c-2 3-12 3-14 0ZM12 6V1m-3 3 3-3 3 3M3 22h3m12 0h3M9 14v1m6-1v1"/>',
  fall: '<path d="M5 12c-4-4 1-10 5-6l8 4c6 2 4 11-2 10L7 18zM7 8l-3-3M9 14l1-1m4 5 1-1M2 21h6"/>',
  spin: '<path d="M5 9c1-8 13-8 14 0M5 9V4m0 5h5M19 15c-1 8-13 8-14 0m14 0v5m0-5h-5"/><circle cx="12" cy="12" r="2.5"/>',
};
export function mountIcons() {
  document.querySelectorAll('[data-icon]').forEach((element) => { element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[element.dataset.icon] ?? ''}</svg>`; });
}
