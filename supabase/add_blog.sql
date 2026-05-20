create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  seo_title text,
  seo_description text,
  cover_image text,
  published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists blog_posts_slug_idx on blog_posts(slug);
create index if not exists blog_posts_published_idx on blog_posts(published, published_at desc);
