// DP-Archives — Central project registry
// To add a project: copy an object, change the values. That's it.
// featured: true  → large card in the Featured section on the homepage
// url / github    → paste real links when ready (empty = button hidden on details page)
// accent          → hex color used for the icon block on the details page
window.DP_PROJECTS = [
  {
    slug: 'aegis',
    name: 'Aegis',
    tagline: 'Security-first dashboard for digital assets',
    description: 'Aegis gives you a single pane of glass for monitoring access, permissions and activity across your digital properties. Live status, audit trails and alerts — without the noise.',
    category: 'Tools',
    status: 'Live',
    tech: ['Next.js', 'TypeScript', 'Supabase'],
    featured: true,
    updated: '2026-09-08',
    url: '',
    github: '',
    accent: '#34d399'
  },
  {
    slug: 'kharchaas',
    name: 'Kharchaas',
    tagline: 'Expense tracking with real insights',
    description: 'Kharchaas makes tracking daily spend effortless — log expenses in seconds, see where money goes with clean visualisations, and set budgets that actually stick.',
    category: 'Productivity',
    status: 'Live',
    tech: ['React', 'Node.js', 'PostgreSQL'],
    featured: true,
    updated: '2026-09-05',
    url: '',
    github: '',
    accent: '#a78bfa'
  },
  {
    slug: 'dp-archives-hub',
    name: 'DP-Archives Hub',
    tagline: 'The central headquarters itself',
    description: 'The site you are on right now — one URL for everything built. Designed as a living ecosystem: discover projects, open live products and explore the tech behind them.',
    category: 'Websites',
    status: 'Live',
    tech: ['HTML', 'Tailwind CSS', 'JavaScript'],
    featured: false,
    updated: '2026-09-11',
    url: 'index.html',
    github: '',
    accent: '#60a5fa'
  },
  {
    slug: 'flow-canvas',
    name: 'Flow Canvas',
    tagline: 'Visual workflow builder for AI',
    description: 'Chain prompts, tools and logic on an infinite canvas. Flow Canvas turns AI experiments into repeatable workflows you can run, share and version.',
    category: 'AI',
    status: 'Beta',
    tech: ['React', 'WebGL', 'IndexedDB'],
    featured: false,
    updated: '2026-08-30',
    url: '',
    github: '',
    accent: '#f472b6'
  },
  {
    slug: 'pixel-lab',
    name: 'Pixel Lab',
    tagline: 'A playground for UI micro-interactions',
    description: 'Small, obsessive experiments in motion and interaction — springs, gestures and transitions, each one documented with the code that powers it.',
    category: 'Experiments',
    status: 'Live',
    tech: ['Framer Motion', 'CSS'],
    featured: false,
    updated: '2026-08-22',
    url: '',
    github: '',
    accent: '#fbbf24'
  }
];
