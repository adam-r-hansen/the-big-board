# The Big Board - Technical Debt & Future Improvements

## High Priority

### Dev → Main Branch Strategy
**Problem:** Dev branch is 225 commits ahead of main. Vercel deploys from dev, but it's unclear what main represents. This causes confusion with GitHub Actions, releases, and version history.

**Options:**
1. **Make dev the default branch** - Rename dev to main, archive old main
2. **Regular merges** - Set up automated PR from dev→main weekly
3. **Gitflow model** - Use main for production releases, dev for ongoing work
4. **Trunk-based** - Collapse to single main branch, use feature branches

**Recommendation:** Option 1 (make dev the official main) since dev IS production

**Impact:** Medium effort, high value for clarity and workflow automation

---

## Medium Priority

### Playoff System
- Test full playoff flow before Week 17 (end-to-end with real data)
- Monitor GitHub Action runs during Week 17-18
- Consider adding email notifications on transition failures

### Performance
- Review database indexes for playoff queries
- Consider caching playoff standings during active rounds

---

## Low Priority / Nice to Have

### Code Organization
- Consolidate duplicate TeamCard/Chip components
- Standardize API error responses
- Add API rate limiting

### User Experience
- Add loading skeletons on playoff page
- Improve mobile navigation on smaller screens
- Add playoff bracket visualization (future enhancement)

---

## Documentation Needed
- Deployment process documentation
- Branch strategy documentation
- Playoff system admin guide

---

_Last updated: November 29, 2025_
