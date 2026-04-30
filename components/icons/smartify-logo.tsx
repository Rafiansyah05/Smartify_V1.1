export function SmartifyLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="64" height="64" rx="16" fill="#4AC9FF" />
        <path
          d="M20 24C20 22.8954 20.8954 22 22 22H42C43.1046 22 44 22.8954 44 24V26C44 27.1046 43.1046 28 42 28H22C20.8954 28 20 27.1046 20 26V24Z"
          fill="white"
        />
        <path
          d="M24 32C24 30.8954 24.8954 30 26 30H42C43.1046 30 44 30.8954 44 32V34C44 35.1046 43.1046 36 42 36H26C24.8954 36 24 35.1046 24 34V32Z"
          fill="white"
        />
        <path
          d="M20 40C20 38.8954 20.8954 38 22 38H38C39.1046 38 40 38.8954 40 40V42C40 43.1046 39.1046 44 38 44H22C20.8954 44 20 43.1046 20 42V40Z"
          fill="white"
        />
      </svg>
      <span className="text-primary text-xl font-semibold mt-2">smartify</span>
    </div>
  );
}
