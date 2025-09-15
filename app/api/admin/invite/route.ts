// app/api/admin/invite/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

export async function POST(req: Request) {
  try {
    const { email, leagueId } = (await req.json()) as {
      email?: string
      leagueId?: string
    }

    if (!email || !leagueId) {
      return NextResponse.json(
        { error: 'email and leagueId are required' },
        { status: 400 }
      )
    }

    // Build the redirect URL that the magic link will land on
    // NEXT_PUBLIC_SITE_URL is best; fall back to Vercel URL; final hardcoded domain as last resort.
    const site =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.the-big-board.fun')

    const redirectTo = `${site}/?leagueId=${encodeURIComponent(leagueId)}`

    const supabase = createServerClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}
