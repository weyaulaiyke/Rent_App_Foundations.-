const requireAuth = require("./middleware/auth");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const prisma = new PrismaClient();

const app = express();
app.use(express.json())
app.use(cookieParser())
app.get("/", function(req, res) {
    res.json({ message: "Day 17 auth API is running" })
})

app.post("/auth/register", async function(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required"
        })
    }
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            email: email,
            passwordHash: passwordHash
        }
    })
    return res.status(201).json({
        id: user.id,
        email: user.email
    })
});

app.post("/auth/login", async function(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            error: "Email and password are required"
        })
    }
    const user = await prisma.user.findUnique({
        where: {
            email: email
        }
    })
    if (!user) {
        return res.status(401).json({
            error: "Invalid email or password"
        })
    }
    const passwordMatches = await bcrypt.compare(
        password, user.passwordHash
    );
    if (!passwordMatches) {
        return res.status(401).json({
            error: "Invalid email or password"
        })
    }
    const token = jwt.sign({ userId: user.id },
        process.env.JWT_SECRET, { expiresIn: "1d" }
    );
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
    })
})
app.get("/auth/me", requireAuth, async function(req, res) {
    const user = await prisma.user.findUnique({
        where: {
            id: req.userId
        }
    })
    if (!user) {
        return res.status(404).json({
            error: "User not found"
        })
    }
    return res.json({
        id: user.id,
        email: user.email
    })
})
app.post("/properties", requireAuth, async function(req, res) {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({
            error: "Property name is required"
        })
    }
    const property = await prisma.property.create({
        data: {
            name: name,
            userId: req.userId
        }
    })
    return res.status(201).json(property)
})
app.get("/properties", requireAuth, async function(req, res) {
    const properties = await prisma.property.findMany({
        where: {
            userId: req.userId
        }
    })
    return res.json(properties);
})
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
    return res.json(updatedProperty);
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, function() {
    console.log(`Server is running on http://localhost:${PORT}`)
})