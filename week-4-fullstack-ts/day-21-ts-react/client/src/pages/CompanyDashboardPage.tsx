import { useContext } from "react";
import AuthContext from "../context/AuthContext";
import DashboardPage from "./DashboardPage";

function CompanyDashboardPage() {
    const auth = useContext(AuthContext);

    if (!auth) {
        throw new Error("AuthProvider missing");
    }

    const companyName =
        auth.user?.organizationName ?? "Company Workspace";

    return (
        <DashboardPage
            title="Company Dashboard"
            subtitle={companyName}
        />
    );
}

export default CompanyDashboardPage;