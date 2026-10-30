const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient
async function main() {
    const properties = await prisma.property.findMany({
        include: {
            units: true
        }
    })
    console.dir(properties, { depth: null })

    const occupiedUnits = await prisma.unit.findMany({
        where: {
            leases: {
                some: {}
            }
        },
        include: {
            property: true
        }
    })
    console.dir(occupiedUnits, { depth: null })

    const vacantUnits = await prisma.unit.findMany({
        where: {
            leases: {
                none: {}
            }
        },
        include: {
            property: true
        }
    })
    console.dir(vacantUnits, { depth: null })

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const paymentsThisMonth = await prisma.payment.findMany({
        where: {
            paymentDate: {
                gte: startOfMonth
            }
        },
        include: {
            renter: true
        }
    })
    console.dir(paymentsThisMonth, { depth: null })

    const propertiesWithPayments = await prisma.property.findMany({
        include: {
            units: {
                include: {
                    leases: {
                        include: {
                            renter: {
                                include: {
                                    payments: {
                                        where: {
                                            paymentDate: {
                                                gte: startOfMonth
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    })
    console.dir(propertiesWithPayments, { depth: null })

    const rentCollectedByProperty = propertiesWithPayments.map(function(property) {
        let totalCollected = 0;
        property.units.forEach(function(unit) {
            unit.leases.forEach(function(lease) {
                lease.renter.payments.forEach(function(payment) {
                    totalCollected += payment.amount
                })
            })
        })
        return {
            property: property.name,
            totalCollected: totalCollected
        }
    })
    console.dir(rentCollectedByProperty, { depth: null })

    const arrears = await prisma.$queryRaw `
    SELECT r.name,
           l."monthlyRent",
           COALESCE(SUM(p.amount), 0)::int AS "totalPaid"
    FROM "Renter" r
    JOIN "Lease" l ON r.id = l."renterId"
    LEFT JOIN "Payment" p ON r.id = p."renterId"
    GROUP BY r.id, r.name, l.id, l."monthlyRent"
    HAVING COALESCE(SUM(p.amount), 0) < l."monthlyRent";
`;

    console.dir(arrears, { depth: null });
}
main()
    .catch(function(error) {
        console.error(error);
        process.exit(1)
    })
    .finally(async function() {
        await prisma.$disconnect
    });