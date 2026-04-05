import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import './App.css'
import {
  buildFeedUrl,
  fetchFeed,
  filterStories,
  formatDate,
  readInitialFilters,
  writeFiltersToLocation,
} from './lib/hn'

function App() {
  const [form, setForm] = useState(() => readInitialFilters())
  const [requestFilters, setRequestFilters] = useState(() => {
    const initialFilters = readInitialFilters()
    return { count: initialFilters.count, points: initialFilters.points }
  })
  const [feed, setFeed] = useState({
    lastBuildDate: '',
    stories: [],
    title: 'Hacker News: Newest',
  })
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const deferredKeyword = useDeferredValue(form.keyword)

  useEffect(() => {
    writeFiltersToLocation({
      count: requestFilters.count,
      keyword: form.keyword,
      points: requestFilters.points,
    })
  }, [form.keyword, requestFilters])

  useEffect(() => {
    let cancelled = false

    async function loadFeed() {
      setStatus('loading')
      setError('')

      try {
        const nextFeed = await fetchFeed(buildFeedUrl(requestFilters))

        if (cancelled) {
          return
        }

        startTransition(() => {
          setFeed(nextFeed)
        })
        setStatus('success')
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the Hacker News feed.',
        )
        setStatus('error')
      }
    }

    void loadFeed()

    return () => {
      cancelled = true
    }
  }, [requestFilters])

  const visibleStories = filterStories(feed.stories, deferredKeyword)

  function handleInputChange(event) {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setRequestFilters({ count: form.count, points: form.points })
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">React 19 + Vite + concurrent filtering</p>
          <h1>Turn the Hacker News newest stream into a client-side command deck.</h1>
          <p className="intro">
            This version talks directly to <code>hn.algolia.com/api/v1/search_by_date</code>,
            which sends browser-safe CORS headers. Feed refreshes are wrapped in{' '}
            <code>startTransition</code>, and keyword filtering stays responsive via{' '}
            <code>useDeferredValue</code>.
          </p>

          <div className="stats">
            <div className="stat-card">
              <span>Fetched at</span>
              <strong>{formatDate(feed.lastBuildDate)}</strong>
            </div>
            <div className="stat-card">
              <span>Fetched</span>
              <strong>{feed.stories.length} stories</strong>
            </div>
            <div className="stat-card">
              <span>Status</span>
              <strong>
                {status === 'loading'
                  ? 'Refreshing feed'
                  : `${visibleStories.length} stories visible`}
              </strong>
            </div>
          </div>
        </div>

        <form className="control-panel" onSubmit={handleSubmit}>
          <label>
            <span>Minimum points</span>
            <select name="points" value={form.points} onChange={handleInputChange}>
              <option value="1">1+</option>
              <option value="20">20+</option>
              <option value="50">50+</option>
              <option value="100">100+</option>
            </select>
          </label>

          <label>
            <span>Story count</span>
            <select name="count" value={form.count} onChange={handleInputChange}>
              <option value="6">6 stories</option>
              <option value="12">12 stories</option>
              <option value="18">18 stories</option>
              <option value="24">24 stories</option>
            </select>
          </label>

          <label>
            <span>Keyword</span>
            <input
              name="keyword"
              type="search"
              value={form.keyword}
              onChange={handleInputChange}
              placeholder="Search title, author, or domain"
            />
          </label>

          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Refreshing…' : 'Refresh feed'}
          </button>
        </form>
      </section>

      {error ? <p className="feedback error">{error}</p> : null}
      {!error && status === 'loading' ? (
        <p className="feedback">Loading the newest stories from Hacker News.</p>
      ) : null}

      <section className="story-grid">
        {visibleStories.map((story) => (
          <article key={story.id} className="story-card">
            <div className="badges">
              <span>{story.points} pts</span>
              <span>{story.commentCount} comments</span>
              <span>{story.domain}</span>
            </div>

            <div className="story-body">
              <h2>
                <a href={story.link} target="_blank" rel="noreferrer">
                  {story.title}
                </a>
              </h2>
              <p>
                Posted by <strong>{story.author}</strong> ·{' '}
                {formatDate(story.publishedAt)}
              </p>
            </div>

            <div className="story-footer">
              <a href={story.commentsUrl} target="_blank" rel="noreferrer">
                HN discussion
              </a>
              <span>#{story.id}</span>
            </div>
          </article>
        ))}
      </section>

      {visibleStories.length === 0 ? (
        <section className="empty-state">
          No stories matched the current filters. Lower the threshold or clear
          the keyword and try again.
        </section>
      ) : null}
    </main>
  )
}

export default App
