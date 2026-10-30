CREATE TABLE properties(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)NOT NULL
);

CREATE TABLE units(
    id SERIAL PRIMARY KEY,
    number VARCHAR(20)NOT NULL,
    property_id INTEGER NOT NULL REFERENCES PROPERTIES(id)
);

CREATE TABLE renters(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)NOT NULL
);

CREATE TABLE leases(
    id SERIAL PRIMARY KEY,
    renter_id INTEGER NOT NULL REFERENCES renters(id),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    monthly_rent INTEGER NOT NULL
);

CREATE TABLE payments(
    id SERIAL PRIMARY KEY,
    renter_id INTEGER NOT NULL REFERENCES renters(id),
    amount INTEGER NOT NULL,
    payment_date DATE NOT NULL
);