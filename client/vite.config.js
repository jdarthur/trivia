import fs from 'node:fs'
import path from 'node:path'
import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'

// The dev server is served over HTTPS with the self-signed cert in cert/, which
// is gitignored. Fall back to plain HTTP when it isn't there so a fresh clone
// can still run `npm start` without generating a certificate first.
function httpsConfig() {
    const cert = path.resolve(import.meta.dirname, 'cert/private.pem')
    const key = path.resolve(import.meta.dirname, 'cert/private.key')

    if (!fs.existsSync(cert) || !fs.existsSync(key)) {
        console.warn('cert/private.pem or cert/private.key missing -- serving over HTTP')
        return undefined
    }

    return {cert: fs.readFileSync(cert), key: fs.readFileSync(key)}
}

export default defineConfig(({mode}) => {
    // Pass '' as the prefix to load every variable, not just the ones Vite would
    // expose to client code. These are only read here, to build proxy targets.
    const env = loadEnv(mode, import.meta.dirname, '')

    const editorHost = env.REACT_APP_EDITOR_HOST || 'localhost'
    const gameplayHost = env.REACT_APP_GAMEPLAY_HOST || editorHost
    const editorPort = env.REACT_APP_EDITOR_PORT || '8080'
    const gameplayPort = env.REACT_APP_GAMEPLAY_PORT || editorPort

    const editorTarget = `http://${editorHost}:${editorPort}`
    const gameplayTarget = `http://${gameplayHost}:${gameplayPort}`

    return {
        plugins: [react()],

        server: {
            host: env.HOST || '0.0.0.0',
            // Matches what the Create React App start script used. 443 needs
            // privileges on most systems, so override with PORT for local work.
            port: Number(env.PORT) || 443,
            https: httpsConfig(),

            // Replaces src/setupProxy.js. That file imported
            // http-proxy-middleware without declaring it as a dependency; it
            // resolved only because react-scripts happened to pull it in.
            proxy: {
                '/editor': {target: editorTarget, changeOrigin: true},
                '/gameplay': {target: gameplayTarget, changeOrigin: true},
                '/images': {target: editorTarget, changeOrigin: true},
            },
        },

        build: {
            // Create React App wrote to build/, and the deploy and .gitignore
            // both expect that, so keep it rather than Vite's default dist/.
            outDir: 'build',
            sourcemap: env.GENERATE_SOURCEMAP === 'true',
            // antd (and the rest of the vendor libraries) are intentionally kept
            // as whole, cacheable chunks (see the codeSplitting groups below).
            // antd alone is ~860 kB minified, so the default 500 kB warning
            // threshold is not meaningful for a vendored UI library -- the app
            // code itself is fully split and every route chunk is well under
            // 500 kB. Raise it to just above the largest vendor chunk; if a
            // vendor or app chunk grows past 900 kB the warning returns.
            chunkSizeWarningLimit: 900,
            rolldownOptions: {
                output: {
                    // Vendor splitting (ticket #65): peel the large, rarely-changed
                    // libraries into their own chunks so (a) no chunk trips Vite's
                    // 500 kB warning and (b) they cache across deploys. Higher
                    // priority groups win when a module matches several.
                    codeSplitting: {
                        groups: [
                            {
                                name: 'react-vendor',
                                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                                priority: 5,
                            },
                            {
                                name: 'antd-core',
                                test: /node_modules[\\/](antd|@ant-design\/cssinjs|@ant-design\/react-slick|@ant-design\/fast-color)[\\/]/,
                                priority: 4,
                            },
                            {
                                name: 'antd-icons',
                                test: /node_modules[\\/]@ant-design\/icons[\\/]/,
                                priority: 4,
                            },
                            {
                                name: 'antd-rc',
                                test: /node_modules[\\/](@rc-component|rc-)[\\/]/,
                                priority: 3,
                            },
                            {
                                name: 'redux-vendor',
                                test: /node_modules[\\/](@reduxjs|redux|react-redux|use-sync-external-store)[\\/]/,
                                priority: 3,
                            },
                            {
                                name: 'router-vendor',
                                test: /node_modules[\\/](react-router|redux-first-history)[\\/]/,
                                priority: 3,
                            },
                            {
                                name: 'auth-vendor',
                                test: /node_modules[\\/]@auth0[\\/]/,
                                priority: 3,
                            },
                            {
                                name: 'vendor',
                                test: /node_modules/,
                                priority: 1,
                            },
                        ],
                    },
                },
            },
        },
    }
})
