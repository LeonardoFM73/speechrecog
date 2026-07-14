import { AvatarProps } from "../Avatar";

export default function SenseiAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Teacher">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fde68a" />
      <rect x="44" y="44" width="12" height="8" rx="2" fill="none" stroke="#0f172a" strokeWidth="2" />
      <rect x="64" y="44" width="12" height="8" rx="2" fill="none" stroke="#0f172a" strokeWidth="2" />
      <path d="M 48 70 Q 60 78 72 70" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="6" fill="#2563eb" />
      <rect x="40" y="86" width="40" height="6" rx="2" fill="#fde68a" />
    </svg>
  );
}
