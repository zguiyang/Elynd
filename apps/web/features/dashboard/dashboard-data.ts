export function greetingForHour(hour: number, name: string): string {
  if (hour < 5) {
    return `夜深了，${name}`;
  }
  if (hour < 11) {
    return `早上好，${name}`;
  }
  if (hour < 14) {
    return `中午好，${name}`;
  }
  if (hour < 18) {
    return `下午好，${name}`;
  }
  return `晚上好，${name}`;
}
