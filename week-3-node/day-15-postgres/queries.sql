SELECT units.number, properties.name
FROM units
JOIN properties ON units.property_id = properties.id
JOIN leases ON units.id = leases.unit_id;

SELECT units.number, properties.name
FROM units
JOIN properties ON units.property_id = properties.id
LEFT JOIN leases ON units.id = leases.unit_id
WHERE leases.id IS NULL;

SELECT properties.name, SUM(payments.amount)
FROM payments
JOIN renters ON payments.renter_id = renters.id
JOIN leases ON renters.id = leases.renter_id
JOIN units ON leases.unit_id = units.id
JOIN properties ON units.property_id = properties.id
WHERE payments.payment_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY properties.name;

SELECT renters.name, leases.monthly_rent, 
COALESCE(SUM(payments.amount),0) AS total_paid
FROM renters
JOIN leases ON renters.id = leases.renter_id
LEFT JOIN payments ON renters.id = payments.renter_id
GROUP BY renters.name, leases.monthly_rent
HAVING COALESCE(SUM(payments.amount), 0)< leases.monthly_rent;
