export async function generateStaticParams() {
  // Generate a demo session for mobile app
  return [{ id: 'demo' }]
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
