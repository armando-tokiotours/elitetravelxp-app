/** Renders the word Japan in the Beauty display face — first letter capped only. */
export function JapanKeyword({
  className = "",
  children = "Japan",
}: {
  className?: string;
  children?: string;
}) {
  const raw = String(children || "Japan").trim() || "Japan";
  const title = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return (
    <span className={`japan-keyword normal-case ${className}`.trim()}>
      {title}
    </span>
  );
}
