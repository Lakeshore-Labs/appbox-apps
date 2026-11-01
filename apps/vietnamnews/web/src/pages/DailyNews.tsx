import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Newspaper,
  Flame,
  Bookmark,
  Calendar,
  Sparkles,
  ExternalLink,
  Plus,
  Search,
  Globe,
  TrendingUp,
  Clock,
  BookOpen,
  X,
  Volume2,
  RefreshCw
} from 'lucide-react'
import {
  listArticlesOptions,
  listCategorysOptions,
  listDailyBriefingsOptions,
  createArticleMutation,
  createCategoryMutation,
  createDailyBriefingMutation,
  fetchLiveRSSNewsOptions
} from '@/gen'
import { ArticleKind, DailyBriefingKind } from '@/gen/kinds.gen'
import {
  Button,
  ContentSection,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Form,
  Frame,
  FramePanel,
  Skeleton,
  StatusBadge,
  toast
} from '@appbox/platform-web'

interface ArticleItem {
  id: number | string
  title: string
  summary: string
  content: string
  source: string
  sourceUrl?: string | null
  imageUrl?: string | null
  publishedAt: string
  isFeatured: boolean
  isBreaking: boolean
  categoryId?: any
  categoryName?: string
}

export function DailyNews() {
  const queryClient = useQueryClient()
  const articles = useQuery(listArticlesOptions())
  const categories = useQuery(listCategorysOptions())
  const briefings = useQuery(listDailyBriefingsOptions())
  const liveRssQuery = useQuery(fetchLiveRSSNewsOptions())

  const [activeTab, setActiveTab] = useState<'briefing' | 'latest' | 'breaking' | 'saved'>('briefing')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set())
  const [readingArticle, setReadingArticle] = useState<ArticleItem | null>(null)
  const [showAddArticle, setShowAddArticle] = useState<boolean>(false)
  const [showAddBriefing, setShowAddBriefing] = useState<boolean>(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false)

  const handleSyncRSS = async () => {
    try {
      const res = await liveRssQuery.refetch()
      toast.success(`Live RSS Feeds Synced! (${res.data ?? 0} articles updated)`)
      queryClient.invalidateQueries()
    } catch (e: any) {
      toast.error('Sync failed', { description: e.message })
    }
  }

  const createArticle = useMutation({
    ...createArticleMutation(),
    onSuccess: () => {
      toast.success('News article published successfully!')
      setShowAddArticle(false)
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error('Failed to publish article', { description: e.message })
  })

  const createBriefing = useMutation({
    ...createDailyBriefingMutation(),
    onSuccess: () => {
      toast.success('Daily Morning Briefing posted!')
      setShowAddBriefing(false)
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error('Failed to post briefing', { description: e.message })
  })

  const createCat = useMutation({
    ...createCategoryMutation(),
    onSuccess: () => queryClient.invalidateQueries()
  })

  // Seed default data if completely empty
  useEffect(() => {
    if (
      articles.isSuccess &&
      categories.isSuccess &&
      briefings.isSuccess &&
      Array.isArray(articles.data) &&
      articles.data.length === 0 &&
      Array.isArray(categories.data) &&
      categories.data.length === 0
    ) {
      seedInitialVietnamNews()
    }
  }, [articles.isSuccess, categories.isSuccess, briefings.isSuccess, articles.data, categories.data])

  async function seedInitialVietnamNews() {
    try {
      toast.info('Initializing Vietnam News feed with daily content...')
      // 1. Create categories
      const catBiz = await createCat.mutateAsync({ body: { name: 'Business & Economy', slug: 'business' } })
      const catTech = await createCat.mutateAsync({ body: { name: 'Tech & Innovation', slug: 'tech' } })
      const catCulture = await createCat.mutateAsync({ body: { name: 'Culture & Tourism', slug: 'culture' } })
      const catInfra = await createCat.mutateAsync({ body: { name: 'Infrastructure & Energy', slug: 'infrastructure' } })

      const bizId = catBiz?.id ?? null
      const techId = catTech?.id ?? null
      const cultureId = catCulture?.id ?? null
      const infraId = catInfra?.id ?? null

      // 2. Create Briefing
      await createBriefing.mutateAsync({
        body: {
          title: 'Vietnam Morning Briefing: GDP Target 7.0%, High-Speed Rail & Tech Inflows',
          briefDate: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          summary: 'Good morning! Vietnam sets ambitious economic goals with 7.0% GDP projection for 2025. Parliament approves the $67B North-South high-speed rail, while semiconductor investments accelerate across Hanoi and Ho Chi Minh City.',
          highlights: '• GDP Target: National Assembly aims for 7.0% growth driven by manufacturing & FDI.\n• High-Speed Rail: 1,541 km North-South line approved for 350 km/h passenger service.\n• Semiconductor Hubs: Vietnam National University opens dedicated chip design and AI labs.\n• Eco-Tourism: Ha Long Bay & Phong Nha recognized for sustainable tourist practices.\n• Trade Surplus: Record electronics export figures posted for Q3.'
        }
      })

      // 3. Create initial articles
      await createArticle.mutateAsync({
        body: {
          categoryId: bizId,
          title: 'Vietnam Targets GDP Growth of 7.0% in 2025 as Manufacturing and Exports Surge',
          summary: "Vietnam's National Assembly sets ambitious economic targets driven by robust foreign direct investment (FDI) inflows, strong electronics manufacturing, and expanded trade agreements.",
          content: "HANOI — Vietnam's economic trajectory continues to gain momentum with projected GDP growth targeting 7.0% for 2025. Key economic drivers include high-tech electronics manufacturing, expanded semiconductor testing facilities in Bắc Ninh and Đà Nẵng, and growing agricultural export revenues.\n\nForeign Direct Investment (FDI) disbursed in the first three quarters reached $17.3 billion, up 8.9% year-on-year. Major investments from international technology titans have accelerated Vietnam's integration into high-value global supply chains.\n\nThe Minister of Planning and Investment highlighted that institutional reforms, digital infrastructure investments, and green transition initiatives are laying solid foundations for sustainable long-term development.",
          source: 'Vietnam News Agency (VNA)',
          sourceUrl: 'https://vietnamnews.vn',
          imageUrl: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=800&q=80',
          publishedAt: new Date().toISOString(),
          isFeatured: true,
          isBreaking: false
        }
      })

      await createArticle.mutateAsync({
        body: {
          categoryId: techId,
          title: 'Hanoi & Ho Chi Minh City Launch AI Innovation Hubs for Semiconductor Development',
          summary: 'Vietnam accelerates its high-tech roadmap with dedicated artificial intelligence labs and chip design centers supported by international tech partnerships.',
          content: 'HO CHI MINH CITY — Vietnam has officially inaugurated two national AI and semiconductor development hubs located in Saigon Hi-Tech Park and Vietnam National University Hanoi.\n\nThe hubs aim to train 50,000 semiconductor engineers by 2030, establishing Vietnam as a regional center for chip design, assembly, and AI software testing. Government incentives include 10-year corporate tax exemptions and research grants for tech startups.',
          source: 'VnExpress International',
          sourceUrl: 'https://e.vnexpress.net',
          imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
          publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          isFeatured: true,
          isBreaking: true
        }
      })

      await createArticle.mutateAsync({
        body: {
          categoryId: cultureId,
          title: 'Ha Long Bay & Phong Nha-Ke Bang Named Top Sustainable Travel Destinations in Asia',
          summary: 'UNESCO World Heritage sites in Vietnam receive international acclaim for eco-tourism preservation, community-led conservation, and sustainable cave exploration.',
          content: 'QUẢNG NINH — Vietnam\'s iconic natural wonders have earned top international accolades for eco-friendly tourism practices.\n\nLocal authorities in Quảng Ninh have introduced strict zero-single-use-plastic zones across Ha Long Bay cruise operators, while Phong Nha-Ke Bang National Park expanded community guide programs that protect delicate karst ecosystems while supporting local village economies.\n\nInternational arrivals to Vietnam reached over 12.5 million visitors this year, with eco-tourism and cultural heritage trails leading the growth.',
          source: 'VietnamPlus Travel',
          sourceUrl: 'https://en.vietnamplus.vn',
          imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80',
          publishedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          isFeatured: false,
          isBreaking: false
        }
      })

      await createArticle.mutateAsync({
        body: {
          categoryId: infraId,
          title: 'North-South High-Speed Rail Megaproject Approved by National Assembly',
          summary: 'The landmark 1,541 km high-speed passenger rail connecting Hanoi and Ho Chi Minh City promises to transform logistics, travel time, and regional trade.',
          content: 'HANOI — In a historic decision, Vietnam\'s National Assembly approved the construction of the North-South high-speed railway project with a design speed of 350 km/h.\n\nSpanning 20 provinces between Hanoi and Ho Chi Minh City, the 1,541-kilometer railway will feature 23 passenger stations and 5 freight hubs. Construction is slated to start in 2027 with full completion targeted for 2035, drastically cutting transit time between the nation\'s two largest metropolitan hubs to under 5 hours.',
          source: 'Tuoi Tre News',
          sourceUrl: 'https://tuoitrenews.vn',
          imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80',
          publishedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
          isFeatured: false,
          isBreaking: true
        }
      })

      toast.success('Vietnam News feed initialized!')
    } catch (err: any) {
      console.error('Error seeding news:', err)
    }
  }

  const toggleBookmark = (id: string | number) => {
    const key = String(id)
    setSavedArticleIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        toast.info('Article removed from bookmarks')
      } else {
        next.add(key)
        toast.success('Article saved to bookmarks!')
      }
      return next
    })
  }

  const articleList = Array.isArray(articles.data) ? articles.data : []
  const categoryList = Array.isArray(categories.data) ? categories.data : []
  const briefingList = Array.isArray(briefings.data) ? briefings.data : []

  const allArticles: ArticleItem[] = articleList.map((a: any) => {
    const cat = categoryList.find((c: any) => String(c.id) === String(a.categoryId?.id || a.categoryId))
    return {
      id: a.id,
      title: a.title,
      summary: a.summary,
      content: a.content,
      source: a.source || 'Vietnam News',
      sourceUrl: a.sourceUrl,
      imageUrl: a.imageUrl,
      publishedAt: a.publishedAt,
      isFeatured: a.isFeatured,
      isBreaking: a.isBreaking,
      categoryName: cat?.name || 'General News'
    }
  })

  const filteredArticles = allArticles.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCat = selectedCategory === 'all' || item.categoryName === selectedCategory

    if (activeTab === 'breaking') return matchesSearch && item.isBreaking
    if (activeTab === 'saved') return matchesSearch && savedArticleIds.has(String(item.id))
    return matchesSearch && matchesCat
  })

  const breakingArticles = allArticles.filter((a) => a.isBreaking)
  const featuredArticles = allArticles.filter((a) => a.isFeatured)
  const latestBriefing = briefingList.length > 0 ? briefingList[0] : null

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <ContentSection
      wide
      title="VIETNAM NEWS DAILY"
      desc={`Daily digest of breaking news, economic briefings, business, culture, and innovation. ${todayDateStr}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={liveRssQuery.isFetching}
            onClick={handleSyncRSS}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${liveRssQuery.isFetching ? 'animate-spin' : ''}`} />
            Sync Live RSS Feeds
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddBriefing(!showAddBriefing)}>
            <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" />
            New Briefing
          </Button>
          <Button size="sm" onClick={() => setShowAddArticle(!showAddArticle)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Publish Story
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header Branding Banner */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-600 via-red-700 to-amber-600 text-white rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl">
              <Newspaper className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xl tracking-wide">VIETNAM NEWS</h1>
                <StatusBadge variant="info-light" className="bg-white/20 text-white border-0">Live RSS Sync Active</StatusBadge>
              </div>
              <p className="text-xs text-white/80 font-normal flex items-center gap-2 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                {todayDateStr} • Live Feeds from VnExpress & VietnamPlus
              </p>
            </div>
          </div>
        </div>

        {/* Weather & Exchange Rate Ticker */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-xl border text-xs">
          <div className="flex items-center justify-between px-2">
            <span className="text-muted-foreground font-medium">Hà Nội Weather:</span>
            <span className="font-semibold">28°C ☀️ Fair</span>
          </div>
          <div className="flex items-center justify-between px-2 border-l">
            <span className="text-muted-foreground font-medium">TP. Hồ Chí Minh:</span>
            <span className="font-semibold">32°C ⛅ Warm</span>
          </div>
          <div className="flex items-center justify-between px-2 border-l">
            <span className="text-muted-foreground font-medium">USD / VND:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">25,380 📈</span>
          </div>
          <div className="flex items-center justify-between px-2 border-l">
            <span className="text-muted-foreground font-medium">VN-Index:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">1,285.40 (+0.6%)</span>
          </div>
        </div>

        {/* Breaking News Ticker Bar */}
        {breakingArticles.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white rounded-md text-xs font-bold tracking-wider uppercase shrink-0 animate-pulse">
              <Flame className="w-3.5 h-3.5" />
              BREAKING
            </div>
            <div className="overflow-hidden text-sm font-medium text-red-950 dark:text-red-200 truncate flex-1">
              {breakingArticles[0].title}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-red-700 dark:text-red-300 hover:text-red-800"
              onClick={() => setReadingArticle(breakingArticles[0])}
            >
              Read story &rarr;
            </Button>
          </div>
        )}

        {/* Forms for Adding Articles or Briefings */}
        {showAddArticle && (
          <Frame>
            <FramePanel className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-primary" />
                  Publish New Vietnam News Story
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setShowAddArticle(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Form
                kind={ArticleKind}
                onDone={() => {
                  setShowAddArticle(false)
                  queryClient.invalidateQueries()
                  toast.success('Story published!')
                }}
                onCancel={() => setShowAddArticle(false)}
              />
            </FramePanel>
          </Frame>
        )}

        {showAddBriefing && (
          <Frame>
            <FramePanel className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Post Vietnam Daily Morning Briefing
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setShowAddBriefing(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Form
                kind={DailyBriefingKind}
                onDone={() => {
                  setShowAddBriefing(false)
                  queryClient.invalidateQueries()
                  toast.success('Morning briefing posted!')
                }}
                onCancel={() => setShowAddBriefing(false)}
              />
            </FramePanel>
          </Frame>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('briefing')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'briefing'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Daily Briefing
            </button>
            <button
              onClick={() => setActiveTab('latest')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'latest'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Globe className="w-4 h-4" />
              Latest News ({allArticles.length})
            </button>
            <button
              onClick={() => setActiveTab('breaking')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'breaking'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Flame className="w-4 h-4 text-red-500" />
              Breaking ({breakingArticles.length})
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'saved'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Bookmark className="w-4 h-4 text-blue-500" />
              Saved ({savedArticleIds.size})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Vietnam news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Tab 1: Daily Briefing View */}
        {activeTab === 'briefing' && (
          <div className="space-y-6">
            {latestBriefing ? (
              <Frame>
                <FramePanel className="p-6 bg-gradient-to-br from-amber-50/50 via-background to-red-50/30 dark:from-amber-950/20 dark:to-red-950/20 border-amber-200/60 dark:border-amber-900/40">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/50 dark:border-amber-900/30 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-amber-500 text-white font-semibold text-xs rounded-md uppercase tracking-wide">
                          Morning Briefing
                        </span>
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {latestBriefing.briefDate}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsPlayingAudio(!isPlayingAudio)
                          toast.info(isPlayingAudio ? 'Audio playback paused' : 'Playing AI audio summary of today’s briefing...')
                        }}
                      >
                        <Volume2 className={`w-4 h-4 mr-1.5 ${isPlayingAudio ? 'text-green-500 animate-pulse' : ''}`} />
                        {isPlayingAudio ? 'Pause Audio' : 'Listen Summary'}
                      </Button>
                    </div>

                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-foreground">{latestBriefing.title}</h2>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{latestBriefing.summary}</p>
                    </div>

                    <div className="p-4 bg-background/80 backdrop-blur rounded-xl border border-amber-200/40 dark:border-amber-900/30 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        Key Highlights & Takeaways
                      </h4>
                      <div className="text-sm leading-relaxed whitespace-pre-line font-normal text-foreground/90">
                        {latestBriefing.highlights}
                      </div>
                    </div>
                  </div>
                </FramePanel>
              </Frame>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No Daily Briefing Yet</EmptyTitle>
                  <EmptyDescription>Post today's morning briefing to summarize key Vietnam news updates.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="sm" onClick={() => setShowAddBriefing(true)}>
                    Post Today's Briefing
                  </Button>
                </EmptyContent>
              </Empty>
            )}

            {/* Featured Stories Carousel/Grid */}
            {featuredArticles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-500" />
                  Top Vietnam Headlines
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featuredArticles.map((article) => (
                    <div
                      key={article.id}
                      onClick={() => setReadingArticle(article)}
                      className="group cursor-pointer rounded-xl border bg-card hover:border-primary/50 transition-all overflow-hidden flex flex-col justify-between"
                    >
                      {article.imageUrl && (
                        <div className="h-44 w-full overflow-hidden relative">
                          <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-3 left-3 flex gap-1.5">
                            <span className="px-2 py-0.5 bg-black/70 backdrop-blur text-white text-[10px] font-semibold rounded-md">
                              {article.categoryName}
                            </span>
                            {article.isBreaking && (
                              <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-semibold rounded-md flex items-center gap-1">
                                <Flame className="w-3 h-3" /> BREAKING
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-base group-hover:text-primary transition-colors line-clamp-2">
                            {article.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3 leading-relaxed">
                            {article.summary}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t mt-3">
                          <span className="font-medium text-foreground">{article.source}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2, 3, 4: News Feed List & Filtering */}
        {activeTab !== 'briefing' && (
          <div className="space-y-4">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All Topics
              </button>
              {categoryList.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${
                    selectedCategory === cat.name
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Articles List */}
            {articles.isPending ? (
              <div className="grid gap-3">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : filteredArticles.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No News Articles Found</EmptyTitle>
                  <EmptyDescription>
                    {activeTab === 'saved'
                      ? "You haven't bookmarked any articles yet. Click the bookmark icon on any story to save it here!"
                      : 'No articles match your current search or category filter.'}
                  </EmptyDescription>
                </EmptyHeader>
                {activeTab !== 'saved' && (
                  <EmptyContent>
                    <Button size="sm" onClick={() => setShowAddArticle(true)}>
                      Publish a Story
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredArticles.map((article) => {
                  const isSaved = savedArticleIds.has(String(article.id))
                  return (
                    <div
                      key={article.id}
                      className="group border rounded-xl bg-card hover:border-primary/50 transition-all overflow-hidden flex flex-col justify-between p-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary font-medium rounded-md">
                            {article.categoryName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {article.isBreaking && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-semibold rounded text-[10px]">
                                BREAKING
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleBookmark(article.id)
                              }}
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                              title={isSaved ? 'Remove Bookmark' : 'Save Article'}
                            >
                              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-blue-500 text-blue-500' : ''}`} />
                            </button>
                          </div>
                        </div>

                        <h3
                          onClick={() => setReadingArticle(article)}
                          className="font-bold text-base cursor-pointer group-hover:text-primary transition-colors line-clamp-2"
                        >
                          {article.title}
                        </h3>

                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {article.summary}
                        </p>
                      </div>

                      <div className="pt-3 border-t mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">{article.source}</span>
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(article.publishedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReadingArticle(article)}>
                            <BookOpen className="w-3.5 h-3.5 mr-1" /> Read
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Full Article Reader Modal / Drawer */}
        {readingArticle && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl my-8 relative">
              <button
                onClick={() => setReadingArticle(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-primary/10 text-primary font-semibold text-xs rounded-md">
                  {readingArticle.categoryName}
                </span>
                {readingArticle.isBreaking && (
                  <span className="px-2 py-0.5 bg-red-600 text-white font-bold text-xs rounded-md flex items-center gap-1">
                    <Flame className="w-3 h-3" /> BREAKING NEWS
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-snug">
                {readingArticle.title}
              </h1>

              <div className="flex items-center justify-between text-xs text-muted-foreground border-y py-2.5">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">{readingArticle.source}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(readingArticle.publishedAt).toLocaleString()}
                  </span>
                  <button
                    onClick={() => toggleBookmark(readingArticle.id)}
                    className="flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${savedArticleIds.has(String(readingArticle.id)) ? 'fill-current' : ''}`} />
                    {savedArticleIds.has(String(readingArticle.id)) ? 'Saved' : 'Bookmark'}
                  </button>
                </div>
              </div>

              {readingArticle.imageUrl && (
                <div className="rounded-xl overflow-hidden max-h-64 w-full">
                  <img src={readingArticle.imageUrl} alt={readingArticle.title} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="p-3 bg-muted/30 rounded-xl border text-xs text-muted-foreground italic font-medium">
                "{readingArticle.summary}"
              </div>

              <div className="text-sm leading-relaxed whitespace-pre-line space-y-3 font-normal text-foreground/90">
                {readingArticle.content}
              </div>

              <div className="flex items-center justify-between pt-4 border-t text-xs">
                {readingArticle.sourceUrl ? (
                  <a
                    href={readingArticle.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline font-medium"
                  >
                    <ExternalLink className="w-4 h-4" /> Visit original source ({readingArticle.source})
                  </a>
                ) : (
                  <span className="text-muted-foreground">Source: {readingArticle.source}</span>
                )}
                <Button size="sm" variant="outline" onClick={() => setReadingArticle(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ContentSection>
  )
}
