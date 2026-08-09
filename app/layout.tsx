import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Planary — Từ mục tiêu đến nhịp sống",
  description: "Hệ thống lập kế hoạch cá nhân kết nối mục tiêu, thói quen, việc hôm nay và review hàng tuần.",
  openGraph: {
    title: "Planary — Từ mục tiêu đến nhịp sống",
    description: "Mục tiêu → Tuần → Hôm nay → Review",
    images: ["https://planary-vn-dashboard.vanthien04032004.chatgpt.site/og-v3.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Planary — Từ mục tiêu đến nhịp sống",
    description: "Mục tiêu → Tuần → Hôm nay → Review",
    images: ["https://planary-vn-dashboard.vanthien04032004.chatgpt.site/og-v3.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={beVietnamPro.variable}>{children}</body></html>;
}
