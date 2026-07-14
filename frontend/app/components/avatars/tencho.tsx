import { AvatarProps } from "../Avatar";

export default function TenchoAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Shopkeeper">
      <circle cx="60" cy="60" r="56" fill="#dbeafe" />
      <circle cx="60" cy="48" r="20" fill="#fed7aa" />
      <circle cx="52" cy="46" r="2" fill="#0f172a" />
      <circle cx="68" cy="46" r="2" fill="#0f172a" />
      <path d="M 50 60 Q 60 66 70 60" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="32" y="78" width="56" height="28" rx="4" fill="#16a34a" />
      <rect x="50" y="82" width="20" height="22" fill="#0f172a" opacity="0.1" />
    </svg>
  );
}
