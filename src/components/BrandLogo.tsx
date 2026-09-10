export default function BrandLogo({
  variant = "full",
  className = "",
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <img
        src="/images/tropini-mark.svg"
        alt="Tropini Service"
        width={36}
        height={36}
        className={className}
      />
    );
  }
  return (
    <img
      src="/images/tropini-logo.svg"
      alt="Tropini Service"
      width={420}
      height={72}
      className={className}
    />
  );
}
