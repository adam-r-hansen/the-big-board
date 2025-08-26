import { type NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  if (!code) return redirect('/error')

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return redirect('/error')

  return redirect(next)
}
