/** @type {import('vite').UserConfig} */
export default {
    build: {
        rollupOptions: {
            input: {
                main: '/main.html',
                login: '/login.html',
                rules: '/rules.html',
            },
        },
        commonjsOptions: {
            transformMixedEsModules: true,
        },
        minify: false,
        sourcemap: true,
        target: "ES2022",
    },
}
