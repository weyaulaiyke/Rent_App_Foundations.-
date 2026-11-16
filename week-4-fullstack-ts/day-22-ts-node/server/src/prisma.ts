import PrismaPackage = require("@prisma/client");
const { PrismaClient } = PrismaPackage;
const prisma = new PrismaClient();
export default prisma;