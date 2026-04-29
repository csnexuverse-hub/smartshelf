'use client'
import { useEffect } from 'react'
import { Redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
  const router = useRouter()
  useEffect(() => {
    const token = localStorage.getItem('token')
    router.replace(token ? '/sessions' : '/login')
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner" />
    </div>
  )
}
