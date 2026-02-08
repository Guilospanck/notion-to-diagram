import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Notion to Diagram',
  description: 'Transform Notion pages into interactive diagrams',
};

const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased dark:bg-gray-950 dark:text-gray-100">{children}</body>
    </html>
  );
}
