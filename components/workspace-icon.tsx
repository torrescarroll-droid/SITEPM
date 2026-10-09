/** Small decorative navigation glyphs. Labels remain the accessible names. */
export function WorkspaceIcon({ href }: { href: string }) {
  const paths: Record<string, string> = {
    "/": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    "/projects": "M3 21V8l9-5 9 5v13 M8 21v-7h8v7 M7 9h2 M15 9h2",
    "/schedule":
      "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2 M8 18h2",
    "/resources":
      "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 5a4 4 0 0 1 0 8 M19 16a5 5 0 0 1 3 5",
    "/tasks": "M4 5h3 M10 5h10 M4 12h3 M10 12h10 M4 19h3 M10 19h10",
    "/field": "M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4",
    "/documents": "M4 3h10l6 6v12H4z M14 3v6h6 M8 13h8 M8 17h6",
  };
  return (
    <svg
      className="nav-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[href] ?? paths["/"]} />
    </svg>
  );
}
