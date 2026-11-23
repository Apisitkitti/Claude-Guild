import { useCallback, useRef, useState } from "react";

/** open/close state of the Guild Master's report; closing hands the focus back to whatever opened it */
export const useReportDialog = () => {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const openReport = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const closeReport = useCallback(() => {
    setOpen(false);
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  }, []);

  return { open, openReport, closeReport };
};
