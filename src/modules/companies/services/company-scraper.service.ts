import * as cheerio from 'cheerio';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress, LookupOptions } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import type { RequestOptions as HttpRequestOptions } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { industriesRepository } from '../../industries/repository/industries.repository.js';
import { AppError } from '../../../shared/errors/AppError.js';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 12000;

// Cap the response body size so a malicious site cannot stream an unbounded
// amount of HTML into memory (DoS).
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MiB

// Only standard web ports are allowed. Without this, the scraper could be used
// to probe arbitrary TCP ports on public hosts (e.g. :6379 Redis, :25 SMTP,
// :9200 Elasticsearch), turning it into a general connection oracle.
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

// Reserved / private IP ranges that must never be fetched (SSRF protection).
const PRIVATE_RANGES = (() => {
  const blockList = new BlockList();
  const v4 = (subnet: string, prefix: number) => blockList.addSubnet(subnet, prefix, 'ipv4');
  const v6 = (subnet: string, prefix: number) => blockList.addSubnet(subnet, prefix, 'ipv6');

  v4('0.0.0.0', 8); // "This" network
  v4('10.0.0.0', 8); // Private
  v4('100.64.0.0', 10); // CGNAT (shared address space)
  v4('127.0.0.0', 8); // Loopback
  v4('169.254.0.0', 16); // Link-local
  v4('172.16.0.0', 12); // Private
  v4('192.0.0.0', 24); // IETF protocol assignments
  v4('192.0.2.0', 24); // TEST-NET-1
  v4('192.168.0.0', 16); // Private
  v4('198.18.0.0', 15); // Benchmarking
  v4('198.51.100.0', 24); // TEST-NET-2
  v4('203.0.113.0', 24); // TEST-NET-3
  v4('224.0.0.0', 4); // Multicast
  v4('240.0.0.0', 4); // Reserved (incl. broadcast)

  v6('::', 96); // Unspecified + deprecated IPv4-compatible space
  v6('::1', 128); // Loopback
  v6('64:ff9b::', 96); // NAT64 well-known prefix
  v6('100::', 64); // Discard-only
  v6('2001::', 32); // Teredo
  v6('2001:10::', 28); // ORCHID
  v6('2001:20::', 28); // ORCHIDv2
  v6('2001:db8::', 32); // Documentation
  v6('2002::', 16); // 6to4 (may embed private IPv4)
  v6('3fff::', 20); // Documentation (RFC 9637)
  v6('fc00::', 7); // Unique local
  v6('fe80::', 10); // Link-local
  v6('ff00::', 8); // Multicast

  return blockList;
})();

interface ScrapedCompanyData {
  name: string | null;
  description: string | null;
  country: string | null;
  city: string | null;
  industrySlug: string | null;
  logoUrl: string | null;
}

interface JsonLdNode {
  '@type'?: string;
  name?: string;
  description?: string;
  url?: string;
  logo?: string | { '@type'?: string; url?: string; contentUrl?: string };
  image?: string | { '@type'?: string; url?: string; contentUrl?: string };
  address?:
    | string
    | {
        '@type'?: string;
        addressCountry?: string;
        addressLocality?: string;
        addressRegion?: string;
        postalCode?: string;
        streetAddress?: string;
      };
  areaServed?: string | Array<{ '@type'?: string; name?: string }>;
  industry?: string;
  [key: string]: unknown;
}

// ─── Expanding country list ─────────────────────────────────────────
const COMMON_COUNTRIES: Record<string, string> = {
  us: 'United States',
  usa: 'United States',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  'united states': 'United States',
  canada: 'Canada',
  germany: 'Germany',
  france: 'France',
  australia: 'Australia',
  japan: 'Japan',
  china: 'China',
  india: 'India',
  brazil: 'Brazil',
  spain: 'Spain',
  italy: 'Italy',
  netherlands: 'Netherlands',
  switzerland: 'Switzerland',
  singapore: 'Singapore',
  sweden: 'Sweden',
  norway: 'Norway',
  denmark: 'Denmark',
  finland: 'Finland',
  ireland: 'Ireland',
  'south korea': 'South Korea',
  'new zealand': 'New Zealand',
  mexico: 'Mexico',
  russia: 'Russia',
  'united arab emirates': 'United Arab Emirates',
  uae: 'United Arab Emirates',
  israel: 'Israel',
  poland: 'Poland',
  portugal: 'Portugal',
  austria: 'Austria',
  belgium: 'Belgium',
  turkey: 'Turkey',
  indonesia: 'Indonesia',
  thailand: 'Thailand',
  vietnam: 'Vietnam',
  argentina: 'Argentina',
  colombia: 'Colombia',
  chile: 'Chile',
  'south africa': 'South Africa',
  nigeria: 'Nigeria',
  kenya: 'Kenya',
  'hong kong': 'Hong Kong',
  ethiopia: 'Ethiopia',
  et: 'Ethiopia',
  // ISO country codes for TLD-based detection
  au: 'Australia',
  jp: 'Japan',
  de: 'Germany',
  fr: 'France',
  ca: 'Canada',
  br: 'Brazil',
  it: 'Italy',
  es: 'Spain',
  nl: 'Netherlands',
  se: 'Sweden',
  no: 'Norway',
  dk: 'Denmark',
  fi: 'Finland',
  pl: 'Poland',
  pt: 'Portugal',
  at: 'Austria',
  be: 'Belgium',
  tr: 'Turkey',
  gr: 'Greece',
  cz: 'Czech Republic',
  ro: 'Romania',
  hu: 'Hungary',
  ie: 'Ireland',
  ch: 'Switzerland',
  in: 'India',
  cn: 'China',
  kr: 'South Korea',
  sg: 'Singapore',
  hk: 'Hong Kong',
  tw: 'Taiwan',
  mx: 'Mexico',
  ar: 'Argentina',
  co: 'Colombia',
  cl: 'Chile',
  pe: 'Peru',
  my: 'Malaysia',
  ph: 'Philippines',
  id: 'Indonesia',
  th: 'Thailand',
  vn: 'Vietnam',
  za: 'South Africa',
  ng: 'Nigeria',
  ke: 'Kenya',
  il: 'Israel',
  ru: 'Russia',
  ae: 'United Arab Emirates',
  sa: 'Saudi Arabia',
  nz: 'New Zealand',
  eg: 'Egypt',
  pk: 'Pakistan',
  bd: 'Bangladesh',
};

// ─── Industry keyword maps for better detection ─────────────────────
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  technology: [
    'software', 'saas', 'cloud', 'platform', 'app', 'application',
    'digital', 'data', 'ai', 'artificial intelligence', 'machine learning',
    'computer', 'programming', 'engineering', 'developer', 'devops',
    'cyber', 'technology', 'tech', 'startup', 'analytics',
    'database', 'infrastructure', 'api', 'microservice', 'blockchain',
    'automation', 'robotics', 'semiconductor', 'hardware', 'telecom',
    'mobile', 'web', 'internet', 'computing', 'information',
    'network', 'server', 'algorithm', 'open source',
  ],
  finance: [
    'bank', 'financial', 'finance', 'investment', 'insurance',
    'fintech', 'accounting', 'credit', 'loan', 'mortgage',
    'wealth', 'asset', 'capital', 'fund', 'trading',
    'stock', 'market', 'payment', 'payments', 'venture',
    'equity', 'bond', 'portfolio', 'broker', 'audit',
    'tax', 'compliance', 'underwriting', 'actuarial',
  ],
  healthcare: [
    'health', 'medical', 'hospital', 'pharma', 'pharmaceutical',
    'clinic', 'patient', 'doctor', 'physician', 'wellness',
    'biotech', 'biotechnology', 'care', 'healthcare', 'diagnostic',
    'therapy', 'treatment', 'surgery', 'drug', 'medicine',
    'clinical', 'health plan', 'insurance', 'dental', 'vision',
    'laboratory', 'lab', 'nurse', 'hospitality care', 'hospice',
    'mental health', 'rehabilitation', 'pharmacy', 'vaccine',
  ],
  education: [
    'school', 'university', 'college', 'education', 'learning',
    'academy', 'institute', 'training', 'student', 'curriculum',
    'course', 'online course', 'elearning', 'e-learning',
    'campus', 'faculty', 'research', 'library', 'scholarship',
    'tutoring', 'k-12', 'preschool', 'higher education',
    'vocational', 'professional development', 'certification',
    'educational', 'academic', 'pedagogy', 'classroom',
  ],
  retail: [
    'shop', 'store', 'retail', 'ecommerce', 'e-commerce',
    'marketplace', 'fashion', 'grocery', 'consumer', 'brand',
    'merchandise', 'wholesale', 'boutique', 'mall', 'outlet',
    'catalog', 'shopping', 'goods', 'products', 'online store',
    'omni-channel', 'omnichannel', 'b2c', 'direct-to-consumer',
    'dtc', 'd2c', 'footwear', 'apparel', 'clothing', 'luxury',
    'department store', 'convenience store', 'pharmacy',
  ],
  manufacturing: [
    'manufacturing', 'manufacturer', 'industrial', 'factory',
    'production', 'supply chain', 'logistics', 'automotive',
    'chemical', 'plant', 'assembly', 'machinery', 'equipment',
    'warehouse', 'distribution', 'fabrication', 'processing',
    'oem', 'engineering', 'heavy equipment', 'construction',
    'raw material', 'component', 'quality control', 'automation',
    'aerospace', 'defense', 'energy', 'oil', 'gas',
    'packaging', 'textile', 'steel', 'metal', 'plastic',
    'biomanufacturing', 'pharma manufacturing', 'food processing',
  ],
};

class CompanyScraperService {
  /**
   * Scrape a company website to extract basic company info.
   * Uses multiple strategies: JSON-LD structured data, meta tags, and content heuristics.
   */
  async scrapeWebsite(url: string): Promise<ScrapedCompanyData> {
    // Validate and normalize URL
    const normalizedUrl = this.normalizeUrl(url);

    // Fetch the HTML
    const html = await this.fetchPage(normalizedUrl);

    // Parse with cheerio
    const $ = cheerio.load(html);

    // Parse JSON-LD structured data (schema.org) — most reliable source
    const jsonLdNodes = this.parseJsonLd<JsonLdNode>($);
    const orgNode = this.findOrganizationNode(jsonLdNodes);

    // Extract data using all available strategies
    const name = this.extractName($, normalizedUrl, orgNode);
    const description = this.extractDescription($, orgNode);
    const country = this.extractCountry($, orgNode, normalizedUrl);
    const city = this.extractCity($, orgNode);
    const logoUrl = this.extractLogo($, normalizedUrl, orgNode);
    const industrySlug = await this.detectIndustry($, orgNode, description || '');

    return { name, description, country, city, industrySlug, logoUrl };
  }

  // ───── URL helpers ──────────────────────────────────────────────────

  private normalizeUrl(url: string): string {
    let normalized = url.startsWith('http') ? url : `https://${url}`;
    // Remove trailing slash for consistency
    normalized = normalized.replace(/\/+$/, '');
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Unsupported protocol');
      }
      return normalized;
    } catch {
      throw new AppError('Invalid URL provided. Please enter a valid website URL.', 400);
    }
  }

  private resolveUrl(href: string, baseUrl: string): string {
    if (!href || href.startsWith('data:')) return '';
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    try {
      const base = new URL(baseUrl);
      return new URL(href, base.origin).href;
    } catch {
      return href;
    }
  }

  private getOrigin(baseUrl: string): string {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return baseUrl;
    }
  }

  // ───── HTTP fetch (SSRF-safe) ──────────────────────────────────────

  private async fetchPage(url: string): Promise<string> {
    return this.fetchHtml(url, 0);
  }

  private async fetchHtml(url: string, redirectCount: number): Promise<string> {
    if (redirectCount > MAX_REDIRECTS) {
      throw new AppError('Website redirected too many times. Try a different URL.', 400);
    }

    const parsed = this.parseHttpUrl(url);
    const hostname = this.stripIpv6Brackets(parsed.hostname);
    const isHttps = parsed.protocol === 'https:';
    const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80;

    if (!ALLOWED_PORTS.has(port)) {
      throw new AppError(
        'Only standard web ports (80, 443, 8080, 8443) are supported.',
        400,
      );
    }

    const path = `${parsed.pathname}${parsed.search}`;
    const addresses = await this.resolvePublicAddresses(hostname);

    for (const address of addresses) {
      try {
        return await this.requestPage({
          parsed,
          hostname,
          port,
          path,
          address,
          isHttps,
          redirectCount,
        });
      } catch (error) {
        // Operational errors (bad status, redirect limit, blocked address) propagate immediately.
        if (error instanceof AppError) throw error;
        if ((error as Error).name === 'AbortError') {
          throw new AppError('Website took too long to respond. Try a different URL.', 400);
        }
      }
    }

    throw new AppError(
      'Could not fetch website. Make sure the URL is correct and the site is accessible.',
      400,
    );
  }

  private requestPage(params: {
    parsed: URL;
    hostname: string;
    port: number;
    path: string;
    address: string;
    isHttps: boolean;
    redirectCount: number;
  }): Promise<string> {
    const { parsed, hostname, port, path, address, isHttps, redirectCount } = params;

    return new Promise<string>((resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const options: HttpRequestOptions = {
        hostname,
        port,
        path,
        method: 'GET',
        agent: false,
        signal: controller.signal,
        // Pin the connection to an already-validated public IP so the hostname is
        // never re-resolved (prevents DNS rebinding during the request).
        lookup: this.buildPinnedLookup(address),
        headers: {
          Host: parsed.host,
          'User-Agent':
            'Mozilla/5.0 (compatible; SeeThroughBot/1.0; +https://seethrough.app/bot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      };

      const handleResponse = (res: IncomingMessage): void => {
        const status = res.statusCode ?? 0;

        // Follow redirects manually so every hop is re-validated against SSRF rules.
        if (status >= 300 && status < 400) {
          const location = res.headers.location;
          res.resume();
          clearTimeout(timeout);

          if (!location) {
            reject(
              new AppError(
                `Could not fetch website (HTTP ${status}). Make sure the URL is correct and accessible.`,
                400,
              ),
            );
            return;
          }

          let nextUrl: string;
          try {
            nextUrl = new URL(location, parsed).href;
          } catch {
            reject(new AppError('Website returned an invalid redirect. Try a different URL.', 400));
            return;
          }

          this.fetchHtml(nextUrl, redirectCount + 1).then(resolve, reject);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          clearTimeout(timeout);
          reject(
            new AppError(
              `Could not fetch website (HTTP ${status}). Make sure the URL is correct and accessible.`,
              400,
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        res.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_RESPONSE_BYTES) {
            clearTimeout(timeout);
            res.destroy();
            reject(
              new AppError('Website response was too large to process.', 400),
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
        res.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      };

      const req = isHttps
        ? httpsRequest(options, handleResponse)
        : httpRequest(options, handleResponse);

      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      req.end();
    });
  }

  private parseHttpUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new AppError('Invalid URL provided. Please enter a valid website URL.', 400);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new AppError('Only http and https URLs are supported.', 400);
    }
    return parsed;
  }

  private async resolvePublicAddresses(hostname: string): Promise<string[]> {
    let addresses: string[];
    if (isIP(hostname) !== 0) {
      addresses = [hostname];
    } else {
      let resolved: LookupAddress[];
      try {
        resolved = await dnsLookup(hostname, { all: true, verbatim: true });
      } catch {
        throw new AppError(
          'Could not resolve the website hostname. Make sure the URL is correct and accessible.',
          400,
        );
      }
      addresses = resolved.map((r) => r.address);
    }

    if (addresses.length === 0) {
      throw new AppError(
        'Could not resolve the website hostname. Make sure the URL is correct and accessible.',
        400,
      );
    }

    for (const address of addresses) {
      if (!this.isPublicAddress(address)) {
        throw new AppError(
          'This website resolves to a private or internal network address and cannot be accessed.',
          400,
        );
      }
    }

    return addresses;
  }

  private isPublicAddress(ip: string): boolean {
    const family = isIP(ip);
    if (family === 0) return false;

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — check the embedded IPv4 address.
    const mapped = this.extractMappedIpv4(ip);
    if (mapped) return this.isPublicAddress(mapped);

    return !PRIVATE_RANGES.check(ip, family === 4 ? 'ipv4' : 'ipv6');
  }

  private extractMappedIpv4(ip: string): string | null {
    const groups = this.expandIpv6(ip);
    if (!groups) return null;
    const zeroBefore = groups.slice(0, 5).every((g) => /^0+$/.test(g));
    if (!zeroBefore || groups[5] !== 'ffff') return null;
    const hi = parseInt(groups[6], 16);
    const lo = parseInt(groups[7], 16);
    return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
  }

  private expandIpv6(ip: string): string[] | null {
    const cleaned = ip.replace(/^\[|\]$/g, '').toLowerCase();
    if (cleaned.includes('%')) return null; // zone index
    const sections = cleaned.split('::');
    if (sections.length > 2) return null;

    const head = sections[0] === '' ? [] : sections[0].split(':');
    const tail = sections.length === 2 && sections[1] !== '' ? sections[1].split(':') : [];

    if (sections.length === 1) {
      return head.length === 8 ? head : null;
    }

    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    return [...head, ...Array<string>(missing).fill('0'), ...tail];
  }

  private stripIpv6Brackets(hostname: string): string {
    return hostname.length > 1 && hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  }

  private buildPinnedLookup(address: string): LookupFunction {
    const family = isIP(address);
    return (_hostname: string, options: LookupOptions, callback) => {
      if (options.all) {
        callback(null, [{ address, family }]);
      } else {
        callback(null, address, family);
      }
    };
  }

  // ───── JSON-LD Parser ───────────────────────────────────────────────

  private parseJsonLd<T = JsonLdNode>($: cheerio.CheerioAPI): T[] {
    const nodes: T[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).text().trim();
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          nodes.push(...parsed);
        } else {
          nodes.push(parsed);
        }
      } catch {
        // Skip malformed JSON-LD blocks
      }
    });

    // Also check for nested @graph structures
    const expanded: T[] = [];
    for (const node of nodes) {
      const graph = (node as Record<string, unknown>)['@graph'];
      if (Array.isArray(graph)) {
        expanded.push(...(graph as T[]));
      } else {
        expanded.push(node);
      }
    }

    return expanded;
  }

  private findOrganizationNode(nodes: JsonLdNode[]): JsonLdNode | null {
    // Look for Organization or its subtypes first
    const orgTypes = [
      'Organization', 'Corporation', 'EducationalOrganization',
      'School', 'CollegeOrUniversity', 'LocalBusiness',
      'Restaurant', 'Store', 'MedicalOrganization', 'Hospital',
      'NGO', 'GovernmentOrganization', 'PerformingGroup',
      'SportsOrganization', 'FundingScheme',
    ];

    // Prefer nodes that have a name and are an organization type
    const candidates = nodes.filter((n) => {
      const type = n['@type'];
      return type && orgTypes.some((t) => type.includes(t));
    });

    // Also check WebSite nodes as fallback
    const webSiteNode = nodes.find((n) => n['@type'] === 'WebSite' && n.name);
    const webPageNode = nodes.find(
      (n) => n['@type'] === 'WebPage' && n.name && !n.description,
    );

    // Return best match: candidate with most fields, or website node
    const bestOrg = candidates.sort(
      (a, b) => Object.keys(b).length - Object.keys(a).length,
    )[0];

    return bestOrg || webSiteNode || webPageNode || null;
  }

  // ───── Name extraction ──────────────────────────────────────────────

  private extractName(
    $: cheerio.CheerioAPI,
    url: string,
    orgNode: JsonLdNode | null,
  ): string | null {
    // 1. JSON-LD
    if (orgNode?.name) return orgNode.name.trim();

    // 2. Open Graph
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName) return ogSiteName.trim();

    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) return ogTitle.trim();

    // 3. Application name
    const appName = $('meta[name="application-name"]').attr('content');
    if (appName) return appName.trim();

    // 4. Title tag (clean common separators)
    const titleTag = $('title').first().text().trim();
    if (titleTag) {
      // Remove taglines: "Acme Corp | We Build Things" → "Acme Corp"
      for (const sep of [' | ', ' – ', ' — ', ' · ', ' - ', ' • ', ' |', ' |']) {
        const idx = titleTag.indexOf(sep);
        if (idx > 0) return titleTag.slice(0, idx).trim();
      }
      return titleTag;
    }

    // 5. Logo alt text (often contains company name)
    const logoAlt = $('img[class*="logo"], img[id*="logo"], img[alt*="logo"]')
      .first()
      .attr('alt');
    if (logoAlt && logoAlt.toLowerCase() !== 'logo') return logoAlt.trim();

    // 6. Common header elements
    const headerText = $(
      '.logo a, .navbar-brand, .header-logo a, .site-title, .brand',
    )
      .first()
      .text()
      .trim();
    if (headerText) return headerText;

    // 7. Domain fallback
    try {
      const hostname = new URL(url).hostname;
      return hostname
        .replace(/^www\./, '')
        .split('.')[0]
        ?.replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) || null;
    } catch {
      return null;
    }
  }

  // ───── Description extraction ───────────────────────────────────────

  private extractDescription(
    $: cheerio.CheerioAPI,
    orgNode: JsonLdNode | null,
  ): string | null {
    // 1. JSON-LD
    if (orgNode?.description) return orgNode.description.trim();

    // 2. Open Graph
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc) return ogDesc.trim();

    // 3. Twitter description
    const twitterDesc = $('meta[name="twitter:description"]').attr('content');
    if (twitterDesc) return twitterDesc.trim();

    // 4. Standard meta description
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc) return metaDesc.trim();

    // 5. JSON-LD from WebPage or other nodes (fallback)
    const allNodes = this.parseJsonLd<JsonLdNode>($);
    for (const node of allNodes) {
      if (node.description && node['@type'] !== 'Organization') {
        return node.description.trim();
      }
    }

    // 6. Excerpt from the page's main content (first substantial paragraph)
    const firstParagraph = $(
      'main p, article p, .content p, .hero p, .intro p',
    )
      .first()
      .text()
      .trim();
    if (firstParagraph && firstParagraph.length > 40) {
      return firstParagraph.slice(0, 300).trim();
    }

    return null;
  }

  // ───── Country extraction ───────────────────────────────────────────

  private extractCountry(
    $: cheerio.CheerioAPI,
    orgNode: JsonLdNode | null,
    url: string,
  ): string | null {
    // 1. JSON-LD address
    if (orgNode?.address && typeof orgNode.address === 'object') {
      const addr = orgNode.address;
      if (addr.addressCountry) {
        const country = this.lookupCountry(addr.addressCountry);
        if (country) return country;
        // If it's a full country name, return as-is
        if (addr.addressCountry.length > 3) return addr.addressCountry;
      }
    }

    // Also search all JSON-LD nodes for address
    const allNodes = this.parseJsonLd<JsonLdNode>($);
    for (const node of allNodes) {
      if (node.address && typeof node.address === 'object') {
        const addr = node.address;
        if (addr.addressCountry) {
          const country = this.lookupCountry(addr.addressCountry);
          if (country) return country;
          if (addr.addressCountry.length > 3) return addr.addressCountry;
        }
      }
    }

    // 2. Meta geo tags
    const geoCountry = $('meta[name="geo.country"]').attr('content');
    if (geoCountry) {
      const country = this.lookupCountry(geoCountry.trim());
      if (country) return country;
    }

    const geoRegion = $('meta[name="geo.region"]').attr('content');
    if (geoRegion) {
      // Often formatted as "US-CA" or "US" or "US, California"
      const parts = geoRegion.split(/[-,\s]+/);
      if (parts.length > 0) {
        const country = this.lookupCountry(parts[0]!.trim());
        if (country) return country;
      }
    }

    const geoPlacename = $('meta[name="geo.placename"]').attr('content');

    // 3. Open Graph locale
    const locale = $('meta[property="og:locale"]').attr('content');
    if (locale) {
      const parts = locale.split('_');
      if (parts.length === 2) {
        const country = this.lookupCountry(parts[1]!.toLowerCase());
        if (country) return country;
      }
    }

    // 4. TLD-based guess
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const tld = hostname.split('.').pop();
      if (tld && tld.length === 2 && tld !== 'com' && tld !== 'org' && tld !== 'net') {
        const country = this.lookupCountry(tld);
        if (country) return country;
      }
    } catch {
      // ignore
    }

    // 5. Text-based extraction from contact/address/footer sections
    const bodyText = $('body').text().toLowerCase();
    const footerContent = $('footer').text().toLowerCase();
    const contactText = $(
      'footer, ' +
        '[class*="contact"], [class*="address"], [class*="location"], ' +
        '[class*="footer"], [id*="contact"], [id*="footer"], ' +
        'address, .address, .location, .contact-info',
    )
      .text()
      .toLowerCase();

    // Look for country names in contact text first (more specific), then footer, then body
    const searchSources = [contactText, footerContent, bodyText];

    for (const source of searchSources) {
      if (!source) continue;

      // Check explicit country names (multi-word first, then single)
      const countryNames = Object.entries(COMMON_COUNTRIES)
        .filter(([k]) => k.includes(' '))
        .sort((a, b) => b[0].length - a[0].length);

      for (const [, name] of countryNames) {
        if (source.includes(name.toLowerCase())) return name;
      }

      // Then check single-word keys
      for (const [key, name] of Object.entries(COMMON_COUNTRIES)) {
        if (key.includes(' ')) continue;
        // Match whole word or after punctuation/newline
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(source)) return name;
      }
    }

    // 6. Check geo.placename as last resort
    if (geoPlacename) {
      const country = this.lookupCountry(geoPlacename);
      if (country) return country;
    }

    // 7. Default to Ethiopia if nothing detected
    return 'Ethiopia';
  }

  // ───── City extraction ──────────────────────────────────────────────

  private extractCity(
    $: cheerio.CheerioAPI,
    orgNode: JsonLdNode | null,
  ): string | null {
    // 1. JSON-LD address
    if (orgNode?.address && typeof orgNode.address === 'object') {
      if (orgNode.address.addressLocality) {
        return orgNode.address.addressLocality.trim();
      }
    }

    // Check all JSON-LD nodes for address (e.g. LocalBusiness sometimes nested)
    const allNodes = this.parseJsonLd<JsonLdNode>($);
    for (const node of allNodes) {
      if (node.address && typeof node.address === 'object') {
        if (node.address.addressLocality) {
          return node.address.addressLocality.trim();
        }
      }
    }

    // 2. Microdata / schema.org meta tags
    const microdataCity = $(
      'meta[itemprop="addressLocality"], ' +
        'meta[itemprop="addressRegion"]',
    ).attr('content');
    if (microdataCity) return microdataCity.trim();

    // 3. RDFa / Open Graph tags for locality
    const rdfaCity = $(
      '[property~="place:location:locality"], ' +
        '[property~="business:contact_data:locality"]',
    ).attr('content');
    if (rdfaCity) return rdfaCity.trim();

    // 4. Contact/address elements — search for city patterns
    const contactSections = $(
      'footer, ' +
        '[class*="contact"], [class*="address"], [class*="location"], ' +
        '[class*="footer"], [id*="contact"], [id*="footer"], ' +
        'address, .address, .location, .contact-info, ' +
        '.office, .offices, .find-us, .visit-us',
    );

    // Extract text from all contact sections
    const contactText = contactSections.text();
    const bodyText = $('body').text();

    // Try multiple city patterns
    const cityPatterns = [
      // "City, ST ZIP" or "City, State ZIP"
      /([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?)\s*,\s*([A-Z]{2})\s+\d{5}/,
      // "City, ST" at end of line or after newline
      /([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?)\s*,\s*([A-Z]{2})\s*$/m,
      // "City, State" pattern
      /([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?)\s*,\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+\d{5}/,
      // Common address: "123 Street, City, ST"
      /\d+\s+[A-Za-z\s]+,?\s+([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?)\s*,\s*([A-Z]{2})/,
      // "City, Country" (but only if country is known)
      /([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?)\s*,\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/,
    ];

    // Search in contact text first (more precise)
    for (const pattern of cityPatterns) {
      const match = contactText.match(pattern);
      if (match?.[1]) {
        // Basic validation: skip very short results
        const city = match[1].trim();
        if (city.length >= 2 && !city.match(/^(the|our|my|your|all|inc|llc|ltd|corp)\.?$/i)) {
          return city;
        }
      }
    }

    // 5. Search in footer specifically
    const footerText = $('footer').text();
    const footerCity = footerText.match(
      /([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?)\s*,\s*([A-Z]{2})/,
    );
    if (footerCity?.[1]) {
      const city = footerCity[1].trim();
      if (city.length >= 2) return city;
    }

    // 6. Look for known city names in the body text
    const knownCities = [
      'San Francisco', 'New York', 'London', 'Tokyo', 'Berlin', 'Paris',
      'Sydney', 'Toronto', 'Singapore', 'Dubai', 'Mumbai', 'Shanghai',
      'Seattle', 'Austin', 'Boston', 'Chicago', 'Los Angeles', 'Amsterdam',
      'Dublin', 'Stockholm', 'Copenhagen', 'Barcelona', 'Rome', 'Milan',
      'Zurich', 'Hong Kong', 'Seoul', 'Bangalore', 'Austin', 'Denver',
      'Portland', 'Miami', 'Atlanta', 'Dallas', 'Houston', 'Phoenix',
      'San Diego', 'Minneapolis', 'Philadelphia', 'Washington',
      'Melbourne', 'Vancouver', 'Montreal', 'Munich', 'Hamburg',
    ];

    for (const city of knownCities) {
      const regex = new RegExp(`\\b${city}\\b`, 'i');
      // Check contact sections first, then body
      if (regex.test(contactText) || regex.test(footerText)) {
        // Return the properly-cased version
        const idx = knownCities.indexOf(city);
        return knownCities[idx] || city;
      }
    }

    // 7. Broader search in body (but only for obvious address patterns)
    const bodyCity = bodyText.match(
      /\b(?:in|at|based in|located in|headquartered in)\s+([A-Z][a-z]+(?:[- ][A-Z][a-z]+)?)/i,
    );
    if (bodyCity?.[1]) {
      const city = bodyCity[1].trim();
      if (city.length >= 2 && !city.match(/^(the|our|my|your)\.?$/i)) {
        return city;
      }
    }

    return null;
  }

  // ───── Logo extraction ──────────────────────────────────────────────

  private extractLogo(
    $: cheerio.CheerioAPI,
    baseUrl: string,
    orgNode: JsonLdNode | null,
  ): string | null {
    const candidates: string[] = [];

    // 1. JSON-LD logo property
    if (orgNode?.logo) {
      if (typeof orgNode.logo === 'string') {
        candidates.push(orgNode.logo);
      } else if (typeof orgNode.logo === 'object') {
        const logo = orgNode.logo as Record<string, unknown>;
        const logoUrl = logo.url || logo.contentUrl;
        if (typeof logoUrl === 'string') candidates.push(logoUrl);
      }
    }

    // 2. JSON-LD image property as fallback
    if (orgNode?.image && !orgNode.logo) {
      if (typeof orgNode.image === 'string') {
        candidates.push(orgNode.image);
      } else if (typeof orgNode.image === 'object') {
        const img = orgNode.image as Record<string, unknown>;
        const imgUrl = img.url || img.contentUrl;
        if (typeof imgUrl === 'string') candidates.push(imgUrl);
      }
    }

    // 3. Open Graph image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) candidates.push(ogImage);

    // 4. Twitter image
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) candidates.push(twitterImage);

    // 5. Logo-specific link tags
    const logoLinks = [
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="mask-icon"]',
    ];

    for (const selector of logoLinks) {
      const href = $(selector).attr('href');
      if (href) candidates.push(href);
    }

    // 6. Look for visible logo images via CSS class/id selectors
    const logoSelectors = [
      'img[class*="logo"]',
      'img[id*="logo"]',
      'img[alt*="logo" i]',
      '.logo img',
      '#logo img',
      '.navbar-brand img',
      '.header-logo img',
      '.site-logo img',
      'a[class*="brand"] img',
      'header img:first',
      'nav img:first',
    ];

    const seenSources = new Set<string>();
    for (const selector of logoSelectors) {
      $(selector).each((_, el) => {
        const src = $(el).attr('src');
        if (src && !seenSources.has(src)) {
          seenSources.add(src);
          candidates.push(src);
        }
      });
    }

    // Score candidates: prefer logo-specific sources over general ones
    const scored = candidates.map((href, index) => {
      const h = href.toLowerCase();
      let score = 0;
      // JSON-LD logo is the most authoritative source per schema.org spec
      if (index === 0 && orgNode?.logo && (typeof orgNode.logo === 'string' || (typeof orgNode.logo === 'object' && (orgNode.logo as Record<string, unknown>).url))) score += 100;
      // Logo-specific names get higher score
      if (h.includes('logo')) score += 50;
      if (h.includes('brand')) score += 30;
      if (h.includes('icon')) score += 20;
      if (h.includes('favicon')) score -= 10;
      // og:image is often a banner, not a logo — penalize slightly
      if (h.includes('og-image') || h.includes('ogimage')) score -= 15;
      // Apple touch icons are usually good
      if (h.includes('apple-touch-icon')) score += 25;
      // SVG is usually cleaner
      if (h.endsWith('.svg')) score += 10;
      // PNG is usually better than ICO for a logo
      if (h.endsWith('.png')) score += 5;
      // Larger images more likely to be real logos
      if (h.includes('512') || h.includes('256') || h.includes('192') || h.includes('144')) score += 5;

      return { href, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return the best candidate if any
    if (scored.length > 0) {
      const resolved = this.resolveUrl(scored[0]!.href, baseUrl);
      if (resolved) return resolved;
    }

    // Last resort: /favicon.ico
    try {
      const origin = this.getOrigin(baseUrl);
      return `${origin}/favicon.ico`;
    } catch {
      return null;
    }
  }

  // ───── Industry detection ───────────────────────────────────────────

  private async detectIndustry(
    $: cheerio.CheerioAPI,
    orgNode: JsonLdNode | null,
    description: string,
  ): Promise<string | null> {
    const industries = await industriesRepository.findAll();

    // 1. Check JSON-LD for direct industry clues
    if (orgNode?.industry) {
      const industryStr = orgNode.industry.toLowerCase();
      for (const ind of industries) {
        if (industryStr.includes(ind.slug) || industryStr.includes(ind.name.toLowerCase())) {
          return ind.slug;
        }
      }
    }

    // Check all JSON-LD nodes' @type for industry clues
    const allNodes = this.parseJsonLd<JsonLdNode>($);
    for (const node of allNodes) {
      const type = node['@type'];
      if (type) {
        for (const ind of industries) {
          const typeLower = type.toLowerCase();
          const slug = ind.slug.toLowerCase();
          if (typeLower.includes(slug) || typeLower.includes(ind.name.toLowerCase())) {
            return ind.slug;
          }
        }
      }
      // Check areaServed/description for industry context
      if (node.description && typeof node.description === 'string') {
        const descLower = node.description.toLowerCase();
        for (const [slug, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
          for (const kw of keywords) {
            if (descLower.includes(kw)) return slug;
          }
        }
      }
    }

    // 2. Also check og:type (e.g. "website" vs "article" — less useful but worth checking)
    const ogType = $('meta[property="og:type"]').attr('content')?.toLowerCase();
    if (ogType) {
      for (const ind of industries) {
        if (ogType.includes(ind.slug) || ogType.includes(ind.name.toLowerCase())) {
          return ind.slug;
        }
      }
    }

    // 3. Keyword-based scoring against the rich industry keyword map
    const bodyText = $('body').text().toLowerCase();
    const searchText = `${description?.toLowerCase() || ''} ${bodyText}`.toLowerCase();

    // Use the rich keyword map
    const industrySlugs = industries.map((ind) => ind.slug);
    const scores: Array<{ slug: string; score: number }> = [];

    for (const slug of industrySlugs) {
      const keywords = INDUSTRY_KEYWORDS[slug];
      if (!keywords) {
        // Fallback: use industry name itself as keyword
        const ind = industries.find((i) => i.slug === slug);
        if (ind) {
          const count = (searchText.match(new RegExp(`\\b${ind.name.toLowerCase()}\\b`, 'g')) || []).length;
          scores.push({ slug, score: count });
        }
        continue;
      }

      let score = 0;
      for (const keyword of keywords) {
        // Use regex for whole-word matching where possible
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = searchText.match(regex);
        if (matches) {
          score += matches.length;
        }
      }

      scores.push({ slug, score });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return best match with at least some score
    const best = scores[0];
    if (best && best.score > 0) {
      // Normalize: if score is very low relative to text length, might be noise
      return best.slug;
    }

    // 4. Last resort: check for industry-related meta tags
    const classificationMeta =
      $('meta[name="classification"]').attr('content') ||
      $('meta[name="page-topic"]').attr('content') ||
      $('meta[name="keywords"]').attr('content');

    if (classificationMeta) {
      const metaLower = classificationMeta.toLowerCase();
      for (const ind of industries) {
        if (metaLower.includes(ind.slug) || metaLower.includes(ind.name.toLowerCase())) {
          return ind.slug;
        }
      }
    }

    // 5. Default to technology if nothing detected
    return 'technology';
  }

  // ───── Helpers ──────────────────────────────────────────────────────

  private lookupCountry(key: string): string | null {
    const lower = key.trim().toLowerCase();
    return COMMON_COUNTRIES[lower] || null;
  }
}

export const companyScraperService = new CompanyScraperService();
