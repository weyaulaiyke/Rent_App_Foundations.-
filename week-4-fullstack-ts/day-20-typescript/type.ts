interface Renter {
    id: number;
    name: string;
    email: string;
}

interface Lease {
    id: number;
    renterId: number;
    property: string;
    monthlyRent: number;
    startDate: string;
    endDate: string;
}