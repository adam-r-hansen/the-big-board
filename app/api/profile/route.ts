import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE
  if (!url || !key) throw new Error('Supabase URL or service role key missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { get: (n)=>cookieStore.get(n)?.value, set(){}, remove(){} } }
  )
  const { data } = await supabase.auth.getUser()
  return data.user || null
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ profile:null })
    const sb = service()
    const { data } = await sb.from('profiles').select('id, email, display_name').eq('id', user.id).single()
    return NextResponse.json({ profile: data || { id:user.id, email:user.email, display_name:null } })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message||'Server error' }, { status:500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error:'Unauthorized' }, { status:401 })
    const body = await req.json()
    const display_name = body?.display_name ?? null
    const sb = service()
    await sb.from('profiles').upsert({ id:user.id, email:user.email, display_name })
    return NextResponse.json({ ok:true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message||'Server error' }, { status:500 })
  }
}
