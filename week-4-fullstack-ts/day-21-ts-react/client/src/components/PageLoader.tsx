type PageLoaderProps = {
    label: string;
};

export default function PageLoader({ label }: PageLoaderProps) {
    return (
        <div className="remote-startup remote-page-loader" role="status">
            <span className="remote-startup-mark" aria-hidden="true">R</span>
            <span>{label}</span>
        </div>
    );
}