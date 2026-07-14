import { AvatarProps } from "../Avatar";

export default function IshaAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Doctor">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <circle cx="52" cy="46" r="2" fill="#0f172a" />
      <circle cx="68" cy="46" r="2" fill="#0f172a" />
      <path d="M 50 62 L 70 62" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="4" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
      <rect x="56" y="86" width="8" height="12" fill="#dc2626" />
      <rect x="54" y="90" width="12" height="4" fill="#dc2626" />
    </svg>
  );
}
