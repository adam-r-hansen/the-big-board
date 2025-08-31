export function createClient() {
  const state = {
    authedUserId: '00000000-0000-4000-8000-000000000001',
    picks: [] as Array<any>,
    games: [] as Array<any>,
    league_members: [{ league_id: 'L1', profile_id: '00000000-0000-4000-8000-000000000001', role: 'MEMBER' }],
  }

  return {
    auth: { async getUser() { return { data: { user: { id: state.authedUserId } } } } },
    from(table: string) {
      const tbl = (state as any)[table]
      return {
        select(_cols: string, opts?: any) {
          const head = opts?.head ?? false
          return {
            eq(col: string, val: any) {
              const rows = tbl.filter((r: any) => r[col] === val)
              return {
                eq(col2: string, val2: any) {
                  const rows2 = rows.filter((r: any) => r[col2] === val2)
                  return head ? { data: null, count: rows2.length, error: null } :
                    { data: rows2, error: null, limit(){return this}, maybeSingle(){return {data: rows2[0]??null, error:null}} }
                },
                limit(){return this},
                maybeSingle(){ return { data: rows[0] ?? null, error: null } }
              }
            },
            or(){return this},
            limit(){return this},
            maybeSingle(){ return { data: tbl[0] ?? null, error: null } }
          }
        },
        insert(rows: any[]) {
          tbl.push(...rows)
          return { select(){return this}, limit(){return this}, maybeSingle(){ return { data: tbl.at(-1) ?? null, error: null } } }
        },
        delete() {
          return { eq(col: string, val: any) {
            const before = tbl.length
            ;(state as any)[table] = tbl.filter((r: any) => r[col] !== val)
            return { error: null, count: before - (state as any)[table].length }
          }}
        },
      }
    },
    _state: state,
  }
}
