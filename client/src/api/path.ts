import React from "react"

export default function useReactPath(): string {
    const [path, setPath] = React.useState<string>(window.location.href);
    const listenToPopState = () => {
        const winPath = window.location.href;
        setPath(winPath);
    };
    React.useEffect(() => {
        window.addEventListener("popstate", listenToPopState);
        return () => {
            window.removeEventListener("popstate", listenToPopState);
        };
    }, []);
    return path;
};
