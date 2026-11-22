// Shared numeric constants for lib/ and components/guild/format.ts.

// ---- time ----
export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

// ---- sizes ----
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;
export const TOKENS_PER_K = 1e3;
export const TOKENS_PER_M = 1e6;

// ---- numeric bases ----
export const PERCENT = 100;
export const HEX_RADIX = 16;
export const HEX_BYTE_DIGITS = 8;
export const BASE36 = 36;

// ---- FNV-1a 32-bit hash ----
export const FNV_OFFSET_BASIS = 0x811c9dc5;
export const FNV_PRIME = 0x01000193;
