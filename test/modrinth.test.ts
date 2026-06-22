import { describe, expect, it } from 'vitest'
import { buildFacets } from '../src/main/modrinth'

describe('buildFacets', () => {
  it('always constrains to mods', () => {
    const facets = JSON.parse(buildFacets({ query: 'sodium' }))
    expect(facets).toContainEqual(['project_type:mod'])
  })

  it('adds a version group when a game version is given', () => {
    const facets = JSON.parse(buildFacets({ query: 'x', gameVersion: '1.20.1' }))
    expect(facets).toContainEqual(['versions:1.20.1'])
  })

  it('adds a loader category group when a loader is given', () => {
    const facets = JSON.parse(buildFacets({ query: 'x', loader: 'fabric' }))
    expect(facets).toContainEqual(['categories:fabric'])
  })

  it('combines loader and version filters', () => {
    const facets = JSON.parse(
      buildFacets({ query: 'x', loader: 'forge', gameVersion: '1.19.2' })
    )
    expect(facets).toEqual([
      ['project_type:mod'],
      ['versions:1.19.2'],
      ['categories:forge']
    ])
  })

  it('omits optional groups when not provided', () => {
    const facets = JSON.parse(buildFacets({ query: 'x' }))
    expect(facets).toEqual([['project_type:mod']])
  })
})
