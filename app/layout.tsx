import "./globals.css";
import Link from "next/link";
import { currentStaff, logout } from "@/lib/auth";

export const metadata = { title: "Darin Payroll" };

const ADMIN_NAV = [
  ["/", "ภาพรวม"],
  ["/sync", "Sync ตารางสอน"],
  ["/sync/review", "คิวรอตรวจ"],
  ["/classes", "คลาส Group"],
  ["/sales", "ยอดขาย"],
  ["/ot", "OT"],
  ["/payslips", "สลิปเงินเดือน"],
  ["/admin/config", "ตั้งค่า"],
  ["/account", "บัญชี"],
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentStaff();
  const isAdmin = me?.role === "owner" || me?.role === "admin";

  return (
    <html lang="th">
      <body>
        {me && (
          <header className="border-b border-neutral-200 bg-white">
            <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2 text-sm">
              <span className="mr-3 font-semibold">Darin Payroll</span>
              {(isAdmin
                ? ADMIN_NAV
                : ([
                    ["/me", "ของฉัน"],
                    ["/account", "บัญชี"],
                  ] as const)
              ).map(([href, label]) => (
                <Link key={href} href={href} className="rounded px-2 py-1 hover:bg-neutral-100">
                  {label}
                </Link>
              ))}
              <form
                action={async () => {
                  "use server";
                  await logout();
                }}
                className="ml-auto"
              >
                <button className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100">
                  ออก ({me.name})
                </button>
              </form>
            </nav>
          </header>
        )}
        <main className="mx-auto max-w-6xl p-4">{children}</main>
      </body>
    </html>
  );
}
