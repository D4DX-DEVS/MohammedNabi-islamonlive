import type { Metadata } from 'next'
import AdminApp from '@/components/admin/AdminApp'

// the page is only a shell; every action goes through the password-protected /api
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

export default function Admin() {
  return <AdminApp />
}
