# Rent API

A REST API for managing rental properties, units, renters, leases, payments, and arrears.

Built with Express, Prisma, PostgreSQL, and JWT authentication.

## Authentication

### Register
POST /auth/register

Creates a new landlord account.

### Login
POST /auth/login

Logs in a landlord and stores the JWT in an httpOnly cookie.

### Current User
GET /auth/me

Returns the currently authenticated landlord.

## Properties

### Get Properties
GET /properties

Returns all properties owned by the logged-in landlord.

### Create Property
POST /properties

Creates a new property for the logged-in landlord.

### Update Property
PATCH /properties/:id

Updates a property owned by the logged-in landlord.

### Delete Property
DELETE /properties/:id

Deletes a property owned by the logged-in landlord.

## Units

### Get Units
GET /units

Returns all units belonging to properties owned by the logged-in landlord.

### Create Unit
POST /units

Creates a new unit inside one of the logged-in landlord's properties.

### Update Unit
PATCH /units/:id

Updates a unit belonging to the logged-in landlord.

### Delete Unit
DELETE /units/:id

Deletes a unit belonging to the logged-in landlord.

## Renters

### Get Renters
GET /renters

Returns all renters.

### Create Renter
POST /renters

Creates a new renter.

### Update Renter
PATCH /renters/:id

Updates an existing renter.

### Delete Renter
DELETE /renters/:id

Deletes a renter.

## Leases

### Get Leases
GET /leases

Returns all leases with renter, unit, and property details.

### Create Lease
POST /leases

Creates a lease linking a renter to a unit.

### Update Lease
PATCH /leases/:id

Updates an existing lease.

### Delete Lease
DELETE /leases/:id

Deletes a lease.

## Payments

### Get Payments
GET /payments

Returns all recorded payments.

### Create Payment
POST /payments

Creates a new payment for a renter.

### Update Payment
PATCH /payments/:id

Updates an existing payment.

### Delete Payment
DELETE /payments/:id

Deletes a payment.

## Arrears Report

### Get Arrears
GET /reports/arrears

Returns renters who still owe rent, including:

- renter name
- property
- unit
- monthly rent
- total paid
- remaining arrears