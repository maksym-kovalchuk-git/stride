import "./globals.css";
import { StoreProvider } from "@/shared/store/StoreProvider";
import { Header } from "@/widgets/header/ui/Header";
import { AppToaster } from "@/shared/ui/AppToaster";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk">
      <body>
        <StoreProvider>
          <Header />
            <main>
              {children}
            </main>
        </StoreProvider>
        <AppToaster />
      </body>
    </html>
  );
}
