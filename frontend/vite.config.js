/** @type {import('vite').UserConfig} */
export default {
    build: {
        rollupOptions: {
            input: {
                main: '/main.html',
                login: '/login.html',
            },
        },
        sourcemap: true,
        target: "ES2022",
    },
}
