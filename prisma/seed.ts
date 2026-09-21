import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@huska.app";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Huska Admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        approvalStatus: "APPROVED",
        isActive: true,
        avatarColor: "#4338CA",
      },
    });
    console.log(`✔ Admin account created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`• Admin account already exists: ${adminEmail}`);
  }

  const zoneName = process.env.SEED_ZONE_NAME ?? "Huska Lab";
  const zoneExisting = await prisma.attendanceZone.findFirst({ where: { name: zoneName } });
  if (!zoneExisting) {
    await prisma.attendanceZone.create({
      data: {
        name: zoneName,
        latitude: Number(process.env.SEED_ZONE_LAT ?? -1.9441),
        longitude: Number(process.env.SEED_ZONE_LNG ?? 30.0619),
        radiusMeters: Number(process.env.SEED_ZONE_RADIUS_M ?? 150),
        isActive: true,
      },
    });
    console.log(`✔ Attendance zone created: ${zoneName}`);
  } else {
    console.log(`• Attendance zone already exists: ${zoneName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
