import { AvatarProps } from "../Avatar";

export default function CustomAvatar({ size = 120 }: AvatarProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-label="Custom scenario">
      <circle cx="60" cy="60" r="56" fill="#e2e8f0" />
      <circle cx="60" cy="60" r="32" fill="#cbd5e1" />
      <text x="60" y="74" textAnchor="middle" fontSize="40" fill="#475569" fontFamily="system-ui">?</text>
    </svg>
  );
}
