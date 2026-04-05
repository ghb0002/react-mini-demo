const FEED_BASE_URL = 'https://hnrss.org/newest'

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
  const url = new URL(FEED_BASE_URL)
  url.searchParams.set('count', filters.count)
  url.searchParams.set('points', filters.points)
  return url.toString()
}

export async function fetchFeedXml(url) {
  try {
    return await requestText(url)
  } catch {
    return requestText(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
  }
}

export function parseHnFeed(xml) {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(xml, 'application/xml')
  const items = Array.from(documentNode.querySelectorAll('item'))

  return {
    lastBuildDate: getText(documentNode, 'lastBuildDate'),
    stories: items.map((item) => parseStory(item)),
    title: getText(documentNode, 'channel > title') || 'Hacker News: Newest',
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

async function requestText(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
  })

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`)
  }

  return response.text()
}

function parseStory(item) {
  const description = getText(item, 'description')
  const commentsUrl = getText(item, 'comments')
  const link = getText(item, 'link')

  return {
    author: getNamespacedText(item, 'creator') || 'unknown',
    commentsUrl,
    commentCount: extractMetric(description, '# Comments'),
    domain: extractDomain(link),
    id: extractStoryId(commentsUrl),
    link,
    points: extractMetric(description, 'Points'),
    publishedAt: getText(item, 'pubDate'),
    title: getText(item, 'title'),
  }
}

function getText(root, selector) {
  return root.querySelector(selector)?.textContent?.trim() ?? ''
}

function getNamespacedText(root, localName) {
  const node = Array.from(root.children).find((element) => element.localName === localName)
  return node?.textContent?.trim() ?? ''
}

function extractMetric(description, label) {
  const match = description.match(new RegExp(`${label}:\\s*(\\d+)`, 'i'))
  return Number(match?.[1] ?? 0)
}

function extractDomain(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return 'news.ycombinator.com'
  }
}

function extractStoryId(commentsUrl) {
  const match = commentsUrl.match(/item\?id=(\d+)/)
  return match?.[1] ?? commentsUrl
}

function normalizeChoice(value, fallback) {
  return value ? String(value) : fallback
}
