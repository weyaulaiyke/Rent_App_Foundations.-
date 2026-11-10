import ThemeSwitcher from "../components/ThemeSwitcher";
import "./SettingsPage.css";

function SettingsPage() {
    return (
        <div className="settings-page">
            <h1 className="dashboard-heading">Settings</h1>

            <section
                className="settings-appearance"
                aria-labelledby="appearance-heading"
            >
                <div className="settings-appearance-copy">
                    <h2 id="appearance-heading">Appearance</h2>

                    <p>
                        Choose Light, Dark, or System to follow your device.
                    </p>

                    <p className="settings-help">
                        Changes apply immediately and are saved in this browser.
                    </p>
                </div>

                <div className="settings-theme-control">
                    <ThemeSwitcher />
                </div>
            </section>
        </div>
    );
}

export default SettingsPage;