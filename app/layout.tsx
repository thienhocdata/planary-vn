import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Planary — Từ mục tiêu đến nhịp sống",
  description: "Hệ thống lập kế hoạch cá nhân kết nối mục tiêu, thói quen, việc hôm nay và review hàng tuần.",
  openGraph: {
    title: "Planary — Từ mục tiêu đến nhịp sống",
    description: "Mục tiêu → Tuần → Hôm nay → Review",
    images: ["https://planary-vn-dashboard.vanthien04032004.chatgpt.site/og-v2.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Planary — Từ mục tiêu đến nhịp sống",
    description: "Mục tiêu → Tuần → Hôm nay → Review",
    images: ["https://planary-vn-dashboard.vanthien04032004.chatgpt.site/og-v2.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
