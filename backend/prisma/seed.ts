import { prisma } from '../src/lib/db.js'
import { hashPassword } from '../src/lib/auth.js'
import type { Role } from '@prisma/client'

interface DemoUser {
  email: string
  firstName: string
  lastName: string
  role: Role
}

const DEMO_PASSWORD = process.env['DEMO_USER_PASSWORD'] ?? 'WorkMesh@2026!'

const DEMO_COMPANY = {
  name: 'WorkMesh Technologies Pvt. Ltd.',
  slug: 'workmesh-tech',
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'superadmin@workmesh.test',
    firstName: 'Aarav',
    lastName: 'Sharma',
    role: 'SUPER_ADMIN',
  },
  {
    email: 'admin@workmesh.test',
    firstName: 'Priya',
    lastName: 'Patel',
    role: 'ADMIN',
  },
  {
    email: 'manager.eng@workmesh.test',
    firstName: 'Rohan',
    lastName: 'Verma',
    role: 'MANAGER',
  },
  {
    email: 'manager.hr@workmesh.test',
    firstName: 'Neha',
    lastName: 'Gupta',
    role: 'MANAGER',
  },
  {
    email: 'employee.dev@workmesh.test',
    firstName: 'Karan',
    lastName: 'Mehta',
    role: 'EMPLOYEE',
  },
  {
    email: 'employee.hr@workmesh.test',
    firstName: 'Ananya',
    lastName: 'Deshmukh',
    role: 'EMPLOYEE',
  },
  {
    email: 'employee.mkt@workmesh.test',
    firstName: 'Vikram',
    lastName: 'Singhania',
    role: 'EMPLOYEE',
  },
]

export async function seedDatabase() {
  console.log('🌱 Starting database seed...')

  // 1. Upsert company
  const company = await prisma.company.upsert({
    where: { slug: DEMO_COMPANY.slug },
    update: {
      name: DEMO_COMPANY.name,
      isActive: true,
    },
    create: {
      name: DEMO_COMPANY.name,
      slug: DEMO_COMPANY.slug,
      isActive: true,
    },
  })

  console.log(`✅ Seeded company: "${company.name}" (slug: ${company.slug}, id: ${company.id})`)

  // 2. Hash shared demo password
  const passwordHash = await hashPassword(DEMO_PASSWORD)

  // 3. Upsert users and memberships
  let userCount = 0
  for (const demoUser of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        passwordHash,
        isActive: true,
      },
      create: {
        email: demoUser.email,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        passwordHash,
        isActive: true,
      },
    })

    await prisma.membership.upsert({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId: company.id,
        },
      },
      update: {
        role: demoUser.role,
      },
      create: {
        userId: user.id,
        companyId: company.id,
        role: demoUser.role,
      },
    })

    userCount++
    console.log(`   👤 ${demoUser.role.padEnd(12)} : ${demoUser.email} (${demoUser.firstName} ${demoUser.lastName})`)
  }

  console.log(`✅ Successfully seeded ${userCount} demo employees into WorkMesh Technologies!`)
  console.log(`🔑 Demo password for all accounts: ${DEMO_PASSWORD}`)
  console.log('🌱 Database seeding completed successfully.')
}

// Run directly when executed as a script
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  seedDatabase()
    .catch((err) => {
      console.error('❌ Error seeding database:', err)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
