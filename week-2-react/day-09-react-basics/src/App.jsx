import RenterTable from "./components/RenterTable";
import SummaryCard from "./components/SummaryCard";
import Sidebar from "./components/Sidebar";
const renters = [
  {
    id: 1,
    name:"John",
    unit:"A1",
    status:"PAID"
  },
  {
    id: 2,
    name:"Mary",
    unit:"A2",
    status:"OVERDUE"
  }
]
const SummaryCards =[
  {id: 1, title:"Total Units", value:"24"},
  {id: 2, title:"Occupied Units", value:"18"},
  {id: 3, title:"Rent Collected", value:"UGX 8,500,000"},
  {id: 4, title:"Arrears", value:"UGX 1,200,000"},
]
function App() {
    return (
      <>
            <Sidebar />
            <main className="main-content">
            <header className="topbar">
                  <h1>Landlord Dashboard</h1>
            </header>
            <section className="summary-cards">
            {SummaryCards.map(function(card){
              return(
                <SummaryCard
                key={card.id}
                title={card.title}
                value={card.value}  
                />
              );
            })}
            </section>
            <RenterTable renters={renters}/>
        </main> 
        </>
    );
}

export default App;