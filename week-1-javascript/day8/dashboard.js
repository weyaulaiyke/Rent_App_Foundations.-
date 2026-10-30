const renters = [{
        name: "John",
        unit: "A1",
        status: "PAID"
    },
    {
        name: "Mary",
        unit: "A2",
        status: "OVERDUE"
    }
];
const tableBody = document.querySelector("#renterTableBody");

function renderRenters(list = renters) {
    tableBody.innerHTML = "";
    for (let renter of list) {
        tableBody.innerHTML += `
    <tr>
    <td>${renter.name}</td>
    <td>${renter.unit}</td>
    <td>
    <button class="status-button" data-unit="${renter.unit}">
    ${renter.status}</button>
    </td>
    </tr>
    `;
    }
}
renderRenters();
const totalUnits = document.querySelector("#totalUnits");
console.log(renterForm);
const occupiedUnits = document.querySelector("#occupiedUnits");
const rentCollected = document.querySelector("#rentCollected");
const arrears = document.querySelector("#arrears")
renterForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const name = renterNameInput.value;
    const unit = renterUnitInput.value;
    renters.push({
        name: name,
        unit: unit,
        status: "OVERDUE"
    });
    renderRenters();
    renterNameInput.value = "";
    renterUnitInput.value = "";
});
searchInput.addEventListener("input", function() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredRenters = renters.filter(function(renter) {
        return renter.name.toLocaleLowerCase().includes(searchTerm)
    });
    renderRenters(filteredRenters);
});
tableBody.addEventListener("click", function(event) {
    if (event.target.classList.contains("status-button")) {
        const unit = event.target.dataset.unit;

        const renter = renters.find(function(renter) {
            return renter.unit === unit;
        });
        renter.status = renter.status === "PAID" ? "OVERDUE" : "PAID";
        renderRenters();
    }
});

function updateSummary() {
    totalUnits.textContent = renters.length;
    const paidRenters = renters.filter(function(renter) {
        return renter.status === "PAID";
    });
    occupiedUnits.textContent = renters.length;
    rentCollected.textContent = paidRenters.length;
    arrears.textContent = renters.length - paidRenters.length;
    renters.length
};

function updateSummary() {
    occupiedUnits.textContent = renters.length;
    updateSummary();
    const overdueRenters = renters.filter(function(renter) {
        return renter.status === "OVERDUE";
    });
    rentCollected.textContent = paidRenters.length;
    arrears.textContent = overdueRenters.length;
    updateSummary();
}