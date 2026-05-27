import { DailyQuestionType, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CAMPAIGN_KEY = 'pszichoszocialis-kockazatelemzes';
const CAMPAIGN_NAME = 'Pszichoszociális kockázatelemzés';

const FREQ = ['Mindig', 'Gyakran', 'Időnként', 'Ritkán', 'Soha /szinte soha'];
const EXTENT = [
  'Nagyon nagy mértékben',
  'Nagymértékben',
  'Valamelyest',
  'Kismértékben',
  'Nagyon kis mértékben',
];
const EXTENT_NO_MANAGER = [...EXTENT, 'Nincs közvetlen felettesem'];
const FREQ_NO_MANAGER = [...FREQ, 'Nincs közvetlen felettesem'];
const FREQ_NO_COWORKERS = [...FREQ, 'Nincsenek munkatársaim'];
const SATISFACTION = [
  'Nagyon elégedett',
  'Elégedett',
  'Semleges',
  'Elégedetlen',
  'Nagyon elégedetlen',
];
const TIME_PART = [
  'Állandóan',
  'Az idő nagy részében',
  'Az idő egy részében',
  'Az idő kis részében',
  'Egyáltalán nem',
];
const HEALTH = ['Kitűnő', 'Nagyon jó', 'Jó', 'Tűrhető', 'Rossz'];
const YES_FREQUENCY = [
  'Igen, napi rendszerességgel',
  'Igen, heti rendszerességgel',
  'Igen, havi rendszerességgel',
  'Igen, néhány alkalommal',
  'Nem',
];

type SeedQuestion = {
  topic: string;
  campaignDay: number;
  question: string;
  answerOptions: string[];
};

const PSYCHOSOCIAL_QUESTIONS: SeedQuestion[] = [
  {
    topic: 'Mennyiségi elvárás',
    campaignDay: 1,
    question:
      'Jellemző-e a munkádra, hogy egyenlőtlenül van elosztva, ezért az elvégzendő feladatok felhalmozódnak?',
    answerOptions: FREQ,
  },
  {
    topic: 'Mennyiségi elvárás',
    campaignDay: 1,
    question:
      'Milyen gyakran fordul elő, hogy nincs időd minden feladatod elvégzésére?',
    answerOptions: FREQ,
  },
  {
    topic: 'Mennyiségi elvárás',
    campaignDay: 1,
    question: 'Elő szokott-e fordulni, hogy elmaradásaid vannak a munkáddal?',
    answerOptions: FREQ,
  },
  {
    topic: 'Munkatempó',
    campaignDay: 2,
    question: 'Nagyon gyorsan kell dolgoznod?',
    answerOptions: FREQ,
  },
  {
    topic: 'Munkatempó',
    campaignDay: 2,
    question: 'Egész nap nagyon tempósan kell-e dolgoznod?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Érzelmi megterhelés',
    campaignDay: 3,
    question:
      'Kerülsz-e a munkád folytán olyan helyzetekbe, melyek érzelmileg zavaróak, felkavaróak?',
    answerOptions: FREQ,
  },
  {
    topic: 'Érzelmi megterhelés',
    campaignDay: 3,
    question:
      'Munkád részeként kell-e foglalkoznod más emberek személyes problémáival?',
    answerOptions: FREQ,
  },
  {
    topic: 'Érzelmi megterhelés',
    campaignDay: 3,
    question: 'Érzelmileg megterhelő-e a munkád?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Hatáskör (Kontroll)',
    campaignDay: 4,
    question: 'Jelentős mértékben képes vagy-e befolyásolni a munkádat?',
    answerOptions: FREQ,
  },
  {
    topic: 'Hatáskör (Kontroll)',
    campaignDay: 4,
    question: 'Tudod-e befolyásolni, hogy mennyi munkát kell elvégezned?',
    answerOptions: FREQ,
  },
  {
    topic: 'Hatáskör (Kontroll)',
    campaignDay: 4,
    question: 'Van-e befolyásod arra, hogy milyen munkát végzel?',
    answerOptions: FREQ,
  },
  {
    topic: 'Fejlődési lehetőségek',
    campaignDay: 5,
    question: 'Van-e lehetőséged a munkád révén új dolgokat tanulni?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Fejlődési lehetőségek',
    campaignDay: 5,
    question:
      'Tudod-e hasznosítani képességeidet vagy szakértelmedet a munkád során?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Fejlődési lehetőségek',
    campaignDay: 5,
    question:
      'Nyújt-e lehetőséget a munkád arra, hogy fejleszd készségeidet, tudásodat?',
    answerOptions: EXTENT,
  },
  {
    topic: 'A munka értelmessége',
    campaignDay: 6,
    question: 'Értelmes munkát végzel-e?',
    answerOptions: EXTENT,
  },
  {
    topic: 'A munka értelmessége',
    campaignDay: 6,
    question: 'Fontosnak érzed-e a munkát, amit végzel?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Előreláthatóság',
    campaignDay: 7,
    question:
      'Jó előre értesítenek-e Téged a munkahelyeden a fontosabb döntésekről, változásokról vagy jövőbeni tervekről?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Előreláthatóság',
    campaignDay: 7,
    question:
      'Megkapsz-e minden szükséges információt ahhoz, hogy jól tudd végezni a munkádat?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Jutalmazás, elismerés',
    campaignDay: 8,
    question: 'Elismeri-e és értékeli-e a vezetőség a munkádat?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Munkakör egyértelműsége',
    campaignDay: 9,
    question: 'Világosak a célkitűzések a munkádban?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Munkakör egyértelműsége',
    campaignDay: 9,
    question:
      'Tudod-e pontosan, hogy mely területek tartoznak a Te felelősségi körödbe?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Munkakör egyértelműsége',
    campaignDay: 9,
    question: 'Tudod-e, hogy pontosan mit várnak el Tőled a munkádban?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Szerepkonfliktus',
    campaignDay: 10,
    question:
      'Meg kell-e felelned egymással ellentétes elvárásoknak a munkában?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Szerepkonfliktus',
    campaignDay: 10,
    question:
      'Kell-e időnként olyan dolgokat tenned, amelyeket igazából másként kellene csinálni?',
    answerOptions: EXTENT,
  },
  {
    topic: 'A vezetés minősége',
    campaignDay: 11,
    question:
      'Szerinted a közvetlen felettesed mennyire biztosít az egyes munkatársak számára megfelelő fejlődési lehetőségeket?',
    answerOptions: EXTENT_NO_MANAGER,
  },
  {
    topic: 'A vezetés minősége',
    campaignDay: 11,
    question:
      'Szerinted a közvetlen felettesed mennyire tervezi meg jól a munkát?',
    answerOptions: EXTENT_NO_MANAGER,
  },
  {
    topic: 'A vezetés minősége',
    campaignDay: 11,
    question:
      'Szerinted a közvetlen felettesed mennyire oldja meg jól a konfliktusokat?',
    answerOptions: EXTENT_NO_MANAGER,
  },
  {
    topic: 'Támogatás a felettestől',
    campaignDay: 12,
    question:
      'Milyen gyakran hajlandó a közvetlen felettesed meghallgatni munkával kapcsolatos problémáidat?',
    answerOptions: FREQ_NO_MANAGER,
  },
  {
    topic: 'Támogatás a felettestől',
    campaignDay: 12,
    question:
      'Milyen gyakran kapsz segítséget és támogatást közvetlen felettesedtől?',
    answerOptions: FREQ_NO_MANAGER,
  },
  {
    topic: 'Támogatás a munkatársaktól',
    campaignDay: 13,
    question: 'Milyen gyakran kapsz segítséget és támogatást munkatársaidtól?',
    answerOptions: FREQ_NO_COWORKERS,
  },
  {
    topic: 'Támogatás a munkatársaktól',
    campaignDay: 13,
    question:
      'Milyen gyakran hajlandók a munkatársaid meghallgatni a munkával kapcsolatos problémáidat?',
    answerOptions: FREQ_NO_COWORKERS,
  },
  {
    topic: 'Munkahelyi közösség',
    campaignDay: 14,
    question: 'Jó-e a légkör közted és a munkatársaid között?',
    answerOptions: FREQ_NO_COWORKERS,
  },
  {
    topic: 'Munkahelyi közösség',
    campaignDay: 14,
    question: 'A munkahelyi közösség részének érzed-e magad?',
    answerOptions: FREQ_NO_COWORKERS,
  },
  {
    topic: 'Munkahelyi elkötelezettség',
    campaignDay: 15,
    question: 'Örömmel mesélsz-e másoknak a munkahelyedről?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Munkahelyi elkötelezettség',
    campaignDay: 15,
    question:
      'Ajánlanád-e egy jó barátodnak, hogy a Te munkahelyeden vállaljon állást?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Munkahelyi elégedettség',
    campaignDay: 16,
    question:
      'Általánosságban, mennyire vagy elégedett a munkádban rejlő kilátásokkal?',
    answerOptions: SATISFACTION,
  },
  {
    topic: 'Munkahelyi elégedettség',
    campaignDay: 16,
    question:
      'Általánosságban, mennyire vagy elégedett a munkáddal egészében véve, mindent beleszámítva?',
    answerOptions: SATISFACTION,
  },
  {
    topic: 'Munka-magánélet konfliktus',
    campaignDay: 17,
    question:
      'Úgy érzed-e, hogy a munkád olyan sok energiát vesz el, hogy az negatív hatással van a magánéletedre?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Munka-magánélet konfliktus',
    campaignDay: 17,
    question:
      'Úgy érzed-e, hogy a munkád olyan sok időt vesz el, hogy az negatív hatással van a magánéletedre?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Vezetés iránti bizalom',
    campaignDay: 18,
    question:
      'A vezetőség bízik-e abban, hogy az alkalmazottak jól végzik a munkájukat?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Vezetés iránti bizalom',
    campaignDay: 18,
    question:
      'Megbízhatsz-e az információkban, amelyek a vezetőségtől származnak?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Vezetés iránti bizalom',
    campaignDay: 18,
    question: 'Kifejezhetik-e az alkalmazottak véleményüket, érzéseiket?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Munkatársak közötti kölcsönös bizalom',
    campaignDay: 19,
    question: 'Általában megbíznak-e egymásban az alkalmazottak?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Szervezeti igazságosság',
    campaignDay: 20,
    question: 'A konfliktusokat igazságosan oldják-e meg?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Szervezeti igazságosság',
    campaignDay: 20,
    question: 'Igazságosan van-e a munka elosztva?',
    answerOptions: EXTENT,
  },
  {
    topic: 'Kiégés',
    campaignDay: 21,
    question: 'Milyen gyakran érezted magadat fizikailag kimerültnek?',
    answerOptions: TIME_PART,
  },
  {
    topic: 'Kiégés',
    campaignDay: 21,
    question: 'Milyen gyakran érezted magadat érzelmileg kimerültnek?',
    answerOptions: TIME_PART,
  },
  {
    topic: 'Stressz',
    campaignDay: 22,
    question: 'Milyen gyakran érezted magadat stresszesnek?',
    answerOptions: TIME_PART,
  },
  {
    topic: 'Önbecsült egészség',
    campaignDay: 23,
    question: 'Összességében hogyan jellemeznéd az egészségi állapotodat?',
    answerOptions: HEALTH,
  },
  {
    topic: 'Kiszámíthatatlanság, Váratlan helyzetek',
    campaignDay: 24,
    question:
      'Milyen gyakran kell váratlan feladatokat vagy váratlan helyzeteket megoldanod a munkád során?',
    answerOptions: FREQ,
  },
  {
    topic: 'Bullying',
    campaignDay: 25,
    question:
      'Ki voltál-e téve a munkahelyeden nem kívánatos szexuális érdeklődésnek az elmúlt 12 hónapban?',
    answerOptions: YES_FREQUENCY,
  },
  {
    topic: 'Bullying',
    campaignDay: 25,
    question:
      'Ki voltál-e téve a munkahelyeden erőszakkal való fenyegetésnek az elmúlt 12 hónapban?',
    answerOptions: YES_FREQUENCY,
  },
  {
    topic: 'Bullying',
    campaignDay: 25,
    question:
      'Ki voltál-e téve a munkahelyeden fizikai bántalmazásnak az elmúlt 12 hónapban?',
    answerOptions: YES_FREQUENCY,
  },
  {
    topic: 'Bullying',
    campaignDay: 25,
    question:
      '„Szekálás” alatt azt értjük, ha valakit rendszeresen kényelmetlen vagy megalázó helyzetbe kényszerítenek és az illető úgy érzi, nehéz vagy lehetetlen ettől megvédenie magát. Ki voltál-e téve a munkahelyeden „szekálásnak” az elmúlt 12 hónapban?',
    answerOptions: YES_FREQUENCY,
  },
  {
    topic: 'Testi tünetek',
    campaignDay: 26,
    question:
      'Tapasztalsz-e olyan fizikai (testi, egészségi) tüneteket, amelyek a munkahelyi stresszhez kapcsolódnak? (Pl. fejfájás, hátfájás, gyomorproblémák, alvásproblémák, hangulati problémák stb.)',
    answerOptions: YES_FREQUENCY,
  },
];

const CONTENT_SURFACES = [
  {
    id: 'surface_leadership_self',
    key: 'leadership_self',
    name: 'Sajat vezetoi fejlodes',
    description: 'LeadershipSelfFlow appos tartalmai',
  },
];

const CONTENT_TOPICS = [
  { id: 'topic_inspiration', slug: 'inspiracio', name: 'Inspiracio' },
  { id: 'topic_trust', slug: 'bizalom', name: 'Bizalom' },
  { id: 'topic_reading', slug: 'olvasas', name: 'Olvasas' },
  { id: 'topic_self_development', slug: 'onfejlesztes', name: 'Onfejlesztes' },
  { id: 'topic_motivation', slug: 'motivacio', name: 'Motivacio' },
];

const CONTENT_ITEMS = [
  {
    id: 'content_ted1',
    surfaceKey: 'leadership_self',
    topicSlug: 'inspiracio',
    title: 'How Great Leaders Inspire Action',
    description: 'Simon Sinek klasszikus TED eloadasa a Why erejerol.',
    type: 'video',
    duration: 18,
    url: 'https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action?language=hu',
    source: 'TED',
    thumbnail:
      'https://pi.tedcdn.com/r/talkstar-photos.s3.amazonaws.com/uploads/3e7d6d3b-5e2f-4e9c-9f4c-bfe38e4a0d5f/SimonSinek_2009-embed.jpg',
    sortOrder: 10,
  },
  {
    id: 'content_ted2',
    surfaceKey: 'leadership_self',
    topicSlug: 'bizalom',
    title: 'Why Good Leaders Make You Feel Safe',
    description: 'A biztonsagerzet es vezetes kapcsolata.',
    type: 'video',
    duration: 15,
    url: 'https://www.ted.com/talks/simon_sinek_why_good_leaders_make_you_feel_safe',
    source: 'TED',
    thumbnail:
      'https://pi.tedcdn.com/r/talkstar-photos.s3.amazonaws.com/uploads/4e6e0a6c-9c66-4e35-8c1e-b9c97f1b1c8d/SimonSinek_2014-embed.jpg',
    sortOrder: 20,
  },
  {
    id: 'content_yt1',
    surfaceKey: 'leadership_self',
    topicSlug: 'inspiracio',
    title: 'TED Talk - Leadership insight',
    description: 'Inspiralo vezetoi gondolatok video formaban.',
    type: 'video',
    duration: 12,
    url: 'https://www.youtube.com/watch?v=5aH2Ppjpcho',
    source: 'YouTube',
    thumbnail: 'https://img.youtube.com/vi/5aH2Ppjpcho/hqdefault.jpg',
    sortOrder: 30,
  },
  {
    id: 'content_blog1',
    surfaceKey: 'leadership_self',
    topicSlug: 'olvasas',
    title: 'Top 10 Leadership Blogs',
    description: 'Valogatott vezetoi blogok egy helyen.',
    type: 'article',
    duration: 8,
    url: 'https://getlucidity.com/strategy-resources/the-top-10-leadership-blogs-every-leader-should-read/',
    source: 'Lucidity',
    thumbnail: null,
    sortOrder: 40,
  },
  {
    id: 'content_blog2',
    surfaceKey: 'leadership_self',
    topicSlug: 'onfejlesztes',
    title: 'Tudatos Vezetes Blog',
    description: 'Magyar nyelvu vezeteseleti gondolatok.',
    type: 'article',
    duration: 6,
    url: 'https://tudatosvezetes.blogspot.com/',
    source: 'Blogspot',
    thumbnail: null,
    sortOrder: 50,
  },
  {
    id: 'content_yt2',
    surfaceKey: 'leadership_self',
    topicSlug: 'motivacio',
    title: 'Leadership Video',
    description: 'Gyakorlati vezetoi tanulsagok.',
    type: 'video',
    duration: 10,
    url: 'https://www.youtube.com/watch?v=5Bg3xu2vA2k',
    source: 'YouTube',
    thumbnail: 'https://img.youtube.com/vi/5Bg3xu2vA2k/hqdefault.jpg',
    sortOrder: 60,
  },
];

async function main() {
  const platformAdminEmail = 'superadmin@fempy.hu';
  const platformAdminPasswordPlain = 'superpass123';

  await resetApplicationData();

  await prisma.platformAdmin.upsert({
    where: { email: platformAdminEmail },
    update: {
      name: 'Fempy Superadmin',
      passwordHash: await bcrypt.hash(platformAdminPasswordPlain, 10),
      isActive: true,
    },
    create: {
      email: platformAdminEmail,
      name: 'Fempy Superadmin',
      passwordHash: await bcrypt.hash(platformAdminPasswordPlain, 10),
      isActive: true,
    },
  });

  await seedPsychosocialCampaign();
  await seedContentLibrary();

  console.log('Seed kész:', {
    platformAdmin: {
      email: platformAdminEmail,
      password: platformAdminPasswordPlain,
    },
    campaign: {
      key: CAMPAIGN_KEY,
      name: CAMPAIGN_NAME,
      questions: PSYCHOSOCIAL_QUESTIONS.length,
      days: Math.max(...PSYCHOSOCIAL_QUESTIONS.map((item) => item.campaignDay)),
    },
  });
}

async function resetApplicationData() {
  await prisma.notificationJob.deleteMany({});
  await prisma.activityEvent.deleteMany({});
  await prisma.supportSession.deleteMany({});
  await prisma.appUsageSession.deleteMany({});
  await prisma.userDevice.deleteMany({});
  await prisma.userGoal.deleteMany({});
  await prisma.dailyMood.deleteMany({});
  await prisma.dailyQuestionnaireAnswer.deleteMany({});
  await prisma.dailyQuestionDispatch.deleteMany({});
  await prisma.dailyQuestionCampaignRun.deleteMany({});
  await prisma.dailyQuestionSchedule.deleteMany({});
  await prisma.dailyQuestion.deleteMany({});
  await prisma.dailyQuestionTopic.deleteMany({});
  await prisma.userProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.organizationSettings.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.platformAdmin.deleteMany({});
}

async function seedPsychosocialCampaign() {
  const topicByName = new Map<string, { id: string; name: string }>();

  for (const item of PSYCHOSOCIAL_QUESTIONS) {
    let topic = topicByName.get(item.topic);

    if (!topic) {
      topic = await prisma.dailyQuestionTopic.create({
        data: {
          tenantId: null,
          name: item.topic,
          slug: slugify(item.topic),
          description: CAMPAIGN_NAME,
          isGlobal: true,
        },
        select: { id: true, name: true },
      });
      topicByName.set(item.topic, topic);
    }

    const question = await prisma.dailyQuestion.create({
      data: {
        tenantId: null,
        topicId: topic.id,
        topic: item.topic,
        question: item.question,
        answerOptions: item.answerOptions,
        type: DailyQuestionType.SINGLE_CHOICE_5,
        isActive: true,
        isGlobal: true,
      },
    });

    await prisma.dailyQuestionSchedule.create({
      data: {
        tenantId: null,
        questionId: question.id,
        name: CAMPAIGN_NAME,
        campaignKey: CAMPAIGN_KEY,
        campaignDay: item.campaignDay,
        scheduleType: 'MANUAL',
        audienceType: 'ALL',
        audienceConfig: {},
        isActive: true,
        pushTitle: 'Megérkezett a napi kérdőíved',
        pushBody: `Töltsd ki a(z) ${item.topic} témakör kérdéseit.`,
      },
    });
  }
}

async function seedContentLibrary() {
  const surfaceByKey = new Map<string, string>();
  const topicBySlug = new Map<string, string>();

  for (const surface of CONTENT_SURFACES) {
    const savedSurface = await prisma.contentSurface.upsert({
      where: { key: surface.key },
      update: {
        name: surface.name,
        description: surface.description,
        isActive: true,
      },
      create: {
        id: surface.id,
        key: surface.key,
        name: surface.name,
        description: surface.description,
        isActive: true,
      },
      select: { id: true, key: true },
    });

    surfaceByKey.set(savedSurface.key, savedSurface.id);
  }

  for (const topic of CONTENT_TOPICS) {
    const savedTopic = await prisma.contentTopic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        isActive: true,
      },
      create: {
        id: topic.id,
        slug: topic.slug,
        name: topic.name,
        isActive: true,
      },
      select: { id: true, slug: true },
    });

    topicBySlug.set(savedTopic.slug, savedTopic.id);
  }

  for (const item of CONTENT_ITEMS) {
    const surfaceId = surfaceByKey.get(item.surfaceKey);
    const topicId = topicBySlug.get(item.topicSlug);

    if (!surfaceId || !topicId) {
      throw new Error(`Missing content relation for ${item.id}`);
    }

    await prisma.contentItem.upsert({
      where: { id: item.id },
      update: {
        surfaceId,
        topicId,
        title: item.title,
        description: item.description,
        type: item.type,
        duration: item.duration,
        url: item.url,
        source: item.source,
        thumbnail: item.thumbnail,
        status: 'published',
        language: 'hu',
        sortOrder: item.sortOrder,
      },
      create: {
        id: item.id,
        surfaceId,
        topicId,
        title: item.title,
        description: item.description,
        type: item.type,
        duration: item.duration,
        url: item.url,
        source: item.source,
        thumbnail: item.thumbnail,
        status: 'published',
        language: 'hu',
        sortOrder: item.sortOrder,
      },
    });
  }
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

main()
  .catch((error) => {
    console.error('Seed hiba:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
