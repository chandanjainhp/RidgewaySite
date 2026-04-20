import "./globals.css";
import TopBar from "@/components/layout/TopBar";
import Providers from "@/components/shared/Providers";

export const metadata = {
  title: "6:10 Assistant | Ridgeway Site",
  description: "Ridgeway Site Overnight Intelligence Platform. Mission Control.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body style={{ backgroundColor: "#0f1117", margin: 0 }}>
        <Providers>
          <TopBar />
          <div style={{ paddingTop: "56px" }}>{children}</div>
        </Providers>
      </body>
    </html>
  );
}
