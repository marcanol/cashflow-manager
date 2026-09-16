import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = { title: "Cashflow", description: "Household cash-flow control" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
