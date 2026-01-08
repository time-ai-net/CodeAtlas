import './globals.css'

export const metadata = {
  title: 'CodeAtlas - AI Architecture Analysis',
  description: 'Analyze GitHub repositories with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
