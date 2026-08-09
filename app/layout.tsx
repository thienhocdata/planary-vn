import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Planary — Kế hoạch của tôi",
  description: "Không gian cá nhân để sắp xếp hôm nay, theo dõi mục tiêu và giữ mọi kế hoạch trong tầm mắt.",
  openGraph: {
    title: "Planary — Kế hoạch của tôi",
    description: "Mọi điều quan trọng, trong một nơi.",
    images: ["https://planary-vn-dashboard.vanthien04032004.chatgpt.site/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Planary — Kế hoạch của tôi",
    description: "Mọi điều quan trọng, trong một nơi.",
    images: ["https://planary-vn-dashboard.vanthien04032004.chatgpt.site/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
