import {
    createContext,
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode
} from "react";
import { ChevronDown, Monitor, Moon, Sun } from "lucide-react";

type Preference = "system" | "light" | "dark";

const STORAGE_KEY = "remote-theme";

const ThemeContext = createContext<{
    preference: Preference;
    setPreference: (value: Preference) => void;
} | null>(null);

function readPreference(): Preference {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved === "light" || saved === "dark") {
            return saved;
        }
    } catch {
        // Fall back to System when storage is unavailable.
    }

    return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [preference, setPreference] =
        useState<Preference>(readPreference);

    const [systemDark, setSystemDark] = useState(function() {
        return window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;
    });

    useEffect(function() {
        const media = window.matchMedia(
            "(prefers-color-scheme: dark)"
        );

        const update = () => setSystemDark(media.matches);

        update();
        media.addEventListener("change", update);

        return () => media.removeEventListener("change", update);
    }, []);

    useLayoutEffect(function() {
        const theme =
            preference === "system"
                ? systemDark ? "dark" : "light"
                : preference;

        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;

        try {
            localStorage.setItem(STORAGE_KEY, preference);
        } catch {
            // Changes still work without persistent storage.
        }
    }, [preference, systemDark]);

    return (
        <ThemeContext.Provider value={{ preference, setPreference }}>
            {children}
        </ThemeContext.Provider>
    );
}

function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
    const theme = useContext(ThemeContext);
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const groupName = useId();

    useEffect(function() {
        function closeOutside(event: PointerEvent) {
            if (
                event.target instanceof Node &&
                !detailsRef.current?.contains(event.target)
            ) {
                detailsRef.current?.removeAttribute("open");
            }
        }

        document.addEventListener("pointerdown", closeOutside);

        return () =>
            document.removeEventListener("pointerdown", closeOutside);
    }, []);

    if (!theme) throw new Error("ThemeProvider missing");

    const { preference, setPreference } = theme;

    const label =
        preference === "system"
            ? "System"
            : preference === "dark" ? "Dark" : "Light";

    const Icon =
        preference === "system"
            ? Monitor
            : preference === "dark" ? Moon : Sun;

    function closeMenu() {
        detailsRef.current?.removeAttribute("open");
        detailsRef.current
            ?.querySelector<HTMLElement>("summary")
            ?.focus();
    }

    return (
        <details
            ref={detailsRef}
            className={`theme-switcher${
                compact ? " theme-switcher--compact" : ""
            }`}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    closeMenu();
                }
            }}
            onBlur={(event) => {
                if (
                    !event.currentTarget.contains(
                        event.relatedTarget as Node | null
                    )
                ) {
                    event.currentTarget.removeAttribute("open");
                }
            }}
        >
            <summary
                className="theme-trigger"
                aria-label={`Color theme: ${label}`}
                title={`Color theme: ${label}`}
            >
                <Icon size={19} aria-hidden="true" />

                <span className="theme-trigger-text">{label}</span>

                <ChevronDown
                    className="theme-chevron"
                    size={15}
                    aria-hidden="true"
                />
            </summary>

            <fieldset className="theme-menu">
                <legend>Appearance</legend>

                {(["light", "dark", "system"] as const).map(
                    function(value) {
                        return (
                            <label key={value}>
                                <input
                                    type="radio"
                                    name={groupName}
                                    value={value}
                                    checked={preference === value}
                                    onChange={() => setPreference(value)}
                                    onClick={(event) => {
                                        if (event.detail > 0) closeMenu();
                                    }}
                                />

                                <span>
                                    {value === "system"
                                        ? "System"
                                        : value === "dark"
                                          ? "Dark"
                                          : "Light"}
                                </span>
                            </label>
                        );
                    }
                )}
            </fieldset>
        </details>
    );
}

export default ThemeSwitcher;