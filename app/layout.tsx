import '../src/styles/index.css';

export const metadata = {
  title: 'Content Planner',
  description: 'Content Planner',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
