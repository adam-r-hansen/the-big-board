// app/api/profile/password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Validate password: 6+ chars, has letters AND numbers
function validatePassword(pw: string): string | null {
  if (pw.length < 6) {
    return 'Oops! Password needs at least 6 characters'
  }
  const hasLetter = /[a-zA-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  if (!hasLetter || !hasNumber) {
    return 'Oops! Password needs at least one letter and one number'
  }
  return null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: any = {}
  try { body = await req.json() } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const newPassword = body?.newPassword as string | undefined
  const oldPassword = body?.oldPassword as string | undefined
  const isChanging = !!oldPassword

  if (!newPassword) {
    return NextResponse.json({ error: 'newPassword required' }, { status: 400 })
  }

  // Validate new password
  const validationError = validatePassword(newPassword)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // If changing password, verify old password first
  if (isChanging) {
    if (!user.email) {
      return NextResponse.json({ error: 'Email required for password change' }, { status: 400 })
    }

    // Re-authenticate with old password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { error: 'Oops! Old password is incorrect' },
        { status: 400 }
      )
    }
  }

  // Update password in Supabase auth
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || 'Failed to update password' },
      { status: 500 }
    )
  }

  // Mark in profiles table that user has password
  await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        has_password: true,
      },
      { onConflict: 'id' }
    )

  return NextResponse.json({ 
    ok: true,
    message: isChanging 
      ? 'Password updated successfully!' 
      : 'Password set! You can now use it to sign in'
  })
}
