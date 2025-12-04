// app/api/admin/update-team-records/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const revalidate = 0
export const dynamic = 'force-dynamic'

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/**
 * POST /api/admin/update-team-records
 * Calculates cumulative team records through the most recent completed week
 * Optionally accepts { season, week } in body to calculate through specific week
 * If not provided, auto-detects current season and most recent week with FINAL games
 */
export async function POST(req: NextRequest) {
  try {
    const sb = createAdminClient()
    
    // Parse optional body params
    let body: any = null
    try {
      body = await req.json().catch(() => null)
    } catch {
      // No body is fine, we'll auto-detect
    }

    let season = body?.season ? Number(body.season) : null
    let targetWeek = body?.week ? Number(body.week) : null

    // Auto-detect season if not provided
    if (!season) {
      const now = new Date()
      season = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
    }

    // Auto-detect most recent week with FINAL games if not provided
    if (!targetWeek) {
      const { data: latestGames, error: gErr } = await sb
        .from('games')
        .select('week')
        .eq('season', season)
        .eq('status', 'FINAL')
        .order('week', { ascending: false })
        .limit(1)
      
      if (gErr) {
        return json({ error: gErr.message, hint: 'failed to detect latest week' }, 500)
      }
      
      if (!latestGames || latestGames.length === 0) {
        return json({ 
          ok: true, 
          season, 
          note: 'no FINAL games found yet', 
          updated: 0 
        })
      }
      
      targetWeek = latestGames[0].week
    }

    // Get all teams
    const { data: teams, error: tErr } = await sb
      .from('teams')
      .select('id, abbreviation, name')
    
    if (tErr) {
      return json({ error: tErr.message, hint: 'failed to fetch teams' }, 500)
    }

    // Get all FINAL games through target week
    const { data: games, error: gamesErr } = await sb
      .from('games')
      .select('id, week, home_team, away_team, home_score, away_score, status')
      .eq('season', season)
      .lte('week', targetWeek)
      .eq('status', 'FINAL')
    
    if (gamesErr) {
      return json({ error: gamesErr.message, hint: 'failed to fetch games' }, 500)
    }

    // Calculate cumulative records for each team through each week
    const recordsByTeamWeek = new Map<string, { wins: number; losses: number; ties: number }>()
    
    for (const team of teams || []) {
      // Calculate cumulative record for each week 1 through targetWeek
      for (let week = 1; week <= targetWeek; week++) {
        let wins = 0
        let losses = 0
        let ties = 0
        
        // Count all games through this week
        const teamGames = (games || []).filter(g => 
          g.week <= week && (g.home_team === team.id || g.away_team === team.id)
        )
        
        for (const game of teamGames) {
          const isHome = game.home_team === team.id
          const teamScore = isHome ? game.home_score : game.away_score
          const oppScore = isHome ? game.away_score : game.home_score
          
          if (teamScore == null || oppScore == null) continue
          
          if (teamScore > oppScore) {
            wins++
          } else if (teamScore < oppScore) {
            losses++
          } else {
            ties++
          }
        }
        
        const key = `${team.id}-${week}`
        recordsByTeamWeek.set(key, { wins, losses, ties })
      }
    }

    // Build upsert rows
    const upsertRows = []
    for (const team of teams || []) {
      for (let week = 1; week <= targetWeek; week++) {
        const key = `${team.id}-${week}`
        const record = recordsByTeamWeek.get(key)
        
        if (!record) continue
        
        const totalGames = record.wins + record.losses + record.ties
        const winPct = totalGames > 0 
          ? (record.wins + (record.ties * 0.5)) / totalGames 
          : 0
        
        upsertRows.push({
          team_id: team.id,
          season,
          week,
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
          win_pct: winPct.toFixed(3),
        })
      }
    }

    if (upsertRows.length === 0) {
      return json({ 
        ok: true, 
        season, 
        week: targetWeek, 
        note: 'no records to update', 
        updated: 0 
      })
    }

    // Upsert to team_records
    const { data: upserted, error: uErr } = await sb
      .from('team_records')
      .upsert(upsertRows, { 
        onConflict: 'team_id,season,week',
        ignoreDuplicates: false 
      })
      .select('id')
    
    if (uErr) {
      return json({ 
        error: uErr.message, 
        hint: 'upsert failed',
        sample: upsertRows[0] 
      }, 500)
    }

    return json({ 
      ok: true, 
      season, 
      week: targetWeek,
      teams: teams?.length || 0,
      records_updated: upserted?.length || 0,
      total_rows: upsertRows.length
    })

  } catch (e: any) {
    return json({ error: e?.message || 'server error' }, 500)
  }
}
