export function Logo({ className = '' }: { className?: string }) {
  return (
    <a href="/" aria-label="Go to home page">
      <img
        src="/hosting-icon.svg"
        alt="HostPortal"
        className={className}
        role="img"
      />
    </a>
  );
}
