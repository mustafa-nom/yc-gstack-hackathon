type Props = {
  size?: number;
  className?: string;
};

export function GPostLogo({ size = 22, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="8"
        fill="var(--accent)"
        fillOpacity="0.16"
        stroke="var(--accent)"
        strokeOpacity="0.55"
        strokeWidth="1.25"
      />
      <path
        d="M22.5 13.5a6.5 6.5 0 1 0 0 5.5V16.25h-4.25"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="24.5" cy="9" r="2" fill="var(--accent)" />
    </svg>
  );
}
