import { AvatarProps } from "../Avatar";

export default function KanriinAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Hotel staff">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <path d="M 48 46 Q 60 38 72 46" stroke="#0f172a" strokeWidth="2" fill="none" />
      <circle cx="52" cy="50" r="2" fill="#0f172a" />
      <circle cx="68" cy="50" r="2" fill="#0f172a" />
      <path d="M 50 62 Q 60 68 70 62" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="3" fill="#0f172a" />
      <rect x="56" y="86" width="8" height="12" fill="#ffffff" />
    </svg>
  );
}
