const AVATAR_COLORS = [
  "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-lime-500", "bg-green-500",
  "bg-teal-500", "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500",
  "bg-violet-500", "bg-purple-500", "bg-pink-500", "bg-rose-400",
];

export function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
