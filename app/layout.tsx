import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Camar · Panel de gestión",
  description: "Panel de administración de contenidos de Camar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link rel="icon" type="image/svg+xml" href="https://lanzadera-digital.b-cdn.net/camar.es/Utils/favicon.ico"/>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vollkorn:ital,wght@0,400..900;1,400..900&family=Work+Sans:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-workSans" suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
