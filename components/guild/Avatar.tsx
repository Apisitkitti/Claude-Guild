import { useEffect, useRef } from "react";
import { charSprite } from "@/lib/office/sprites";
import type { Look } from "@/lib/office/palette";

export function Avatar({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 14);
    ctx.drawImage(charSprite(look, "idle", 0), 0, 0, 16, 14, 0, 0, 16, 14);
  }, [look]);
  return <canvas ref={ref} className="avatar" width={16} height={14} />;
}
