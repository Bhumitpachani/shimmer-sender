import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Mail, Send, UserCog, Plus, FileSpreadsheet,
} from "lucide-react";
import type { Session } from "@/lib/session";

const ITEMS: { key: string; label: string; group: "Navigate" | "Create"; icon: any; to: string; permission?: string; adminOnly?: boolean }[] = [
  { key: "nav-dashboard", label: "Go to Dashboard", group: "Navigate", icon: LayoutDashboard, to: "/app", permission: "dashboard" },
  { key: "nav-clients", label: "Go to Clients", group: "Navigate", icon: Users, to: "/app/clients", permission: "clients" },
  { key: "nav-campaigns", label: "Go to Campaigns", group: "Navigate", icon: Send, to: "/app/campaigns", permission: "campaigns" },
  { key: "nav-templates", label: "Go to Templates", group: "Navigate", icon: Mail, to: "/app/templates", permission: "templates" },
  { key: "nav-employees", label: "Go to Employees", group: "Navigate", icon: UserCog, to: "/app/employees", adminOnly: true },
  { key: "new-campaign", label: "New Campaign", group: "Create", icon: Plus, to: "/app/campaigns/new", permission: "campaigns" },
  { key: "new-client", label: "New Client", group: "Create", icon: FileSpreadsheet, to: "/app/clients", permission: "clients" },
  { key: "new-template", label: "New Template", group: "Create", icon: Mail, to: "/app/templates", adminOnly: true },
];

export function CommandPalette({ session, open, onOpenChange }: { session: Session; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();

  const visible = ITEMS.filter((item) => {
    if (session.role === "admin") return true;
    if (item.adminOnly) return false;
    return !item.permission || session.permissions.includes(item.permission as any);
  });

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to: to as any });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {(["Navigate", "Create"] as const).map((group) => {
          const items = visible.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem key={item.key} onSelect={() => go(item.to)}>
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
