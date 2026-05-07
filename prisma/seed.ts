import {
  DailyQuestion,
  DailyQuestionType,
  PrismaClient,
  User,
  UserRole,
} from '@prisma/client';
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

const REPORT_DEMO_CAMPAIGN_KEY = 'demo-wellbeing-2026-05';
const RECOGNITION_DEMO_CAMPAIGN_KEY = 'demo-recognition-2026-05';
const RECOGNITION_PENDING_CAMPAIGN_KEY = 'demo-recognition-pending-2026-05';
const RECOGNITION_DEMO_TOPIC = 'elismerés';

const REPORT_DEMO_TOPIC = {
  name: 'Munkahelyi jólét demo',
  slug: 'munkahelyi-jollet-demo',
};

const REPORT_DEMO_QUESTIONS = [
  {
    question: 'Úgy érzem, hogy van energiám a napi munkafeladataimhoz.',
    hungarianNorm: '3.70',
    hungarianStd: '0.80',
  },
  {
    question: 'A munkám során megélem, hogy van ráhatásom a feladataimra.',
    hungarianNorm: '3.45',
    hungarianStd: '0.90',
  },
  {
    question: 'A csapatomban biztonságosan tudok visszajelzést adni.',
    hungarianNorm: '3.20',
    hungarianStd: '1.00',
  },
];

const REPORT_DEMO_OPTIONS = ['1', '2', '3', '4', '5'];

async function main() {
  const tenantSlug = 'demo';
  const demoEmail = 'demo@demo.hu';
  const demoPasswordPlain = 'pass1234';
  const platformAdminEmail = 'superadmin@fempy.hu';
  const platformAdminPasswordPlain = 'superpass123';

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

  console.log('Platform admin:', {
    email: platformAdminEmail,
    password: platformAdminPasswordPlain,
  });

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
    lastName: 'Admin',
    role: UserRole.ADMIN,
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
    lastName: 'Admin',
    role: UserRole.ADMIN,
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

 console.log('✅ Tenant, User seed kész!');
console.log('Tenant:', {
  id: tenant.id,
  slug: tenant.slug,
  name: tenant.name,
});

console.log('User:', {
  id: user.id,
  email: user.email,
  password: demoPasswordPlain,
  role: user.role,
  isLeader: user.isLeader,
});
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

  await seedCompletedTopicReportDemo({
    tenantId: demoTenant.id,
    rootPositionId: rootPosition.id,
    demoUserId: demoUser.id,
  });

  await seedRecognitionTopicCampaignDemo({
    tenantId: demoTenant.id,
    rootPositionId: rootPosition.id,
    demoUserId: demoUser.id,
  });

  await seedRecognitionPendingCampaignDemo({
    tenantId: demoTenant.id,
    rootPositionId: rootPosition.id,
    demoUserId: demoUser.id,
  });

}

async function seedRecognitionTopicCampaignDemo(input: {
  tenantId: string;
  rootPositionId: string;
  demoUserId: string;
}) {
  const recognitionQuestions = await prisma.dailyQuestion.findMany({
    where: {
      isGlobal: true,
      isActive: true,
      topic: RECOGNITION_DEMO_TOPIC,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (recognitionQuestions.length === 0) return;

  const schedulesByQuestionId = new Map<string, string>();

  for (const question of recognitionQuestions) {
    const existingSchedule = await prisma.dailyQuestionSchedule.findFirst({
      where: {
        tenantId: null,
        questionId: question.id,
        campaignKey: RECOGNITION_DEMO_CAMPAIGN_KEY,
      },
    });

    const schedule = existingSchedule
      ? await prisma.dailyQuestionSchedule.update({
          where: { id: existingSchedule.id },
          data: {
            name: 'Demo elismerés kampány',
            campaignKey: RECOGNITION_DEMO_CAMPAIGN_KEY,
            audienceType: 'ALL',
            audienceConfig: {},
            isActive: true,
          },
        })
      : await prisma.dailyQuestionSchedule.create({
          data: {
            questionId: question.id,
            name: 'Demo elismerés kampány',
            campaignKey: RECOGNITION_DEMO_CAMPAIGN_KEY,
            scheduleType: 'MANUAL',
            audienceType: 'ALL',
            audienceConfig: {},
            isActive: true,
          },
        });

    schedulesByQuestionId.set(question.id, schedule.id);
  }

  const peerUsers = await seedReportDemoPeers(input.tenantId, input.rootPositionId);
  const campaignDispatches = await prisma.dailyQuestionDispatch.findMany({
    where: {
      tenantId: input.tenantId,
      campaignKey: RECOGNITION_DEMO_CAMPAIGN_KEY,
    },
    select: { id: true },
  });

  if (campaignDispatches.length > 0) {
    await prisma.dailyQuestionnaireAnswer.deleteMany({
      where: {
        dispatchId: { in: campaignDispatches.map((dispatch) => dispatch.id) },
      },
    });

    await prisma.dailyQuestionDispatch.deleteMany({
      where: {
        id: { in: campaignDispatches.map((dispatch) => dispatch.id) },
      },
    });
  }

  const staleRecognitionAnswers = await prisma.dailyQuestionnaireAnswer.findMany({
    where: {
      tenantId: input.tenantId,
      userId: input.demoUserId,
      questionId: { in: recognitionQuestions.map((question) => question.id) },
      filledAt: { not: null },
      dispatch: {
        campaignKey: null,
      },
    },
    select: {
      dispatchId: true,
    },
  });

  const staleDispatchIds = [...new Set(staleRecognitionAnswers.map((answer) => answer.dispatchId))];

  if (staleDispatchIds.length > 0) {
    await prisma.dailyQuestionnaireAnswer.deleteMany({
      where: {
        dispatchId: { in: staleDispatchIds },
      },
    });

    await prisma.dailyQuestionDispatch.deleteMany({
      where: {
        id: { in: staleDispatchIds },
      },
    });
  }

  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  baseDate.setDate(baseDate.getDate() - 10);

  const demoAnswers = ['nagymértékben', 'nagyon nagy mértékben'];
  const peerAnswerSets = [
    ['valamelyest', 'nagymértékben'],
    ['nagyon nagy mértékben', 'valamelyest'],
  ];

  for (let i = 0; i < recognitionQuestions.length; i += 1) {
    const question = recognitionQuestions[i];
    const sentOn = new Date(baseDate);
    sentOn.setDate(baseDate.getDate() + i * 5);

    const dispatch = await prisma.dailyQuestionDispatch.create({
      data: {
        tenantId: input.tenantId,
        questionId: question.id,
        scheduleId: schedulesByQuestionId.get(question.id) ?? null,
        campaignKey: RECOGNITION_DEMO_CAMPAIGN_KEY,
        triggeredByUserId: input.demoUserId,
        sentOn,
        sentAt: sentOn,
        audienceType: 'ALL',
        audienceConfig: {},
        pushSent: true,
        pushTitle: 'Demo elismerés kérdés',
        pushBody: `Demo kampány: ${question.topic}`,
      },
    });

    await prisma.dailyQuestionnaireAnswer.create({
      data: {
        tenantId: input.tenantId,
        userId: input.demoUserId,
        questionId: question.id,
        dispatchId: dispatch.id,
        sentOn,
        isActive: true,
        answer: demoAnswers[i] ?? demoAnswers[0],
        filledAt: new Date(sentOn.getTime() + 1000 * 60 * 60 * 6),
      },
    });

    for (let peerIndex = 0; peerIndex < peerUsers.length; peerIndex += 1) {
      await prisma.dailyQuestionnaireAnswer.create({
        data: {
          tenantId: input.tenantId,
          userId: peerUsers[peerIndex].id,
          questionId: question.id,
          dispatchId: dispatch.id,
          sentOn,
          isActive: true,
          answer: peerAnswerSets[peerIndex][i] ?? peerAnswerSets[peerIndex][0],
          filledAt: new Date(sentOn.getTime() + 1000 * 60 * 60 * (8 + peerIndex)),
        },
      });
    }
  }

  console.log('Demo recognition report seed kész:', {
    topic: RECOGNITION_DEMO_TOPIC,
    campaignKey: RECOGNITION_DEMO_CAMPAIGN_KEY,
    questions: recognitionQuestions.length,
  });
}

async function seedRecognitionPendingCampaignDemo(input: {
  tenantId: string;
  rootPositionId: string;
  demoUserId: string;
}) {
  const recognitionQuestions = await prisma.dailyQuestion.findMany({
    where: {
      isGlobal: true,
      isActive: true,
      topic: RECOGNITION_DEMO_TOPIC,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (recognitionQuestions.length === 0) return;

  const stalePendingAnswers = await prisma.dailyQuestionnaireAnswer.findMany({
    where: {
      tenantId: input.tenantId,
      userId: input.demoUserId,
      questionId: { in: recognitionQuestions.map((question) => question.id) },
      filledAt: null,
      dispatch: {
        OR: [
          { campaignKey: null },
          { campaignKey: RECOGNITION_PENDING_CAMPAIGN_KEY },
        ],
      },
    },
    select: { dispatchId: true },
  });

  const staleDispatchIds = [
    ...new Set(stalePendingAnswers.map((answer) => answer.dispatchId)),
  ];

  if (staleDispatchIds.length > 0) {
    await prisma.dailyQuestionnaireAnswer.deleteMany({
      where: {
        dispatchId: { in: staleDispatchIds },
      },
    });

    await prisma.dailyQuestionDispatch.deleteMany({
      where: {
        id: { in: staleDispatchIds },
      },
    });
  }

  const peerUsers = await seedReportDemoPeers(input.tenantId, input.rootPositionId);
  const sentOn = new Date();
  sentOn.setHours(0, 0, 0, 0);

  const peerAnswerSets = [
    ['valamelyest', 'nagymértékben'],
    ['nagyon nagy mértékben', 'valamelyest'],
  ];

  for (let i = 0; i < recognitionQuestions.length; i += 1) {
    const question = recognitionQuestions[i];
    const schedule = await upsertRecognitionSchedule(
      question.id,
      RECOGNITION_PENDING_CAMPAIGN_KEY,
      'Demo pending elismerés kampány',
    );

    const dispatch = await prisma.dailyQuestionDispatch.create({
      data: {
        tenantId: input.tenantId,
        questionId: question.id,
        scheduleId: schedule.id,
        campaignKey: RECOGNITION_PENDING_CAMPAIGN_KEY,
        triggeredByUserId: input.demoUserId,
        sentOn,
        sentAt: sentOn,
        audienceType: 'ALL',
        audienceConfig: {},
        pushSent: false,
        pushTitle: 'Megérkezett a napi kérdőíved',
        pushBody: `Töltsd ki ha szeretnél többet megtudni magadról a(z) ${question.topic} témában`,
      },
    });

    await prisma.dailyQuestionnaireAnswer.create({
      data: {
        tenantId: input.tenantId,
        userId: input.demoUserId,
        questionId: question.id,
        dispatchId: dispatch.id,
        sentOn,
        isActive: true,
        answer: null,
        filledAt: null,
      },
    });

    for (let peerIndex = 0; peerIndex < peerUsers.length; peerIndex += 1) {
      await prisma.dailyQuestionnaireAnswer.create({
        data: {
          tenantId: input.tenantId,
          userId: peerUsers[peerIndex].id,
          questionId: question.id,
          dispatchId: dispatch.id,
          sentOn,
          isActive: true,
          answer: peerAnswerSets[peerIndex][i] ?? peerAnswerSets[peerIndex][0],
          filledAt: new Date(sentOn.getTime() + 1000 * 60 * 60 * (8 + peerIndex)),
        },
      });
    }
  }

  console.log('Demo pending recognition seed kész:', {
    topic: RECOGNITION_DEMO_TOPIC,
    campaignKey: RECOGNITION_PENDING_CAMPAIGN_KEY,
    questions: recognitionQuestions.length,
  });
}

async function upsertRecognitionSchedule(
  questionId: string,
  campaignKey: string,
  name: string,
) {
  const existingSchedule = await prisma.dailyQuestionSchedule.findFirst({
    where: {
      tenantId: null,
      questionId,
      campaignKey,
    },
  });

  if (existingSchedule) {
    return prisma.dailyQuestionSchedule.update({
      where: { id: existingSchedule.id },
      data: {
        name,
        scheduleType: 'MANUAL',
        audienceType: 'ALL',
        audienceConfig: {},
        isActive: true,
      },
    });
  }

  return prisma.dailyQuestionSchedule.create({
    data: {
      questionId,
      name,
      campaignKey,
      scheduleType: 'MANUAL',
      audienceType: 'ALL',
      audienceConfig: {},
      isActive: true,
    },
  });
}

async function seedCompletedTopicReportDemo(input: {
  tenantId: string;
  rootPositionId: string;
  demoUserId: string;
}) {
  const topic = await upsertReportDemoTopic(input.tenantId);
  const reportQuestions: DailyQuestion[] = [];

  for (const item of REPORT_DEMO_QUESTIONS) {
    const existing = await prisma.dailyQuestion.findFirst({
      where: {
        tenantId: input.tenantId,
        question: item.question,
      },
    });

    if (existing) {
      reportQuestions.push(
        await prisma.dailyQuestion.update({
          where: { id: existing.id },
          data: {
            topicId: topic.id,
            topic: topic.name,
            answerOptions: REPORT_DEMO_OPTIONS,
            type: DailyQuestionType.SINGLE_CHOICE_5,
            isActive: true,
            isGlobal: false,
            hungarianNorm: item.hungarianNorm,
            hungarianStd: item.hungarianStd,
          },
        }),
      );
    } else {
      reportQuestions.push(
        await prisma.dailyQuestion.create({
          data: {
            tenantId: input.tenantId,
            topicId: topic.id,
            topic: topic.name,
            question: item.question,
            answerOptions: REPORT_DEMO_OPTIONS,
            type: DailyQuestionType.SINGLE_CHOICE_5,
            isActive: true,
            isGlobal: false,
            hungarianNorm: item.hungarianNorm,
            hungarianStd: item.hungarianStd,
          },
        }),
      );
    }
  }

  for (const question of reportQuestions) {
    const existingSchedule = await prisma.dailyQuestionSchedule.findFirst({
      where: {
        tenantId: input.tenantId,
        questionId: question.id,
        campaignKey: REPORT_DEMO_CAMPAIGN_KEY,
      },
    });

    if (existingSchedule) {
      await prisma.dailyQuestionSchedule.update({
        where: { id: existingSchedule.id },
        data: {
          name: 'Demo jólét kampány',
          campaignKey: REPORT_DEMO_CAMPAIGN_KEY,
          scheduleType: 'MANUAL',
          audienceType: 'ALL',
          audienceConfig: {},
          isActive: true,
        },
      });
    } else {
      await prisma.dailyQuestionSchedule.create({
        data: {
          tenantId: input.tenantId,
          questionId: question.id,
          name: 'Demo jólét kampány',
          campaignKey: REPORT_DEMO_CAMPAIGN_KEY,
          scheduleType: 'MANUAL',
          audienceType: 'ALL',
          audienceConfig: {},
          isActive: true,
        },
      });
    }
  }

  const peerUsers = await seedReportDemoPeers(input.tenantId, input.rootPositionId);
  const campaignDispatches = await prisma.dailyQuestionDispatch.findMany({
    where: {
      tenantId: input.tenantId,
      campaignKey: REPORT_DEMO_CAMPAIGN_KEY,
    },
    select: { id: true },
  });

  if (campaignDispatches.length > 0) {
    await prisma.dailyQuestionnaireAnswer.deleteMany({
      where: {
        dispatchId: { in: campaignDispatches.map((dispatch) => dispatch.id) },
      },
    });

    await prisma.dailyQuestionDispatch.deleteMany({
      where: {
        id: { in: campaignDispatches.map((dispatch) => dispatch.id) },
      },
    });
  }

  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  baseDate.setDate(baseDate.getDate() - 14);

  const demoAnswers = ['4', '5', '3'];
  const peerAnswerSets = [
    ['3', '4', '3'],
    ['5', '4', '4'],
  ];

  for (let i = 0; i < reportQuestions.length; i += 1) {
    const question = reportQuestions[i];
    const schedule = await prisma.dailyQuestionSchedule.findFirstOrThrow({
      where: {
        tenantId: input.tenantId,
        questionId: question.id,
        campaignKey: REPORT_DEMO_CAMPAIGN_KEY,
      },
    });

    const sentOn = new Date(baseDate);
    sentOn.setDate(baseDate.getDate() + i * 5);

    const dispatch = await prisma.dailyQuestionDispatch.create({
      data: {
        tenantId: input.tenantId,
        questionId: question.id,
        scheduleId: schedule.id,
        campaignKey: REPORT_DEMO_CAMPAIGN_KEY,
        triggeredByUserId: input.demoUserId,
        sentOn,
        sentAt: sentOn,
        audienceType: 'ALL',
        audienceConfig: {},
        pushSent: true,
        pushTitle: 'Demo jólét kérdés',
        pushBody: `Demo kampány: ${question.topic}`,
      },
    });

    await prisma.dailyQuestionnaireAnswer.create({
      data: {
        tenantId: input.tenantId,
        userId: input.demoUserId,
        questionId: question.id,
        dispatchId: dispatch.id,
        sentOn,
        isActive: true,
        answer: demoAnswers[i],
        filledAt: new Date(sentOn.getTime() + 1000 * 60 * 60 * 6),
      },
    });

    for (let peerIndex = 0; peerIndex < peerUsers.length; peerIndex += 1) {
      await prisma.dailyQuestionnaireAnswer.create({
        data: {
          tenantId: input.tenantId,
          userId: peerUsers[peerIndex].id,
          questionId: question.id,
          dispatchId: dispatch.id,
          sentOn,
          isActive: true,
          answer: peerAnswerSets[peerIndex][i],
          filledAt: new Date(sentOn.getTime() + 1000 * 60 * 60 * (8 + peerIndex)),
        },
      });
    }
  }

  console.log('Demo topic report seed kész:', {
    topic: topic.name,
    campaignKey: REPORT_DEMO_CAMPAIGN_KEY,
    questions: reportQuestions.length,
  });
}

async function upsertReportDemoTopic(tenantId: string) {
  const existing = await prisma.dailyQuestionTopic.findFirst({
    where: {
      tenantId,
      slug: REPORT_DEMO_TOPIC.slug,
    },
  });

  if (existing) {
    return prisma.dailyQuestionTopic.update({
      where: { id: existing.id },
      data: {
        name: REPORT_DEMO_TOPIC.name,
        description: 'Seedelt demo témakör a mobil riport felület teszteléséhez.',
        isGlobal: false,
      },
    });
  }

  return prisma.dailyQuestionTopic.create({
    data: {
      tenantId,
      name: REPORT_DEMO_TOPIC.name,
      slug: REPORT_DEMO_TOPIC.slug,
      description: 'Seedelt demo témakör a mobil riport felület teszteléséhez.',
      isGlobal: false,
    },
  });
}

async function seedReportDemoPeers(tenantId: string, rootPositionId: string) {
  const peers = [
    {
      email: 'report-peer1@demo.hu',
      firstName: 'Report',
      lastName: 'Peer 1',
    },
    {
      email: 'report-peer2@demo.hu',
      firstName: 'Report',
      lastName: 'Peer 2',
    },
  ];

  const passwordHash = await bcrypt.hash('pass1234', 10);
  const users: User[] = [];

  for (const peer of peers) {
    users.push(
      await prisma.user.upsert({
        where: { email: peer.email },
        update: {
          tenantId,
          firstName: peer.firstName,
          lastName: peer.lastName,
          role: UserRole.USER,
          isLeader: false,
          isDeleted: false,
          positionId: rootPositionId,
          passwordHash,
        },
        create: {
          tenantId,
          email: peer.email,
          passwordHash,
          firstName: peer.firstName,
          lastName: peer.lastName,
          role: UserRole.USER,
          isLeader: false,
          positionId: rootPositionId,
        },
      }),
    );
  }

  return users;
}



main()
  .catch((e) => {
    console.error('❌ Seed hiba:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
