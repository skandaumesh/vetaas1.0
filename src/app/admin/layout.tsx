import AdminGate from "@/components/admin/AdminGate";

export const metadata = {
  title: "Vetaas Admin",
  robots: { index: false, follow: false },
  // Admin routes advertise their own manifest, so installing from here gives
  // an app that opens on the dashboard instead of the marketing home page.
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vetaas Admin",
    statusBarStyle: "default" as const,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
  // Lets the shell paint under the notch and home indicator; the safe-area
  // insets below keep the content itself clear of them.
  viewportFit: "cover" as const,
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen admin-shell">
      <AdminGate>{children}</AdminGate>
    </div>
  );
}
