export function Logo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/hosting-icon.svg"
      alt="HostPortal"
      className={className}
      role="img"
      aria-label="HostPortal logo"
    />
  );
}
