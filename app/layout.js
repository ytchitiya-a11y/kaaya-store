import './globals.css';

export const metadata = {
  title: 'KAAYA — Clothing Studio',
  description: 'Hand-picked fabric, cuts made for everyday wear. Shop the KAAYA collection.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Rozha+One&family=Hind:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
