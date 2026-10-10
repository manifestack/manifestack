---
# generated, edit catalog/vendors/mux.md (then run: node tools/sync.mjs)
schema: 1
id: mux
name: Mux
roles: [storage]
detect:
  packages: ["@mux/", "mux-embed", "videojs-mux", "next-video", "@videojs/mux-video", "@videojs/mux-data"]
  pypi: ["mux-python"]
  go: ["github.com/muxinc/mux-go"]
  imports: ["@mux/", "mux-embed", "videojs-mux", "next-video", "@videojs/mux-video", "@videojs/mux-data"]
  env_prefixes: ["MUX_TOKEN_", "MUX_WEBHOOK_", "MUX_SIGNING_", "MUX_PRIVATE_KEY", "MUX_AUTHORIZATION_TOKEN", "MUX_DATA_", "MUX_ENV_KEY", "NEXT_PUBLIC_MUX_", "VITE_MUX_", "PUBLIC_MUX_", "EXPO_PUBLIC_MUX_"]
  config_files: []
pages:
  pricing: https://www.mux.com/pricing
  pricing_text: https://www.mux.com/pricing.md
  pricing_overview: https://www.mux.com/docs/pricing/overview
  estimating_costs: https://www.mux.com/docs/pricing/estimating-video-costs
  optimizing_costs: https://www.mux.com/docs/pricing/optimizing-video-costs
  cost_reports: https://www.mux.com/docs/pricing/report-on-mux-costs
  quality_levels: https://www.mux.com/docs/guides/use-video-quality-levels
  static_renditions: https://www.mux.com/docs/guides/enable-static-mp4-renditions
  playback_resolution: https://www.mux.com/docs/guides/control-playback-resolution
  live_faq: https://www.mux.com/docs/guides/live-streaming-faqs
  free_plan: https://www.mux.com/blog/free-plan
  data_pricing: https://data.mux.com/pricing
  data_privacy: https://www.mux.com/docs/guides/ensure-data-privacy-compliance
  security: https://www.mux.com/security
  dpa: https://www.mux.com/dpa
read:
  - plans (Free, Pay as you go, Launch and Scale pre-pay credits, Enterprise) and the usage credit, free delivery minutes and Robots units each includes
  - Free limits, i.e. an asset cap, no live streaming and a Mux badge on the player, lifted by adding a card
  - three meters billed per minute, i.e. input (encoding), storage (prorated) and delivery, each priced by resolution tier and video quality level (basic, plus, premium)
  - basic quality has free input and a one-month minimum storage charge; live needs plus or premium
  - automatic cold storage discounts for assets nobody watches, and that new assets start cold until first play
  - delivery includes buffered seconds that are never watched
  - static MP4 renditions billed for storage and delivery (advanced renditions also to generate); DRM, custom domains, simulcast and live captions as add-ons
  - live streams bill only while a feed is connected; every broadcast is recorded as an asset and billed as storage
  - pre-pay credits reset each cycle and overage is billed at pay-as-you-go rates; no spend cap
  - Mux Data free for video hosted on Mux, standalone Data billed by views
  - ISO 27001, the DPA, Data Privacy Framework; no region choice documented for video storage
usage_questions:
  - metric: delivered_minutes
    ask: Delivery minutes this billing period, by resolution?
    where: Organization → Billing → Usage Reports (input, storage and delivery minutes, credit balance)
  - metric: storage_minutes
    ask: Storage minutes this period and the share in cold storage?
    where: Billing → Usage Reports (storage by tier)
  - metric: input_minutes
    ask: Input minutes this period by quality level?
    where: Billing → Usage Reports
  - metric: monthly_bill
    ask: Last invoice total and current plan or pre-pay credit?
    where: Billing → Billing Breakdown (last six invoiced cycles)
mcp:
  official: true
  readonly_flag: null
  allowed_tools: []
common_fixes:
  - set basic as the default video quality for user uploads, and use plus or premium only where quality matters
  - cap upload resolution with max_resolution_tier and playback with max_resolution
  - delete unneeded assets and live recordings, since the library is billed every month
  - turn off static renditions that are not downloaded, and avoid autoplay MP4 backgrounds
  - lazy-load players and use preload none on pages with many videos
  - sign playback IDs or add playback restrictions so videos cannot be hotlinked
  - disconnect encoders after a broadcast and keep the reconnect window short
verified: 2026-10-11
---

- Mux is detected from `@mux/` (Node SDK, Player, Uploader, AI, MCP), the Mux Data SDKs (`mux-embed`, `videojs-mux`), `next-video`, `mux-python`, `mux-go` and `MUX_TOKEN_*` and related names. Never match a bare `mux` or `MUX_`: `github.com/gorilla/mux`, the `mux` npm package (Coder) and its `MUX_*` names are unrelated. `next-video` can also store video on Vercel Blob, S3, R2 or Backblaze: check `provider` in `next.config`.
- Mux Data is not product analytics: Mux Player turns it on by itself and it is free for video on Mux. Standalone Data (other players) is billed by views.
- Every page has a markdown twin at `<url>.md`; `https://www.mux.com/llms.txt` lists them. What happens at the Free asset cap is not documented; ask the user.
- The Mux MCP server (`https://mcp.mux.com`, `@mux/mcp`) has a single `execute` tool that runs code against the whole SDK; method allowlists are not a security boundary, and even a read-only token returns live stream keys and original download URLs. Do not use it; ask the user for numbers instead.
- Mux next to Cloudinary video, Cloudflare Stream or another video host is Overlap unless split on purpose.
