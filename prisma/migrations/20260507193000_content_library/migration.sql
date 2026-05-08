CREATE TABLE "content_surfaces" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_surfaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_topics" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "surface_id" TEXT NOT NULL,
    "topic_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "thumbnail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "language" TEXT NOT NULL DEFAULT 'hu',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_surfaces_key_key" ON "content_surfaces"("key");
CREATE UNIQUE INDEX "content_topics_slug_key" ON "content_topics"("slug");
CREATE INDEX "content_items_surface_id_status_sort_order_idx" ON "content_items"("surface_id", "status", "sort_order");
CREATE INDEX "content_items_topic_id_idx" ON "content_items"("topic_id");
CREATE INDEX "content_items_type_idx" ON "content_items"("type");

ALTER TABLE "content_items" ADD CONSTRAINT "content_items_surface_id_fkey" FOREIGN KEY ("surface_id") REFERENCES "content_surfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "content_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "content_surfaces" ("id", "key", "name", "description")
VALUES ('surface_leadership_self', 'leadership_self', 'Sajat vezetoi fejlodes', 'LeadershipSelfFlow appos tartalmai');

INSERT INTO "content_topics" ("id", "slug", "name") VALUES
  ('topic_inspiration', 'inspiracio', 'Inspiracio'),
  ('topic_trust', 'bizalom', 'Bizalom'),
  ('topic_reading', 'olvasas', 'Olvasas'),
  ('topic_self_development', 'onfejlesztes', 'Onfejlesztes'),
  ('topic_motivation', 'motivacio', 'Motivacio');

INSERT INTO "content_items" (
  "id", "surface_id", "topic_id", "title", "description", "type", "duration", "url", "source", "thumbnail", "sort_order"
) VALUES
  (
    'content_ted1',
    'surface_leadership_self',
    'topic_inspiration',
    'How Great Leaders Inspire Action',
    'Simon Sinek klasszikus TED eloadasa a Why erejerol.',
    'video',
    18,
    'https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action?language=hu',
    'TED',
    'https://pi.tedcdn.com/r/talkstar-photos.s3.amazonaws.com/uploads/3e7d6d3b-5e2f-4e9c-9f4c-bfe38e4a0d5f/SimonSinek_2009-embed.jpg',
    10
  ),
  (
    'content_ted2',
    'surface_leadership_self',
    'topic_trust',
    'Why Good Leaders Make You Feel Safe',
    'A biztonsagerzet es vezetes kapcsolata.',
    'video',
    15,
    'https://www.ted.com/talks/simon_sinek_why_good_leaders_make_you_feel_safe',
    'TED',
    'https://pi.tedcdn.com/r/talkstar-photos.s3.amazonaws.com/uploads/4e6e0a6c-9c66-4e35-8c1e-b9c97f1b1c8d/SimonSinek_2014-embed.jpg',
    20
  ),
  (
    'content_yt1',
    'surface_leadership_self',
    'topic_inspiration',
    'TED Talk - Leadership insight',
    'Inspiralo vezetoi gondolatok video formaban.',
    'video',
    12,
    'https://www.youtube.com/watch?v=5aH2Ppjpcho',
    'YouTube',
    'https://img.youtube.com/vi/5aH2Ppjpcho/hqdefault.jpg',
    30
  ),
  (
    'content_blog1',
    'surface_leadership_self',
    'topic_reading',
    'Top 10 Leadership Blogs',
    'Valogatott vezetoi blogok egy helyen.',
    'article',
    8,
    'https://getlucidity.com/strategy-resources/the-top-10-leadership-blogs-every-leader-should-read/',
    'Lucidity',
    NULL,
    40
  ),
  (
    'content_blog2',
    'surface_leadership_self',
    'topic_self_development',
    'Tudatos Vezetes Blog',
    'Magyar nyelvu vezeteseleti gondolatok.',
    'article',
    6,
    'https://tudatosvezetes.blogspot.com/',
    'Blogspot',
    NULL,
    50
  ),
  (
    'content_yt2',
    'surface_leadership_self',
    'topic_motivation',
    'Leadership Video',
    'Gyakorlati vezetoi tanulsagok.',
    'video',
    10,
    'https://www.youtube.com/watch?v=5Bg3xu2vA2k',
    'YouTube',
    'https://img.youtube.com/vi/5Bg3xu2vA2k/hqdefault.jpg',
    60
  );
