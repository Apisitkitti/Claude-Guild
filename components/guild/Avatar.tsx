import { useEffect, useRef } from "react";

import { gearTier } from "@/lib/office/gearTier";
import type { Look } from "@/lib/office/palette";
import { charSprite } from "@/lib/office/sprites";

const AVATAR_W = 16;
const AVATAR_H = 14;

export const Avatar = ({ look, level = 1 }: { look: Look; level?: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const tier = gearTier(level);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, AVATAR_W, AVATAR_H);
    ctx.drawImage(charSprite(look, "idle", 0, tier), 0, 0, AVATAR_W, AVATAR_H, 0, 0, AVATAR_W, AVATAR_H);
  }, [look, tier]);
  return <canvas ref={ref} className="avatar" width={AVATAR_W} height={AVATAR_H} />;
};
