import { formatDistanceToNow, format } from "date-fns";

export function formatRelativeDate(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

export function formatAbsoluteDate(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy");
}
