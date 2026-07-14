import { AvatarProps } from "../Avatar";

export default function TomodachiAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Friend">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <path d="M 44 44 Q 50 36 60 36 Q 70 36 76 44" fill="#0f172a" />
      <circle cx="52" cy="50" r="2" fill="#0f172a" />
      <circle cx="68" cy="50" r="2" fill="#0f172a" />
      <path d="M 48 62 Q 60 72 72 62" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="6" fill="#f472b6" />
    </svg>
  );
}
