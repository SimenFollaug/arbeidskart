interface AppLogoProps {
  className?: string;
  size?: number;
}

export function AppLogo({ className = "", size = 32 }: AppLogoProps) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/icons/icon.svg"
      alt="Arbeidskart"
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] ${className}`}
    />
  );
}
