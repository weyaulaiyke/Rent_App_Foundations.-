const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")
const cors = require("cors");
const requireAuth = require("./middleware/auth")
const express = require("express");
const cookieParser = require("cookie-parser")
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.get("/", function(req, res) {
    res.json({
        message: "Rent API is running"
    });
});

app.post("/auth/register", async function(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required"
        });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            email: email,
            passwordHash: passwordHash
        }
    });
    return res.status(201).json({
        id: user.id,
        email: user.email
    })
})

app.post("/auth/login", async function(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required"
        });
    }
    const user = await prisma.user.findUnique({
        where: {
            email: email
        }
    });
    if (!user) {
        return res.status(401).json({
            error: "Invalid email or password"
        })
    }
    const passwordMatches = await bcrypt.compare(
        password,
        user.passwordHash
    )
    if (!passwordMatches) {
        return res.status(401).json({
            error: "Invalid email or password"
        })
    }
    const token = jwt.sign({ userId: user.id },
        process.env.JWT_SECRET, { expiresIn: "1d" })
    res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    })
    return res.json({
        message: "Login successful",
        user: {
            id: user.id,
            email: user.email
        }
    });
});

app.get("/auth/me", requireAuth, async function(req, res) {
    const user = await prisma.user.findUnique({
        where: {
            id: req.userId
        }
    })
    if (!user) {
        return res.status(404).json({
            error: "User not found"
        });
    }
    return res.json({
        id: user.id,
        email: user.email
    })
})

app.get("/properties", requireAuth, async function(req, res) {
    const properties = await prisma.property.findMany({
        where: {
            userId: req.userId
        }
    });
    return res.json({
        data: properties
    });
});

app.post("/properties", requireAuth, async function(req, res) {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({
            error: "Property name is required"
        });
    }
    const property = await prisma.property.create({
        data: {
            name: name,
            userId: req.userId
        }
    });
    return res.status(201).json({
        data: property
    });
});

app.patch("/properties/:id", requireAuth, async function(req, res) {
    const propertyId = Number(req.params.id);
    const { name } = req.body;

    const property = await prisma.property.findFirst({
        where: {
            id: propertyId,
            userId: req.userId
        }
    });
    if (!property) {
        return res.status(404).json({
            error: "Property not found"
        });
    }
    const updatedProperty = await prisma.property.update({
        where: {
            id: propertyId
        },
        data: {
            name: name
        }
    });
    return res.json({
        data: updatedProperty
    })
})

app.delete("/properties/:id", requireAuth, async function(req, res) {
    const propertyId = Number(req.params.id);
    const property = await prisma.property.findFirst({
        where: {
            id: propertyId,
            userId: req.userId
        }
    });
    if (!property) {
        return res.status(404).json({
            error: "Property not found"
        });
    }
    await prisma.property.delete({
        where: {
            id: propertyId
        }
    });
    return res.json({
        data: {
            message: "Property deleted"
        }
    });
});

app.get("/units", requireAuth, async function(req, res) {
    const units = await prisma.unit.findMany({
        where: {
            property: {
                userId: req.userId
            }
        },
        include: {
            property: true
        }
    });
    return res.json({
        data: units
    });
});

app.post("/units", requireAuth, async function(req, res) {
    const { number, propertyId } = req.body;
    if (!number || !propertyId) {
        return res.status(400).json({
            error: "Unit number and propertyId are required"
        });
    }
    const property = await prisma.property.findFirst({
        where: {
            id: Number(propertyId),
            userId: req.userId
        }
    });
    if (!property) {
        return res.status(404).json({
            error: "Property not found"
        })
    }
    const unit = await prisma.unit.create({
        data: {
            number: number,
            propertyId: Number(propertyId)
        }
    });
    return res.status(201).json({
        data: unit
    })
});

app.patch("/units/:id", requireAuth, async function(req, res) {
    const unitId = Number(req.params.id);
    const { number } = req.body;
    const unit = await prisma.unit.findFirst({
        where: {
            id: unitId,
            property: {
                userId: req.userId
            }
        }
    });
    if (!unit) {
        return res.status(404).json({
            error: "Unit not found"
        });
    }
    const updatedUnit = await prisma.unit.update({
        where: {
            id: unitId
        },
        data: {
            number: number
        }
    })
    return res.json({
        data: updatedUnit
    })
})

app.delete("/units/:id", requireAuth, async function(req, res) {
    const unitId = Number(req.params.id);
    const unit = await prisma.unit.findFirst({
        where: {
            id: unitId,
            property: {
                userId: req.userId
            }
        }
    });
    if (!unit) {
        return res.status(404).json({
            error: "Unit not found"
        });
    }
    await prisma.unit.delete({
        where: {
            id: unitId
        }
    });
    return res.json({
        data: {
            message: "Unit deleted"
        }
    });
});

app.get("/renters", requireAuth, async function(req, res) {
    const renters = await prisma.renter.findMany({
        where: {
            isArchived: false
        }
    })
    return res.json({
        data: renters
    })
})

app.get("/renters/archived", requireAuth, async function(req, res) {
    const renters = await prisma.renter.findMany({
        where: {
            isArchived: true
        }
    });
    return res.json({
        data: renters
    });
});

app.post("/renters", requireAuth, async function(req, res) {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({
            error: "Renter name is required"
        })
    }
    const renter = await prisma.renter.create({
        data: {
            name: name
        }
    });
    return res.status(201).json({
        data: renter
    });
});

app.patch("/renters/:id", requireAuth, async function(req, res) {
    const renterId = Number(req.params.id);
    const { name } = req.body;
    const renter = await prisma.renter.findUnique({
        where: {
            id: renterId
        }
    });
    if (!renter) {
        return res.status(404).json({
            error: "Renter not found"
        });
    }
    const updatedRenter = await prisma.renter.update({
        where: {
            id: renterId
        },
        data: {
            name: name
        }
    });
    return res.json({
        data: updatedRenter
    });
});


app.patch("/renters/:id/restore", requireAuth, async function(req, res) {
    const renterId = Number(req.params.id);

    const renter = await prisma.renter.findUnique({
        where: {
            id: renterId
        }
    });

    if (!renter) {
        return res.status(404).json({
            error: "Renter not found"
        });
    }

    const restoredRenter = await prisma.renter.update({
        where: {
            id: renterId
        },
        data: {
            isArchived: false
        }
    });

    return res.json({
        data: restoredRenter
    });
});

app.patch("/renters/:id/restore", requireAuth, async function(req, res) {
    const renterId = Number(req.params.id);

    const renter = await prisma.renter.findUnique({
        where: {
            id: renterId
        }
    });
    if (!renter) {
        return res.status(404).json({
            error: "Renter not found"
        });
    }

    const restoredRenter = await prisma.renter.update({
        where: {
            id: renterId
        },
        data: {
            isArchived: false
        }
    });
    return res.json({
        data: restoredRenter
    })
})


app.delete("/renters/:id", requireAuth, async function(req, res) {
    const renterId = Number(req.params.id);
    const renter = await prisma.renter.findUnique({
        where: {
            id: renterId
        }
    });
    if (!renter) {
        return res.status(404).json({
            error: "Renter not found"
        });
    }
    await prisma.renter.update({
        where: {
            id: renterId
        },
        data: {
            isArchived: true
        }
    });
    return res.json({
        data: {
            message: "Renter deleted"
        }
    });
});

app.get("/leases", requireAuth, async function(req, res) {
    const leases = await prisma.lease.findMany({
        include: {
            renter: true,
            unit: {
                include: {
                    property: true
                }
            }
        }
    })
    return res.json({
        data: leases
    })
})

app.post("/leases", requireAuth, async function(req, res) {
    const { renterId, unitId, monthlyRent } = req.body;
    if (!renterId || !unitId || !monthlyRent) {
        return res.status(400).json({
            error: "renterId, unitId and monthlyRent are required"
        });
    }
    const unit = await prisma.unit.findFirst({
        where: {
            id: Number(unitId),
            property: {
                userId: req.userId
            }
        }
    })
    if (!unit) {
        return res.status(404).json({
            error: "User not found"
        })
    }
    const renter = await prisma.renter.findUnique({
        where: {
            id: Number(renterId)
        }
    });
    if (!renter) {
        return res.status(404).json({
            error: "Renter not found"
        })
    }
    const lease = await prisma.lease.create({
        data: {
            renterId: Number(renterId),
            unitId: Number(unitId),
            monthlyRent: Number(monthlyRent)
        }
    })
    return res.status(201).json({
        data: lease
    })
})

app.patch("/leases/:id", requireAuth, async function(req, res) {
    const leaseId = Number(req.params.id)
    const { monthlyRent } = req.body
    const lease = await prisma.lease.findFirst({
        where: {
            id: leaseId,
            unit: {
                property: {
                    userId: req.userId
                }
            }
        }
    });
    if (!lease) {
        return res.status(404).json({
            error: "Lease not found"
        });
    }
    const updatedLease = await prisma.lease.update({
        where: {
            id: leaseId
        },
        data: {
            monthlyRent: Number(monthlyRent)
        }
    })
    return res.json({
        data: updatedLease
    })
})

app.delete("/leases/:id", requireAuth, async function(req, res) {
    const leaseId = Number(req.params.id);
    const lease = await prisma.lease.findFirst({
        where: {
            id: leaseId,
            unit: {
                property: {
                    userId: req.userId
                }
            }
        }
    });
    if (!lease) {
        return res.status(404).json({
            error: "Lease not found"
        });
    }
    await prisma.lease.delete({
        where: {
            id: leaseId
        }
    });
    return res.json({
        data: {
            message: "Lease deleted"
        }
    });
});

app.get("/payments", requireAuth, async function(req, res) {
    const payments = await prisma.payment.findMany({
        include: {
            renter: true
        }
    })
    return res.json({
        data: payments
    });
});

app.post("/payments", requireAuth, async function(req, res) {
    const { renterId, amount, paymentDate } = req.body;
    if (!renterId || !amount || !paymentDate) {
        return res.status(400).json({
            error: "renterId, amount and paymentDate are required"
        })
    }
    const renter = await prisma.renter.findFirst({
        where: {
            id: Number(renterId),
            leases: {
                some: {
                    unit: {
                        property: {
                            userId: req.userId
                        }
                    }
                }
            }
        }
    })
    if (!renter) {
        return res.status(404).json({
            error: "Renter not found"
        })
    }
    const payment = await prisma.payment.create({
        data: {
            renterId: Number(renterId),
            amount: Number(amount),
            paymentDate: new Date(paymentDate)
        }
    });
    return res.status(201).json({
        data: payment
    });
});

app.patch("/payments/:id", requireAuth, async function(req, res) {
    const paymentId = Number(req.params.id);
    const { amount, paymentDate } = req.body;
    const payment = await prisma.payment.findFirst({
        where: {
            id: paymentId,
            renter: {
                leases: {
                    some: {
                        unit: {
                            property: {
                                userId: req.userId
                            }
                        }
                    }
                }
            }
        }
    })
    if (!payment) {
        return res.status(404).json({
            error: "Payment not found"
        });
    }
    const updatedData = {}
    if (amount !== undefined) {
        updatedData.amount = Number(amount)
    }
    if (paymentDate !== undefined) {
        updatedData.paymentDate = new Date(paymentDate);
    }
    const updatedPayment = await prisma.payment.update({
        where: {
            id: paymentId
        },
        data: updatedData
    })
    return res.json({
        data: updatedPayment
    });
});

app.delete("/payments/:id", requireAuth, async function(req, res) {
    const paymentId = Number(req.params.id);
    const payment = await prisma.payment.findFirst({
        where: {
            id: paymentId,
            renter: {
                leases: {
                    some: {
                        unit: {
                            property: {
                                userId: req.userId
                            }
                        }
                    }
                }
            }
        }
    });
    if (!payment) {
        return res.status(404).json({
            error: "Payment not found"
        });
    }
    await prisma.payment.delete({
        where: {
            id: paymentId
        }
    });
    return res.json({
        data: {
            message: "Payment deleted"
        }
    });
});

app.get("/reports/arrears", requireAuth, async function(req, res) {
    const leases = await prisma.lease.findMany({
        where: {
            unit: {
                property: {
                    userId: req.userId
                }
            }
        },
        include: {
            renter: {
                include: {
                    payments: true
                }
            },
            unit: {
                include: {
                    property: true
                }
            }
        }
    });
    const arrears = leases
        .map(function(lease) {
            const totalPaid = lease.renter.payments.reduce(
                function(total, payment) {
                    return total + payment.amount;
                }, 0);
            return {
                renter: lease.renter.name,
                property: lease.unit.property.name,
                unit: lease.unit.number,
                monthlyRent: lease.monthlyRent,
                totalPaid: totalPaid,
                arrears: lease.monthlyRent - totalPaid
            };
        })
        .filter(function(item) {
            return item.arrears > 0;
        });
    return res.json({
        data: arrears
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, function() {
    console.log(`Server running on http://localhost:${PORT}`);
});