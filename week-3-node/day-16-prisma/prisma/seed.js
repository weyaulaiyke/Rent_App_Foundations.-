const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient();
async function main() {
    const sunrise = await prisma.property.create({
        data: {
            name: "Sunrise Apartments"
        }
    })

    const greenView = await prisma.property.create({
        data: {
            name: "Green View Flats"
        }
    })

    const a1 = await prisma.unit.create({
        data: {
            number: "A1",
            propertyId: sunrise.id
        }
    })

    const a2 = await prisma.unit.create({
        data: {
            number: "A2",
            propertyId: sunrise.id
        }
    })
    const john = await prisma.renter.create({
        data: {
            name: "John Doe"
        }
    })
    const mary = await prisma.renter.create({
        data: {
            name: "Mary"
        }
    })

    await prisma.lease.create({
        data: {
            renterId: john.id,
            unitId: a1.id,
            monthlyRent: 500000
        }
    })

    await prisma.lease.create({
        data: {
            renterId: mary.id,
            unitId: a2.id,
            monthlyRent: 500000
        }
    })

    await prisma.payment.create({
        data: {
            renterId: john.id,
            amount: 500000,
            paymentDate: new Date("2026-10-23")
        }
    })
}

main()
    .catch(function(error) {
        console.error(error);
        process.exit(1)
    })
    .finally(async function() {
        await prisma.$disconnect
    })