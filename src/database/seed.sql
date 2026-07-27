-- Create all tables for the See Through application
-- This mirrors the Drizzle ORM schema definitions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Industries
CREATE TABLE IF NOT EXISTS industries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE
);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  industry_id UUID NOT NULL REFERENCES industries(id),
  website VARCHAR(255),
  country VARCHAR(100),
  city VARCHAR(100),
  description TEXT,
  logo_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  review_count INTEGER NOT NULL DEFAULT 0,
  average_rating DECIMAL(2,1) DEFAULT '0',
  recommendation_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_company_industry ON companies(industry_id);
CREATE INDEX IF NOT EXISTS idx_company_name ON companies(name);

-- Anonymous Identities
CREATE TABLE IF NOT EXISTS anonymous_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id VARCHAR(32) NOT NULL UNIQUE,
  session_token_hash VARCHAR(255) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'flagged')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_public_id ON anonymous_identities(public_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_status ON anonymous_identities(status);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tag_slug ON tags(slug);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  anonymous_id UUID NOT NULL REFERENCES anonymous_identities(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  title TEXT NOT NULL,
  pros TEXT,
  cons TEXT,
  overall_rating INTEGER,
  work_life_balance INTEGER,
  culture INTEGER,
  management INTEGER,
  compensation INTEGER,
  opportunities INTEGER,
  is_current_employee BOOLEAN,
  employment_status TEXT CHECK (employment_status IN ('full-time', 'part-time', 'contract', 'intern', 'freelance')),
  job_title TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  unhelpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_public_id ON reviews(public_id);
CREATE INDEX IF NOT EXISTS idx_review_anonymous ON reviews(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_review_company ON reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_review_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_review_rating ON reviews(overall_rating);

-- Review Tags (many-to-many)
CREATE TABLE IF NOT EXISTS review_tags (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_tag_unique ON review_tags(review_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_review_tag_review ON review_tags(review_id);

-- Review Votes
CREATE TABLE IF NOT EXISTS review_votes (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  anonymous_id UUID NOT NULL REFERENCES anonymous_identities(id),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'unhelpful')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_vote_unique ON review_votes(review_id, anonymous_id);
CREATE INDEX IF NOT EXISTS idx_review_vote_review ON review_votes(review_id);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  anonymous_id UUID NOT NULL REFERENCES anonymous_identities(id),
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  parent_id INTEGER REFERENCES comments(id),
  content TEXT NOT NULL,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_public_id ON comments(public_id);
CREATE INDEX IF NOT EXISTS idx_comment_review ON comments(review_id);
CREATE INDEX IF NOT EXISTS idx_comment_anonymous ON comments(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_comment_parent ON comments(parent_id);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  anonymous_id UUID NOT NULL REFERENCES anonymous_identities(id),
  review_id INTEGER REFERENCES reviews(id),
  comment_id INTEGER REFERENCES comments(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_public_id ON reports(public_id);
CREATE INDEX IF NOT EXISTS idx_report_anonymous ON reports(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_report_review ON reports(review_id);
CREATE INDEX IF NOT EXISTS idx_report_comment ON reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_report_status ON reports(status);

-- Seed data: Industries
INSERT INTO industries (id, name, slug) VALUES
  (uuid_generate_v4(), 'Technology', 'technology'),
  (uuid_generate_v4(), 'Finance', 'finance'),
  (uuid_generate_v4(), 'Healthcare', 'healthcare'),
  (uuid_generate_v4(), 'Education', 'education'),
  (uuid_generate_v4(), 'Retail', 'retail'),
  (uuid_generate_v4(), 'Manufacturing', 'manufacturing');

-- Seed data: Tags
INSERT INTO tags (name, slug) VALUES
  ('Good Culture', 'good-culture'),
  ('Great Benefits', 'great-benefits'),
  ('Work-Life Balance', 'work-life-balance'),
  ('Career Growth', 'career-growth'),
  ('Good Management', 'good-management'),
  ('Remote Friendly', 'remote-friendly'),
  ('Diversity', 'diversity'),
  ('Innovation', 'innovation'),
  ('Team Collaboration', 'team-collaboration'),
  ('Fair Compensation', 'fair-compensation');

-- Admin table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default admin (password: admin123 — change immediately in production!)
-- bcrypt hash for 'admin123'
INSERT INTO admins (email, password_hash, name)
VALUES ('admin@seethrough.com', '$2b$10$gsLxbGPm47Fl4deZYfVqEuXpT8ALi2dNVQVwC1zMuZY7N6Q8w6N2K', 'Admin')
ON CONFLICT (email) DO NOTHING;
