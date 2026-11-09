const PATHS = {
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  scan: <><path d="M4 8V5a1 1 0 011-1h3" /><path d="M16 4h3a1 1 0 011 1v3" /><path d="M20 16v3a1 1 0 01-1 1h-3" /><path d="M8 20H5a1 1 0 01-1-1v-3" /><path d="M4 12h16" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  book: <><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" /><path d="M5 17a3 3 0 013-3h11" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  store: <><path d="M4 9l1-5h14l1 5" /><path d="M4 9a3 3 0 006 0 3 3 0 006 0 3 3 0 004 0" /><path d="M5 12v8h14v-8" /></>,
  out: <><path d="M10 4H5v16h5" /><path d="M15 8l4 4-4 4M19 12H9" /></>,
  down: <><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></>,
  up: <><path d="M12 20V8M7 13l5-5 5 5M5 4h14" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></>,
};

export default function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#000" />
      <path d="M8 24a16 16 0 0032 0z" fill="#E0141E" />
      <circle cx="24" cy="15" r="5" fill="#fff" />
    </svg>
  );
}
