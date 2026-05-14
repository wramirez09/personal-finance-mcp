export const metadata = {
  title: "personal-finance-mcp",
  description: "Remote MCP server for personal financial data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
