INSERT INTO properties(name)
VALUES('Sunrise Apartments');

INSERT INTO properties(name)
VALUES('Green View Flats');

INSERT INTO units(number, property_id)
VALUES('A1', 1);

INSERT INTO units(number, property_id)
VALUES('A2', 1);

INSERT INTO renters(name)
VALUES('John Doe');

INSERT INTO renters(name)
VALUES('Mary');

INSERT INTO leases(renter_id, unit_id, monthly_rent)
VALUES(1, 1, 500000);

INSERT INTO leases(renter_id, unit_id, monthly_rent)
VALUES(2, 2, 500000);

INSERT INTO payments(renter_id, amount, payment_date)
VALUES(1, 500000, '2026-10-23');