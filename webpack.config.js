const webpack = require('webpack');
const path = require('path');

module.exports = {
    entry: {
        main: './build/scripts/main.js',
        popOut: './build/scripts/popOut.js',
        login: './build/scripts/login.js'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
                type: 'asset/resource',
            },
        ],
    },
    mode: "production",
    plugins: [
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery",
        }),
        new webpack.DefinePlugin({
            __VERSION__: JSON.stringify(require("./package.json").version),
        }),

    ],
}
