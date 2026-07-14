import clsx from 'clsx'
import type { ClassValue } from 'clsx'

/** Une classes condicionais. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
