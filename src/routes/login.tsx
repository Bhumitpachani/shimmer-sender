import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { setSession, getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Eye, EyeOff, Lock, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) navigate({ to: "/app" });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const employee = await db.employees.getByUsername(username.trim());
      if (!employee || employee.password !== password) {
        toast.error("Invalid username or password");
        return;
      }
      setSession({
        id: employee.id,
        username: employee.username,
        name: employee.name,
        role: employee.role,
        permissions: employee.permissions,
      });
      navigate({ to: "/app" });
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-[480px] flex-col justify-between bg-[#0f172a] p-10 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-[oklch(0.55_0.22_280)]/10 pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[oklch(0.55_0.22_280)]/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.55_0.22_280)] flex items-center justify-center shadow-xl shadow-primary/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">Starlink Jewels</div>
            <div className="text-slate-500 text-xs tracking-widest uppercase">Email Marketing</div>
          </div>
        </div>
        <div className="relative space-y-5">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Manage your<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[oklch(0.65_0.2_280)]">email campaigns</span><br />
            with ease.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            A complete dashboard to manage clients, design email templates, and run targeted campaigns — all in one place.
          </p>
        </div>
        <div className="relative flex gap-6">
          {[["Clients", "Track all your contacts"], ["Campaigns", "Send bulk emails"], ["Analytics", "Track performance"]].map(([title, desc]) => (
            <div key={title}>
              <div className="text-white font-semibold text-sm">{title}</div>
              <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.55_0.22_280)] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight">Starlink Jewels</div>
                <div className="text-slate-400 text-[10px] tracking-widest uppercase">Email Marketing</div>
              </div>
            </div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
              <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="u" className="text-sm font-medium text-slate-700">Username</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="u"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    autoFocus
                    className="pl-9 h-11 border-slate-200 focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p" className="text-sm font-medium text-slate-700">Password</Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="p"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="pl-9 pr-10 h-11 border-slate-200 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/20 mt-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                Default admin: <span className="font-mono font-medium text-slate-600">admin</span> / <span className="font-mono font-medium text-slate-600">123</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
