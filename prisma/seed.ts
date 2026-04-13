import { PrismaClient,DailyQuestionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Demo seed:
 * - létrehoz egy demo tenantot (slug: demo)
 * - létrehoz egy demo pozíciót (root)
 * - létrehoz egy demo usert (email: demo@demo.hu)
 * - opcionálisan létrehoz user profilt is
 *
 * Futtatás:
 *   npx prisma db seed
 */
const prisma = new PrismaClient();

const SCALE_EXTENT = [
  'nagyon nagy mértékben',
  'nagymértékben',
  'valamelyest',
  'kismértékben',
  'nagyon kis mértékben',
];

const SCALE_FREQUENCY = [
  'mindig',
  'gyakran',
  'néha',
  'ritkán',
  'soha vagy szinte soha',
];

const questions = [
  {
    topic: 'elismerés',
    question: 'Elismerik a munkámat ezen a munkahelyen.',
    answerOptions: SCALE_EXTENT,
    type: DailyQuestionType.SINGLE_CHOICE_5,
  },
  {
    topic: 'elismerés',
    question: 'Méltányolják a képességeimet és erőfeszítéseimet.',
    answerOptions: SCALE_EXTENT,
    type: DailyQuestionType.SINGLE_CHOICE_5,
  },
  {
    topic: 'vezetői tisztelet',
    question: 'A közvetlen vezetőm tisztelettel bánik velem.',
    answerOptions: SCALE_EXTENT,
    type: DailyQuestionType.SINGLE_CHOICE_5,
  },
  {
    topic: 'vezetői figyelem',
    question:
      'A közvetlen vezetőm figyelmesen meghallgat, ha egy problémával hozzá fordulok.',
    answerOptions: SCALE_FREQUENCY,
    type: DailyQuestionType.SINGLE_CHOICE_5,
  },
  {
    topic: 'vezetői támogatás',
    question: 'A közvetlen vezetőm támogat, amikor szükségem van rá.',
    answerOptions: SCALE_FREQUENCY,
    type: DailyQuestionType.SINGLE_CHOICE_5,
  },
  {
    topic: 'visszajelzés',
    question:
      'A közvetlen vezetőmtől gyakran kapok visszajelzéseket arról, hogy jól dolgozom.',
    answerOptions: SCALE_FREQUENCY,
    type: DailyQuestionType.SINGLE_CHOICE_5,
  },
];

async function main() {
  const tenantSlug = 'demo';
  const demoEmail = 'demo@demo.hu';
  const demoPasswordPlain = 'pass1234';

  // 1) DEMO TENANT: upsert (ha már létezik, nem duplikáljuk)
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {
      name: 'Demo Szervezet',
    },
    create: {
      name: 'Demo Szervezet',
      slug: tenantSlug,

      // ha a Tenant-nek van kapcsolt settings 1:1
      settings: {
        create: {
          orgName: 'Demo Szervezet',
          companyForm: 'Kft',
          defaultLang: 'hu',
          themeMode: 'light',
          timeZone: 'Europe/Budapest',
          notifyPush: true,
        },
      },
    },
    include: { settings: true },
  });

    // 2) DEMO POZÍCIÓ (root jellegű)
  // Megjegyzés:
  // Prisma-nál a nullable mezőket tartalmazó összetett unique input néha nem engedi TS-ben a null-t,
  // ezért itt findFirst + create mintát használunk az upsert helyett.
  let rootPosition = await prisma.position.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'Root',
      parentId: null,
    },
  });

  if (!rootPosition) {
    rootPosition = await prisma.position.create({
      data: {
        tenantId: tenant.id,
        name: 'Root',
        parentId: null,
      },
    });
  }

  // 3) DEMO USER: jelszó hash-elése
  const passwordHash = await bcrypt.hash(demoPasswordPlain, 10);

  // 4) DEMO USER: upsert email alapján
  //    FONTOS:
  //    - ha az email nálad globálisan unique (javasolt), akkor where: { email: demoEmail }
  //    - ha még tenant+email unique, akkor findFirst + create/update (lent kommentben)
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      tenantId: tenant.id,
      firstName: 'Demo',
      lastName: 'User',
      isLeader: true,
      positionId: rootPosition.id,
      passwordHash,
      isDeleted: false,
    },
    create: {
      tenantId: tenant.id,
      email: demoEmail,
      passwordHash,
      firstName: 'Demo',
      lastName: 'User',
      isLeader: true,
      positionId: rootPosition.id,
    },
  });

  // 5) DEMO PROFIL (opcionális, de hasznos /me-hez)
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      tenantId: tenant.id,
      nickname: 'Demo',
      isAnonymous: false,
      isPublic: true,
      dailyNotification: true,
    },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      nickname: 'Demo',
      isAnonymous: false,
      isPublic: true,
      dailyNotification: true,
      profilePic: '1',
    },
  });

  console.log('✅ Tenant,Usert Seed kész!');
  console.log('Tenant:', { id: tenant.id, slug: tenant.slug, name: tenant.name });
  console.log('User:', { id: user.id, email: user.email, password: demoPasswordPlain, isLeader: user.isLeader });
 for (const item of questions) {
    const existing = await prisma.dailyQuestion.findFirst({
      where: {
        tenantId: null,
        isGlobal: true,
        question: item.question,
      },
    });

    if (existing) {
      await prisma.dailyQuestion.update({
        where: { id: existing.id },
        data: {
          topic: item.topic,
          answerOptions: item.answerOptions,
          type: item.type,
          isActive: true,
          isGlobal: true,
        },
      });

      console.log(`Updated: ${item.question}`);
      continue;
    }

    await prisma.dailyQuestion.create({
      data: {
        tenantId: null,
        topic: item.topic,
        question: item.question,
        answerOptions: item.answerOptions,
        type: item.type,
        isActive: true,
        isGlobal: true,
      },
    });

    console.log(`Created: ${item.question}`);
  }
// ----------------------------------------------------
// Daily Question Schedules seed
// ----------------------------------------------------

const seededQuestions = await prisma.dailyQuestion.findMany({
  where: {
    isGlobal: true,
  },
  take: 3,
});

for (const q of seededQuestions) {
  const existingSchedule = await prisma.dailyQuestionSchedule.findFirst({
    where: {
      questionId: q.id,
      scheduleType: 'MANUAL',
    },
  });

  if (existingSchedule) {
    console.log(`Schedule already exists for: ${q.question}`);
    continue;
  }

  await prisma.dailyQuestionSchedule.create({
    data: {
      questionId: q.id,
      scheduleType: 'MANUAL',
      audienceType: 'ALL',
      audienceConfig: {},
      isActive: true,
    },
  });

  console.log(`Schedule created for: ${q.question}`);
}
 const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  });

  if (!demoTenant) {
    throw new Error('Demo tenant nem található.');
  }

  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@demo.hu' },
  });

  if (!demoUser) {
    throw new Error('Demo user nem található.');
  }

  const demoQuestions = await prisma.dailyQuestion.findMany({
    where: {
      isGlobal: true,
      isActive: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 2,
  });

  const sentOn = new Date();
  sentOn.setHours(0, 0, 0, 0);

  for (const q of demoQuestions) {
    const existingPending = await prisma.dailyQuestionnaireAnswer.findFirst({
      where: {
        tenantId: demoTenant.id,
        userId: demoUser.id,
        questionId: q.id,
        filledAt: null,
      },
    });

    if (existingPending) {
      console.log(`Pending already exists for demo user: ${q.question}`);
      continue;
    }

    const dispatch = await prisma.dailyQuestionDispatch.create({
      data: {
        tenantId: demoTenant.id,
        questionId: q.id,
        scheduleId: null,
        triggeredByUserId: demoUser.id,
        sentOn,
        sentAt: new Date(),
        audienceType: 'ALL',
        audienceConfig: {},
        pushSent: false,
        pushTitle: 'Megérkezett a napi kérdőíved',
        pushBody: `Töltsd ki ha szeretnél többet megtudni magadról a(z) ${q.topic} témában`,
      },
    });

    await prisma.dailyQuestionnaireAnswer.create({
      data: {
        tenantId: demoTenant.id,
        userId: demoUser.id,
        questionId: q.id,
        dispatchId: dispatch.id,
        sentOn,
        isActive: true,
        answer: null,
        filledAt: null,
      },
    });

    console.log(`Demo pending created: ${q.question}`);
  }

}



main()
  .catch((e) => {
    console.error('❌ Seed hiba:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
