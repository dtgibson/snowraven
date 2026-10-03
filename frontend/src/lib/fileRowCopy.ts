// The Settings file-row action button copy (FR-12, mobile-app design review).
// The mobile apps (iPhone, iPad and, since android-release FR-16, Android) use
// the user-approved "Import" wording — "Import file…" / "Import new…" /
// "Importing…" — because the row presents the native document picker there;
// desktop and web/Pi keep "Upload" unchanged. This is the run's
// one deliberate copy deviation (pipeline/mobile-app/decisions.md, 2026-07-05);
// error strings ("Only .csv files are accepted." etc.) are NOT adapted.
export function fileRowButtonLabel(
  uploading: boolean,
  hasFile: boolean,
  mobile: boolean,
): string {
  if (mobile) return uploading ? 'Importing…' : hasFile ? 'Import new…' : 'Import file…';
  return uploading ? 'Uploading…' : hasFile ? 'Upload new' : 'Upload file';
}
