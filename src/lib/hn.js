const API_BASE_URL = 'https://hn.algolia.com/api/v1/search_by_date'

export function readInitialFilters() {
  if (typeof window === 'undefined') {
    return { count: '12', keyword: '', points: '20' }
  }

  const searchParams = new URLSearchParams(window.location.search)

  return {
    count: normalizeChoice(searchParams.get('count'), '12'),
    keyword: searchParams.get('q') ?? '',
    points: normalizeChoice(searchParams.get('points'), '20'),
  }
}

export function writeFiltersToLocation(filters) {
  if (typeof window === 'undefined') {
    return
  }

  const searchParams = new URLSearchParams()
  searchParams.set('count', filters.count)
  searchParams.set('points', filters.points)

  if (filters.keyword) {
    searchParams.set('q', filters.keyword)
  }

  const nextUrl = `${window.location.pathname}?${searchParams.toString()}`
  window.history.replaceState({}, '', nextUrl)
}

export function buildFeedUrl(filters) {
  const url = new URL(API_BASE_URL)
  url.searchParams.set('tags', 'story')
  url.searchParams.set('hitsPerPage', filters.count)
  url.searchParams.set('numericFilters', `points>=${filters.points}`)
  return url.toString()
}

export async function fetchFeed(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`)
  }

  const payload = await response.json()
  return {
    lastBuildDate: new Date().toISOString(),
    stories: (payload.hits ?? []).map((item) => parseStory(item)),
    title: 'Hacker News: Newest',
  }
}

export function filterStories(stories, keyword) {
  const normalizedKeyword = keyword.trim().toLowerCase()

  if (!normalizedKeyword) {
    return stories
  }

  return stories.filter((story) =>
    [story.title, story.author, story.domain].some((value) =>
      value.toLowerCase().includes(normalizedKeyword),
    ),
  )
}

export function formatDate(dateString) {
  if (!dateString) {
    return 'Unavailable'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateString))
}

function parseStory(item) {
  const storyUrl = item.url || `https://news.ycombinator.com/item?id=${item.objectID}`
  const commentsUrl = `https://news.ycombinator.com/item?id=${item.objectID}`

  return {
    author: item.author || 'unknown',
    commentsUrl,
    commentCount: Number(item.num_comments ?? 0),
    domain: extractDomain(storyUrl),
    id: String(item.objectID ?? item.story_id ?? commentsUrl),
    link: storyUrl,
    points: Number(item.points ?? 0),
    publishedAt: item.created_at || '',
    title: item.title || item.story_title || 'Untitled Hacker News story',
  }
}

function extractDomain(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return 'news.ycombinator.com'
  }
}

function normalizeChoice(value, fallback) {
  return value ? String(value) : fallback
}
