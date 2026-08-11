"use client";

import { ComponentType } from "react";
import { avatars } from "./avatars";
import type { AvatarProps } from "./Avatar";

interface Props {
  scenarioId: string;
  size?: number;
  className?: string;
}

export default function AvatarStatic({ scenarioId, size = 80, className = "" }: Props) {
  const Component: ComponentType<AvatarProps> = avatars[scenarioId] ?? avatars.custom;
  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <Component size={size} />
    </div>
  );
}