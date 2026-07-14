import { AvatarProps } from "../Avatar";

export default function EkinAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Station staff">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <ellipse cx="60" cy="38" rx="24" ry="8" fill="#0f172a" />
      <rect x="40" y="38" width="40" height="6" fill="#0f172a" />
      <circle cx="60" cy="58" r="18" fill="#fde68a" />
      <circle cx="52" cy="56" r="2" fill="#0f172a" />
      <circle cx="68" cy="56" r="2" fill="#0f172a" />
      <path d="M 50 68 Q 60 74 70 68" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="80" width="56" height="26" rx="3" fill="#1e40af" />
    </svg>
  );
}
