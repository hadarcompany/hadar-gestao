"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string | null | undefined;
  image?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, image, size = 28, className }: AvatarProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const style = { width: size, height: size };

  if (image && image !== failedImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        onError={() => setFailedImage(image)}
        alt={name ?? "Usuário"}
        style={style}
        className={cn("rounded-full object-cover shrink-0 bg-gray-100", className)}
      />
    );
  }

  return (
    <span
      style={{ ...style, fontSize: Math.max(9, size * 0.4) }}
      className={cn("rounded-full bg-accent-dark/15 text-accent-dark font-bold flex items-center justify-center shrink-0", className)}
    >
      {initial}
    </span>
  );
}
