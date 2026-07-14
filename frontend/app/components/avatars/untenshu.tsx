import { AvatarProps } from "../Avatar";

export default function UntenshuAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Taxi driver">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <rect x="36" y="34" width="48" height="18" rx="3" fill="#fde047" />
      <circle cx="60" cy="60" r="20" fill="#fde68a" />
      <circle cx="52" cy="58" r="2" fill="#0f172a" />
      <circle cx="68" cy="58" r="2" fill="#0f172a" />
      <path d="M 50 70 Q 60 76 70 70" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="84" width="56" height="22" rx="3" fill="#2563eb" />
    </svg>
  );
}
