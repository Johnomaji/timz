"use client";

import { AlertCircle, Bell, Check, RotateCcw, ShieldCheck, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeading } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  Select,
  statusTone,
  Toggle,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import { cn, shortDate, timeAgo } from "@/lib/utils";

const COUNTRIES = [
  "United Kingdom",
  "United States",
  "Nigeria",
  "Germany",
  "India",
  "Singapore",
  "Canada",
  "Australia",
  "South Africa",
  "Brazil",
];

export default function UserSettingsPage() {
  const {
    db,
    currentUser,
    updateProfile,
    changePassword,
    markAllNotificationsRead,
    resetDemoData,
    logout,
  } = useStore();
  const router = useRouter();

  const [profile, setProfile] = useState({
    name: currentUser?.name ?? "",
    phone: currentUser?.phone ?? "",
    country: currentUser?.country ?? COUNTRIES[0]!,
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  if (!currentUser) return null;

  const myNotifications = db.notifications.filter((n) => n.userId === currentUser.id);
  const unread = myNotifications.filter((n) => !n.read).length;

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setPasswordMessage({ ok: false, text: "New passwords do not match." });
      return;
    }
    const result = changePassword(passwords.current, passwords.next);
    if (!result.ok) {
      setPasswordMessage({ ok: false, text: result.error ?? "Could not update password." });
      return;
    }
    setPasswordMessage({ ok: true, text: "Password updated." });
    setPasswords({ current: "", next: "", confirm: "" });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading title="Settings" description="Manage your profile, security and notifications." />

      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <UserCog className="size-5 text-muted" />
          <div>
            <p className="font-medium text-ink">{currentUser.email}</p>
            <p className="text-xs text-faint">
              Member since {shortDate(currentUser.joinedAt)} · referral code {currentUser.referralCode}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge tone={statusTone(currentUser.status)}>{currentUser.status}</Badge>
        </div>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Profile" subtitle="Your email address cannot be changed in this demo" />
          <form className="space-y-4 p-5" onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </Field>
              <Field label="Phone number">
                <Input
                  placeholder="+44 7700 900000"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Country">
              <Select
                value={profile.country}
                onChange={(e) => setProfile({ ...profile, country: e.target.value })}
              >
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit">Save changes</Button>
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-sm text-brand">
                  <Check className="size-4" />
                  Saved
                </span>
              )}
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Security" subtitle="Password and two-factor authentication" />
          <div className="p-5">
            <form className="space-y-4" onSubmit={savePassword}>
              <Field label="Current password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(e) => {
                    setPasswords({ ...passwords, current: e.target.value });
                    setPasswordMessage(null);
                  }}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" hint="At least 6 characters">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={passwords.next}
                    onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                  />
                </Field>
                <Field label="Confirm new password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  />
                </Field>
              </div>

              {passwordMessage && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm",
                    passwordMessage.ok
                      ? "border-brand/30 bg-brand/10 text-brand"
                      : "border-danger/30 bg-danger/10 text-danger",
                  )}
                >
                  {passwordMessage.ok ? (
                    <Check className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  )}
                  {passwordMessage.text}
                </div>
              )}

              <Button type="submit" variant="secondary">
                Update password
              </Button>
            </form>

            <div className="mt-5 border-t border-line pt-1">
              <Toggle
                label="Two-factor authentication"
                description="Require a one-time code from your authenticator app at sign-in"
                checked={currentUser.twoFactor}
                onChange={(next) => updateProfile({ twoFactor: next })}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Notifications"
            subtitle={`${myNotifications.length} total · ${unread} unread`}
            action={
              unread > 0 ? (
                <Button variant="ghost" size="sm" onClick={markAllNotificationsRead}>
                  Mark all read
                </Button>
              ) : undefined
            }
          />
          {myNotifications.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Nothing here yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line/60 overflow-y-auto">
              {myNotifications.map((n) => (
                <li key={n.id} className={cn("flex gap-3 px-5 py-4", !n.read && "bg-surface-2/40")}>
                  <Bell
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      n.tone === "success"
                        ? "text-brand"
                        : n.tone === "warning"
                          ? "text-warn"
                          : n.tone === "danger"
                            ? "text-danger"
                            : "text-info",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-faint">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-danger/25">
          <CardHeader
            title="Demo controls"
            subtitle="This build stores everything in your browser only"
          />
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="max-w-md text-sm text-muted">
              Resetting restores the original seeded users, plans and transactions, and signs you out.
            </p>
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              <RotateCcw className="size-4" />
              Reset demo data
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all demo data?"
        description="Every account change, deposit, withdrawal and investment made in this browser will be discarded."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                logout();
                resetDemoData();
                router.replace("/login");
              }}
            >
              Reset and sign out
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/8 p-4 text-sm text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warn" />
          The seeded demo accounts and their passwords will work again exactly as they did initially.
        </div>
      </Modal>
    </div>
  );
}
